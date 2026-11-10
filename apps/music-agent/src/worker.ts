import { config } from './config'
import { wakeCastSpeaker } from './cast/wake'
import { db, type CommandRow, type SpeakerRow } from './db'
import { getSpeaker, refreshSpeakers } from './speakers'
import {
  findDeviceByName,
  getPlayback,
  listDevices,
  pausePlayback,
  resumePlayback,
  setVolume,
  skipNext,
  skipPrevious,
  startPlayback,
  transferPlayback,
  type PlaybackState,
} from './spotify/webApi'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function payload(cmd: CommandRow) {
  return (cmd.payload ?? {}) as {
    uri?: string
    contextUri?: string
    volume?: number
  }
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

async function writeState(speaker: SpeakerRow | null, playback: PlaybackState | null) {
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

  await db.from('jukebox_state').upsert({
    household_id: config.householdId,
    speaker_id: speaker?.id ?? null,
    is_playing: Boolean(playback?.is_playing),
    volume: playback?.device?.volume_percent ?? 40,
    progress_ms: playback?.progress_ms ?? 0,
    duration_ms: item?.duration_ms ?? 0,
    now_playing: nowPlaying,
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

    if (speaker && ['play', 'resume', 'transfer', 'skip', 'previous', 'volume', 'advance'].includes(cmd.type)) {
      const device = await ensureSpotifyDevice(speaker)
      deviceId = device.id ?? undefined
      if (!deviceId) throw new Error(`${speaker.name} has no Spotify device id`)
    }

    switch (cmd.type) {
      case 'play': {
        if (!speaker || !deviceId) throw new Error('Speaker required for play')
        await transferPlayback(deviceId, false)
        await sleep(300)
        await startPlayback({
          deviceId,
          uri: body.uri,
          contextUri: body.contextUri,
        })
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
          await pausePlayback(deviceId)
          break
        }
        await transferPlayback(deviceId, false)
        await sleep(300)
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
      default:
        throw new Error(`Unsupported command: ${cmd.type}`)
    }

    await sleep(400)
    const playback = await getPlayback()
    await writeState(speaker, playback)
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
