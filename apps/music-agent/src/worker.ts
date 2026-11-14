import { config } from './config'
import { wakeCastSpeaker } from './cast/wake'
import { db, type CommandRow, type SpeakerRow } from './db'
import { getSpeaker, refreshSpeakers } from './speakers'
import {
  findDeviceByName,
  getCollectionTracks,
  getPlayback,
  isTrackExplicit,
  listDevices,
  pausePlayback,
  resumePlayback,
  setRepeat,
  setShuffle,
  setVolume,
  skipNext,
  skipPrevious,
  startPlayback,
  transferPlayback,
  type CollectionTrack,
  type PlaybackState,
  type RepeatMode,
} from './spotify/webApi'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MAX_EXPLICIT_SKIPS = 25

let kidFriendlyCache: { value: boolean; at: number } | null = null

async function isKidFriendlyMode(): Promise<boolean> {
  // Short cache — parents toggle this live; a long TTL left skipNext running after turn-off.
  if (kidFriendlyCache && Date.now() - kidFriendlyCache.at < 5_000) {
    return kidFriendlyCache.value
  }
  const { data } = await db
    .from('household_settings')
    .select('jukebox_kid_friendly')
    .eq('household_id', config.householdId)
    .maybeSingle()
  const value = Boolean(data?.jukebox_kid_friendly)
  kidFriendlyCache = { value, at: Date.now() }
  return value
}

function cleanTracks(tracks: CollectionTrack[]): CollectionTrack[] {
  return tracks.filter((t) => !t.explicit)
}

async function ensureCleanUri(uri: string | undefined, kidFriendly: boolean): Promise<string | null> {
  if (!uri) return null
  if (!kidFriendly) return uri
  if (await isTrackExplicit(uri)) {
    console.log(`[music-agent] kid-friendly: skipping explicit ${uri}`)
    return null
  }
  return uri
}

async function trackIsExplicit(item: NonNullable<PlaybackState['item']>): Promise<boolean> {
  if (typeof item.explicit === 'boolean') return item.explicit
  return isTrackExplicit(item.uri)
}

async function appQueueCount(): Promise<number> {
  const { count } = await db
    .from('jukebox_queue')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', config.householdId)
  return count ?? 0
}

/** Wait until Spotify reports the track we just asked it to play (avoids writing stale state). */
async function waitForPlaybackUri(uri: string, timeoutMs = 5_000): Promise<PlaybackState | null> {
  const deadline = Date.now() + timeoutMs
  let last: PlaybackState | null = null
  while (Date.now() < deadline) {
    last = await getPlayback()
    if (last?.item?.uri === uri) return last
    await sleep(300)
  }
  return last
}

/**
 * Kid-friendly guard for Spotify-owned context playback only.
 * Never call skipNext while jukebox_queue has items — that abandons the app queue
 * and is what broke album play after a playlist.
 */
async function skipExplicitContextPlayback(playback: PlaybackState): Promise<PlaybackState> {
  if (!(await isKidFriendlyMode())) return playback
  if ((await appQueueCount()) > 0) return playback

  let current = playback
  for (let i = 0; i < MAX_EXPLICIT_SKIPS; i++) {
    if (!current.is_playing || !current.item?.uri) return current
    if (!(await trackIsExplicit(current.item))) return current
    console.log(`[music-agent] kid-friendly: skipping context track ${current.item.uri}`)
    await skipNext(current.device?.id ?? undefined)
    await sleep(500)
    current = (await getPlayback()) ?? current
  }
  return current
}

async function startTrackAndConfirm(deviceId: string, uri: string): Promise<PlaybackState | null> {
  await startPlayback({ deviceId, uri })
  let playback = await waitForPlaybackUri(uri)
  if (playback?.item?.uri === uri) return playback
  // One retry — Connect speakers sometimes swallow the first play after a context playlist.
  console.log(`[music-agent] play not confirmed for ${uri}; retrying`)
  await startPlayback({ deviceId, uri })
  playback = await waitForPlaybackUri(uri)
  return playback
}

type RecentItem = {
  uri: string
  kind: 'album' | 'playlist'
  title: string
  subtitle?: string
  imageUrl?: string
}

function payload(cmd: CommandRow) {
  return (cmd.payload ?? {}) as {
    uri?: string
    contextUri?: string
    startUri?: string
    volume?: number
    shuffle?: boolean
    state?: boolean | RepeatMode
    title?: string
    subtitle?: string
    imageUrl?: string
    kind?: 'album' | 'playlist'
  }
}

function shuffleInPlace<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}

async function ensureSpotifyDevice(speaker: SpeakerRow) {
  let devices = await listDevices()
  let device = findDeviceByName(devices, speaker.name)
  if (device?.id) {
    console.log(`[music-agent] already on Spotify Connect: ${device.name} (${device.id})`)
    return device
  }

  // Google Cast speakers drop off when idle. Wake them over the LAN, then wait.
  if (speaker.provider === 'cast' || speaker.cast_host) {
    console.log(`[music-agent] waking ${speaker.name}…`)
    await wakeCastSpeaker({ name: speaker.name, host: speaker.cast_host ?? undefined })
    for (let i = 0; i < 15; i++) {
      await sleep(1000)
      devices = await listDevices()
      device = findDeviceByName(devices, speaker.name)
      if (device?.id) {
        console.log(`[music-agent] woke after ${i + 1}s: ${device.name} (${device.id})`)
        await db
          .from('speakers')
          .update({ available: true, external_id: device.id, last_seen_at: new Date().toISOString() })
          .eq('id', speaker.id)
        return device
      }
      if (i === 0 || i === 4 || i === 9) {
        console.log(
          `[music-agent] waiting for Connect… seen: ${
            devices.map((d) => d.name).join(', ') || 'none'
          }`,
        )
      }
    }
  }

  throw new Error(
    `${speaker.name} isn't available after wake. Spotify saw: ${
      devices.map((d) => d.name).join(', ') || 'no devices'
    }.`,
  )
}

/** One command at a time — overlapping wakes break Cast discovery/connect. */
let queue: Promise<void> = Promise.resolve()

export function enqueueCommand(cmd: CommandRow) {
  queue = queue.then(() => processCommand(cmd)).catch((err) => {
    console.error('[music-agent] queue error', err instanceof Error ? err.message : err)
  })
  return queue
}

async function readRecent(): Promise<RecentItem[]> {
  const { data } = await db
    .from('jukebox_state')
    .select('recent')
    .eq('household_id', config.householdId)
    .maybeSingle()
  const raw = data?.recent
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is RecentItem => {
    if (!x || typeof x !== 'object') return false
    const o = x as Record<string, unknown>
    return typeof o.uri === 'string' && typeof o.title === 'string' && (o.kind === 'album' || o.kind === 'playlist')
  })
}

function pushRecent(current: RecentItem[], item: RecentItem): RecentItem[] {
  return [item, ...current.filter((x) => x.uri !== item.uri)].slice(0, 4)
}

async function replaceQueue(tracks: CollectionTrack[]) {
  await db.from('jukebox_queue').delete().eq('household_id', config.householdId)
  if (!tracks.length) return
  await db.from('jukebox_queue').insert(
    tracks.map((t, i) => ({
      household_id: config.householdId,
      position: i,
      spotify_uri: t.uri,
      title: t.title,
      subtitle: t.subtitle || null,
      image_url: t.imageUrl ?? null,
      duration_ms: t.durationMs ?? null,
    })),
  )
}

async function writeState(
  speaker: SpeakerRow | null,
  playback: PlaybackState | null,
  extras?: { recent?: RecentItem[]; shuffle?: boolean; repeat?: RepeatMode },
) {
  const item = playback?.item
  const nowPlaying = item
    ? {
        title: item.name,
        artist: item.artists.map((a) => a.name).join(', '),
        album: item.album?.name,
        imageUrl: item.album?.images?.[0]?.url,
        uri: item.uri,
        contextUri: playback.context?.uri ?? undefined,
      }
    : {}

  const recent = extras?.recent ?? (await readRecent())
  const shuffle = extras?.shuffle ?? Boolean(playback?.shuffle_state)
  const repeat: RepeatMode = extras?.repeat ?? playback?.repeat_state ?? 'off'

  await db.from('jukebox_state').upsert({
    household_id: config.householdId,
    speaker_id: speaker?.id ?? null,
    is_playing: Boolean(playback?.is_playing),
    volume: playback?.device?.volume_percent ?? 40,
    progress_ms: playback?.progress_ms ?? 0,
    duration_ms: item?.duration_ms ?? 0,
    now_playing: nowPlaying,
    shuffle,
    repeat,
    recent,
    updated_at: new Date().toISOString(),
  })
}

export async function processCommand(cmd: CommandRow) {
  console.log(`[music-agent] ${cmd.type} ${cmd.id}`)
  try {
    if (cmd.type === 'refresh_speakers') {
      await refreshSpeakers()
      await finish(cmd.id, 'done')
      return
    }

    const speaker = await getSpeaker(cmd.speaker_id)
    if (!speaker && cmd.type !== 'pause') {
      throw new Error('No speaker selected')
    }

    const body = payload(cmd)
    let deviceId: string | undefined
    let recentOverride: RecentItem[] | undefined
    let shuffleOverride: boolean | undefined
    let repeatOverride: RepeatMode | undefined

    const needsDevice = [
      'play', 'resume', 'transfer', 'skip', 'previous', 'volume', 'advance', 'shuffle', 'repeat',
    ].includes(cmd.type)

    if (speaker && needsDevice) {
      const device = await ensureSpotifyDevice(speaker)
      deviceId = device.id ?? undefined
      if (!deviceId) throw new Error(`${speaker.name} has no Spotify device id`)
    }

    const kidFriendly = await isKidFriendlyMode()
    /** When true, Spotify owns the track list (no app queue) — only then may we skipNext. */
    let spotifyContextPlayback = false
    let confirmedPlayback: PlaybackState | null | undefined

    switch (cmd.type) {
      case 'play': {
        if (!speaker || !deviceId) throw new Error('Speaker required for play')
        await transferPlayback(deviceId, false)
        await sleep(300)

        if (body.contextUri) {
          const collection = await getCollectionTracks(body.contextUri)
          const kind = body.kind ?? collection.kind
          const recentItem: RecentItem = {
            uri: body.contextUri,
            kind,
            title: body.title ?? collection.title ?? 'Collection',
            subtitle: body.subtitle ?? collection.subtitle,
            imageUrl: body.imageUrl ?? collection.imageUrl,
          }
          recentOverride = pushRecent(await readRecent(), recentItem)

          if (collection.available && collection.tracks.length) {
            let ordered = body.shuffle
              ? shuffleInPlace([...collection.tracks])
              : [...collection.tracks]
            if (body.startUri && !body.shuffle) {
              const idx = ordered.findIndex((t) => t.uri === body.startUri)
              if (idx > 0) ordered = ordered.slice(idx)
            }
            if (kidFriendly) ordered = cleanTracks(ordered)
            if (!ordered.length) {
              throw new Error('No kid-friendly tracks in this album or playlist')
            }
            const [first, ...rest] = ordered
            // App owns queue order — keep Spotify shuffle off.
            await setShuffle(false, deviceId)
            shuffleOverride = false
            await replaceQueue(rest)
            confirmedPlayback = await startTrackAndConfirm(deviceId, first!.uri)
            if (!confirmedPlayback?.item || confirmedPlayback.item.uri !== first!.uri) {
              throw new Error(`Couldn’t start “${first!.title}” on ${speaker.name}`)
            }
          } else {
            // Unowned / empty playlist: Spotify picks tracks via context.
            spotifyContextPlayback = true
            await replaceQueue([])
            if (body.shuffle) {
              await setShuffle(true, deviceId)
              shuffleOverride = true
            }
            await startPlayback({ deviceId, contextUri: body.contextUri })
          }
        } else {
          const uri = await ensureCleanUri(body.uri, kidFriendly)
          if (!uri) throw new Error('That song is marked explicit — skipped for kid-friendly mode')
          confirmedPlayback = await startTrackAndConfirm(deviceId, uri)
          if (!confirmedPlayback?.item || confirmedPlayback.item.uri !== uri) {
            throw new Error(`Couldn’t start that song on ${speaker.name}`)
          }
        }
        break
      }
      case 'resume':
        await resumePlayback(deviceId)
        break
      case 'pause':
        await pausePlayback(deviceId)
        break
      case 'skip':
        await skipNext(deviceId)
        break
      case 'previous':
        await skipPrevious(deviceId)
        break
      case 'advance': {
        // App-owned queue: play the head of jukebox_queue, then delete it.
        if (!speaker || !deviceId) throw new Error('Speaker required for advance')
        for (let i = 0; i < MAX_EXPLICIT_SKIPS; i++) {
          const { data: head } = await db
            .from('jukebox_queue')
            .select('*')
            .eq('household_id', config.householdId)
            .order('position', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (!head) {
            // Do not pause. An empty queue is normal for context_uri playlists
            // (Spotify advances itself) and for duplicate end-of-song advances;
            // pausing here stops the track that just started.
            break
          }
          const current = await getPlayback()
          if (current?.item?.uri === head.spotify_uri && current.is_playing) {
            // Duplicate advance after we already started this track — just consume the row.
            await db.from('jukebox_queue').delete().eq('id', head.id)
            break
          }
          if (kidFriendly && (await isTrackExplicit(head.spotify_uri))) {
            console.log(`[music-agent] kid-friendly: dropping queue head ${head.spotify_uri}`)
            await db.from('jukebox_queue').delete().eq('id', head.id)
            continue
          }
          // Stay on the active device; transfer(play:false) pauses Connect speakers.
          confirmedPlayback = await startTrackAndConfirm(deviceId, head.spotify_uri)
          await db.from('jukebox_queue').delete().eq('id', head.id)
          break
        }
        break
      }
      case 'volume': {
        if (typeof body.volume !== 'number') throw new Error('volume required')
        await setVolume(body.volume, deviceId)
        break
      }
      case 'transfer': {
        if (!deviceId) throw new Error('Speaker required for transfer')
        await transferPlayback(deviceId, true)
        break
      }
      case 'shuffle': {
        if (typeof body.state !== 'boolean') throw new Error('shuffle state required')
        await setShuffle(body.state, deviceId)
        shuffleOverride = body.state
        break
      }
      case 'repeat': {
        const mode: RepeatMode =
          body.state === 'track' || body.state === 'context' || body.state === 'off'
            ? body.state
            : body.state === true
              ? 'context'
              : 'off'
        await setRepeat(mode, deviceId)
        repeatOverride = mode
        break
      }
      default:
        throw new Error(`Unsupported command: ${cmd.type}`)
    }

    await sleep(400)
    let playback = confirmedPlayback ?? (await getPlayback())
    // Only Spotify-context plays need a post-play explicit skip. App-owned album/playlist
    // tracks were already filtered; skipNext here was racing and killing the new play.
    if (kidFriendly && spotifyContextPlayback && playback?.is_playing && playback.item?.uri) {
      playback = await skipExplicitContextPlayback(playback)
    }
    await writeState(speaker, playback, {
      recent: recentOverride,
      shuffle: shuffleOverride,
      repeat: repeatOverride,
    })
    if (speaker) {
      await db
        .from('speakers')
        .update({ available: true, last_seen_at: new Date().toISOString() })
        .eq('id', speaker.id)
    }
    await finish(cmd.id, 'done')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[music-agent] command failed: ${message}`)
    await finish(cmd.id, 'failed', message)
  }
}

async function finish(id: string, status: 'done' | 'failed', error?: string) {
  await db
    .from('jukebox_commands')
    .update({ status, error: error ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function drainPending() {
  const { data } = await db
    .from('jukebox_commands')
    .select('*')
    .eq('household_id', config.householdId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20)

  for (const cmd of data ?? []) {
    await processCommand(cmd)
  }
}

/** Keep now-playing fresh while something is active. */
export async function syncPlaybackState() {
  try {
    let playback = await getPlayback()
    if (!playback) return

    // Only skip via Spotify when we are NOT driving an app-owned queue.
    if (playback.is_playing && playback.item?.uri) {
      playback = await skipExplicitContextPlayback(playback)
    }

    const { data: speakers } = await db
      .from('speakers')
      .select('*')
      .eq('household_id', config.householdId)
    const activeName = playback.device?.name
    const speaker = activeName
      ? (speakers ?? []).find((s) => s.name.trim().toLowerCase() === activeName.trim().toLowerCase()) ?? null
      : null
    await writeState(speaker, playback)
  } catch (err) {
    console.warn('[music-agent] playback sync failed', err instanceof Error ? err.message : err)
  }
}
