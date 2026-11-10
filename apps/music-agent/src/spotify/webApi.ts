import { config } from '../config'

type Token = { accessToken: string; expiresAt: number }
let cached: Token | null = null

async function refreshAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken

  const auth = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.spotifyRefreshToken,
    }),
  })
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`Spotify token refresh failed: ${data.error ?? res.status}`)
  }
  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return cached.accessToken
}

async function spotify<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await refreshAccessToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  // Player control endpoints often return 204, or 200 with an empty / non-JSON body.
  if (res.status === 204) return null
  const text = (await res.text()).trim()
  if (!text) {
    if (!res.ok) throw new Error(`Spotify ${res.status}`)
    return null
  }

  const looksJson = text.startsWith('{') || text.startsWith('[')
  if (!looksJson) {
    if (!res.ok) throw new Error(`Spotify ${res.status}: ${text.slice(0, 80)}`)
    // Success with opaque body (skip/pause sometimes do this) — treat as OK.
    return null
  }

  const body = JSON.parse(text) as T & { error?: { message?: string } }
  if (!res.ok) {
    throw new Error(body.error?.message ?? `Spotify ${res.status}`)
  }
  return body
}

export type SpotifyDevice = {
  id: string | null
  name: string
  type: string
  is_active: boolean
  volume_percent: number | null
}

export type PlaybackState = {
  is_playing: boolean
  progress_ms: number | null
  shuffle_state?: boolean
  repeat_state?: 'off' | 'track' | 'context'
  device?: SpotifyDevice
  item?: {
    name: string
    duration_ms: number
    uri: string
    artists: { name: string }[]
    album?: { name: string; images?: { url: string }[] }
  } | null
  context?: { uri: string | null } | null
}

export type CollectionTrack = {
  uri: string
  title: string
  subtitle: string
  album?: string
  imageUrl?: string
  durationMs?: number
}

export type CollectionResult = {
  uri: string
  kind: 'album' | 'playlist'
  title?: string
  subtitle?: string
  imageUrl?: string
  trackCount?: number
  available: boolean
  owned: boolean
  tracks: CollectionTrack[]
}

export type RepeatMode = 'off' | 'track' | 'context'

const pickImage = (images?: { url: string }[]) => {
  if (!images?.length) return undefined
  // Prefer ~300px when Spotify returns multiple sizes.
  return (images.find((img) => img.url.includes('300')) ?? images[Math.min(1, images.length - 1)] ?? images[0])?.url
}

export const listDevices = async () =>
  ((await spotify<{ devices: SpotifyDevice[] }>('/me/player/devices'))?.devices ?? [])

export const getPlayback = () => spotify<PlaybackState>('/me/player')

export async function transferPlayback(deviceId: string, play = false) {
  await spotify('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
}

export async function startPlayback(opts: {
  deviceId?: string
  uri?: string
  uris?: string[]
  contextUri?: string
}) {
  const body: Record<string, unknown> = {}
  if (opts.contextUri) body.context_uri = opts.contextUri
  else if (opts.uris?.length) body.uris = opts.uris
  else if (opts.uri) body.uris = [opts.uri]
  const qs = opts.deviceId ? `?device_id=${encodeURIComponent(opts.deviceId)}` : ''
  await spotify(`/me/player/play${qs}`, { method: 'PUT', body: JSON.stringify(body) })
}

export const pausePlayback = (deviceId?: string) =>
  spotify(`/me/player/pause${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, { method: 'PUT' })

export const resumePlayback = (deviceId?: string) =>
  spotify(`/me/player/play${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, { method: 'PUT' })

export const skipNext = (deviceId?: string) =>
  spotify(`/me/player/next${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, { method: 'POST' })

export const skipPrevious = (deviceId?: string) =>
  spotify(`/me/player/previous${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, { method: 'POST' })

export const setVolume = (percent: number, deviceId?: string) => {
  const volume = Math.max(0, Math.min(100, Math.round(percent)))
  const qs = new URLSearchParams({ volume_percent: String(volume) })
  if (deviceId) qs.set('device_id', deviceId)
  return spotify(`/me/player/volume?${qs}`, { method: 'PUT' })
}

export const setShuffle = (state: boolean, deviceId?: string) => {
  const qs = new URLSearchParams({ state: state ? 'true' : 'false' })
  if (deviceId) qs.set('device_id', deviceId)
  return spotify(`/me/player/shuffle?${qs}`, { method: 'PUT' })
}

export const setRepeat = (state: RepeatMode, deviceId?: string) => {
  const qs = new URLSearchParams({ state })
  if (deviceId) qs.set('device_id', deviceId)
  return spotify(`/me/player/repeat?${qs}`, { method: 'PUT' })
}

function parseSpotifyId(uri: string): { kind: 'album' | 'playlist' | 'track'; id: string } | null {
  const m = /^spotify:(album|playlist|track):([A-Za-z0-9]+)$/.exec(uri.trim())
  if (!m) return null
  return { kind: m[1] as 'album' | 'playlist' | 'track', id: m[2]! }
}

const MAX_COLLECTION_TRACKS = 100

async function getMeId(): Promise<string | null> {
  try {
    const me = await spotify<{ id?: string }>('/me')
    return me?.id ?? null
  } catch {
    return null
  }
}

/** Album or playlist tracks for detail view / queue expansion. */
export async function getCollectionTracks(uri: string): Promise<CollectionResult> {
  const parsed = parseSpotifyId(uri)
  if (!parsed || (parsed.kind !== 'album' && parsed.kind !== 'playlist')) {
    return { uri, kind: 'album', available: false, owned: false, tracks: [] }
  }

  if (parsed.kind === 'album') {
    const album = await spotify<{
      name?: string
      uri?: string
      total_tracks?: number
      artists?: { name: string }[]
      images?: { url: string }[]
      tracks?: {
        items: Array<{
          uri?: string
          name?: string
          duration_ms?: number
          artists?: { name: string }[]
        } | null>
        next?: string | null
      }
    }>(`/albums/${parsed.id}`)

    const tracks: CollectionTrack[] = []
    let nextPath: string | null = null
    const first = album?.tracks?.items ?? []
    for (const t of first) {
      if (!t?.uri || !t.name) continue
      tracks.push({
        uri: t.uri,
        title: t.name,
        subtitle: (t.artists ?? []).map((a) => a.name).join(', '),
        album: album?.name,
        imageUrl: pickImage(album?.images),
        durationMs: t.duration_ms,
      })
      if (tracks.length >= MAX_COLLECTION_TRACKS) break
    }
    // Spotify album track paging uses full URLs; follow a few pages if needed.
    nextPath = album?.tracks?.next ?? null
    while (nextPath && tracks.length < MAX_COLLECTION_TRACKS) {
      const pageUrl = new URL(nextPath)
      const page = await spotify<{
        items: Array<{
          uri?: string
          name?: string
          duration_ms?: number
          artists?: { name: string }[]
        } | null>
        next?: string | null
      }>(`${pageUrl.pathname.replace(/^\/v1/, '')}${pageUrl.search}`)
      for (const t of page?.items ?? []) {
        if (!t?.uri || !t.name) continue
        tracks.push({
          uri: t.uri,
          title: t.name,
          subtitle: (t.artists ?? []).map((a) => a.name).join(', '),
          album: album?.name,
          imageUrl: pickImage(album?.images),
          durationMs: t.duration_ms,
        })
        if (tracks.length >= MAX_COLLECTION_TRACKS) break
      }
      nextPath = page?.next ?? null
    }

    return {
      uri: album?.uri ?? uri,
      kind: 'album',
      title: album?.name,
      subtitle: (album?.artists ?? []).map((a) => a.name).join(', '),
      imageUrl: pickImage(album?.images),
      trackCount: album?.total_tracks ?? tracks.length,
      available: tracks.length > 0,
      owned: true,
      tracks,
    }
  }

  // Playlist
  try {
    const meId = await getMeId()
    const playlist = await spotify<{
      name?: string
      uri?: string
      owner?: { id?: string; display_name?: string }
      images?: { url: string }[]
      tracks?: { total?: number }
    }>(`/playlists/${parsed.id}`)

    const owned = Boolean(meId && playlist?.owner?.id && meId === playlist.owner.id)
    const tracks: CollectionTrack[] = []
    let offset = 0
    const pageSize = 50

    while (tracks.length < MAX_COLLECTION_TRACKS) {
      const page = await spotify<{
        items: Array<{
          track?: {
            uri?: string
            name?: string
            duration_ms?: number
            artists?: { name: string }[]
            album?: { name?: string; images?: { url: string }[] }
          } | null
        }>
        next?: string | null
        total?: number
      }>(`/playlists/${parsed.id}/tracks?${new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        fields: 'next,total,items(track(uri,name,duration_ms,artists(name),album(name,images)))',
      })}`)

      const items = page?.items ?? []
      if (!items.length) break
      for (const row of items) {
        const t = row.track
        if (!t?.uri || !t.name) continue
        tracks.push({
          uri: t.uri,
          title: t.name,
          subtitle: (t.artists ?? []).map((a) => a.name).join(', '),
          album: t.album?.name,
          imageUrl: pickImage(t.album?.images),
          durationMs: t.duration_ms,
        })
        if (tracks.length >= MAX_COLLECTION_TRACKS) break
      }
      if (!page?.next) break
      offset += pageSize
    }

    return {
      uri: playlist?.uri ?? uri,
      kind: 'playlist',
      title: playlist?.name,
      subtitle: playlist?.owner?.display_name
        ? `Playlist · ${playlist.owner.display_name}`
        : 'Playlist',
      imageUrl: pickImage(playlist?.images),
      trackCount: playlist?.tracks?.total ?? tracks.length,
      available: tracks.length > 0,
      owned,
      tracks,
    }
  } catch {
    return {
      uri,
      kind: 'playlist',
      available: false,
      owned: false,
      tracks: [],
    }
  }
}

export function findDeviceByName(devices: SpotifyDevice[], name: string) {
  const wanted = name.trim().toLowerCase()
  return (
    devices.find((d) => d.name.trim().toLowerCase() === wanted) ??
    devices.find((d) => d.name.trim().toLowerCase().includes(wanted)) ??
    null
  )
}

export type SearchHit = {
  kind: 'track' | 'album' | 'playlist'
  uri: string
  title: string
  subtitle: string
  album?: string
  imageUrl?: string
  durationMs?: number
  trackCount?: number
  owned?: boolean
}

/** Spotify search (dev mode: max 10 per type). */
export async function searchMusic(query: string, limit = 10): Promise<SearchHit[]> {
  const q = query.trim()
  if (!q) return []
  const capped = Math.max(1, Math.min(10, limit))
  const data = await spotify<{
    tracks?: {
      items: Array<{
        name: string
        uri: string
        duration_ms: number
        artists: { name: string }[]
        album?: { name?: string; images?: { url: string }[] }
      } | null>
    }
    albums?: {
      items: Array<{
        name: string
        uri: string
        total_tracks?: number
        artists: { name: string }[]
        images?: { url: string }[]
      } | null>
    }
    playlists?: {
      items: Array<{
        name: string
        uri: string
        owner?: { display_name?: string; id?: string }
        images?: { url: string }[]
        tracks?: { total?: number }
      } | null>
    }
  }>(`/search?${new URLSearchParams({ q, type: 'track,album,playlist', limit: String(capped) })}`)

  const tracks: SearchHit[] = (data?.tracks?.items ?? [])
    .filter((t): t is NonNullable<typeof t> => Boolean(t?.uri && t.name))
    .map((t) => ({
      kind: 'track' as const,
      uri: t.uri,
      title: t.name,
      subtitle: t.artists.map((a) => a.name).join(', '),
      album: t.album?.name,
      imageUrl: pickImage(t.album?.images),
      durationMs: t.duration_ms,
    }))

  const albums: SearchHit[] = (data?.albums?.items ?? [])
    .filter((a): a is NonNullable<typeof a> => Boolean(a?.uri && a.name))
    .map((a) => ({
      kind: 'album' as const,
      uri: a.uri,
      title: a.name,
      subtitle: a.artists.map((x) => x.name).join(', '),
      imageUrl: pickImage(a.images),
      trackCount: a.total_tracks,
    }))

  const playlists: SearchHit[] = (data?.playlists?.items ?? [])
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.uri && p.name))
    .map((p) => ({
      kind: 'playlist' as const,
      uri: p.uri,
      title: p.name,
      subtitle: p.owner?.display_name ? `Playlist · ${p.owner.display_name}` : 'Playlist',
      imageUrl: pickImage(p.images),
      trackCount: p.tracks?.total,
      owned: false,
    }))

  // Interleave kinds so songs, albums and playlists all show near the top.
  const out: SearchHit[] = []
  const max = Math.max(tracks.length, albums.length, playlists.length)
  for (let i = 0; i < max; i++) {
    if (tracks[i]) out.push(tracks[i]!)
    if (albums[i]) out.push(albums[i]!)
    if (playlists[i]) out.push(playlists[i]!)
  }
  return out
}
