import { config } from './config'
import { wakeCastSpeaker } from './cast/wake'
import { db, type CommandRow, type SpeakerRow } from './db'
import { getSpeaker, refreshSpeakers } from './speakers'
import {
  findDeviceByName,
  getCollectionTracks,
  getPlayback,
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
            const [first, ...rest] = ordered
            // App owns queue order — keep Spotify shuffle off.
            await setShuffle(false, deviceId)
            shuffleOverride = false
            await replaceQueue(rest)
            await startPlayback({ deviceId, uri: first!.uri })
          } else {
            // Unowned / empty playlist: Spotify picks tracks via context.
            await replaceQueue([])
            if (body.shuffle) {
              await setShuffle(true, deviceId)
              shuffleOverride = true
            }
            await startPlayback({ deviceId, contextUri: body.contextUri })
          }
        } else {
          await startPlayback({
            deviceId,
            uri: body.uri,
          })
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
        // Stay on the active device; transfer(play:false) pauses Connect speakers.
        await startPlayback({ deviceId, uri: head.spotify_uri })
        await db.from('jukebox_queue').delete().eq('id', head.id)
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
    const playback = await getPlayback()
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
    const playback = await getPlayback()
    if (!playback) return
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
