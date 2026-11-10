import { config } from './config'
import { db, type SpeakerRow } from './db'
import { discoverCastDevices } from './cast/discover'
import { findDeviceByName, listDevices } from './spotify/webApi'

/** Merge LAN Cast discovery + Spotify Connect into the speakers table. */
export async function refreshSpeakers() {
  const [{ data: rows }, castDevices, spotifyDevices] = await Promise.all([
    db.from('speakers').select('*').eq('household_id', config.householdId).order('sort_order'),
    discoverCastDevices().catch(() => []),
    listDevices().catch(() => []),
  ])

  const speakers = rows ?? []
  const now = new Date().toISOString()

  for (const speaker of speakers) {
    const cast = castDevices.find((d) => namesMatch(d.name, speaker.name))
    const spotify = findDeviceByName(spotifyDevices, speaker.name)
    const available = Boolean(spotify) || Boolean(cast)
    await db
      .from('speakers')
      .update({
        available,
        cast_host: cast?.host ?? speaker.cast_host,
        external_id: spotify?.id ?? speaker.external_id,
        kind: speaker.kind || cast?.model || spotify?.type || 'Speaker',
        last_seen_at: available ? now : speaker.last_seen_at,
        provider: (cast ? 'cast' : spotify ? 'spotify_connect' : speaker.provider) as SpeakerRow['provider'],
      })
      .eq('id', speaker.id)
  }

  // Do not auto-insert new Cast devices — only refresh rows already in the table
  // (avoids random TVs / rooms cluttering the Jukebox).

  const { data: next } = await db
    .from('speakers')
    .select('*')
    .eq('household_id', config.householdId)
    .order('sort_order')
  return next ?? []
}

function namesMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export async function getSpeaker(id: string | null | undefined): Promise<SpeakerRow | null> {
  if (!id) return null
  const { data } = await db.from('speakers').select('*').eq('id', id).maybeSingle()
  return data
}
