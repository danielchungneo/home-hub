import type {
  ArtSwatch,
  Artwork,
  Collection,
  JukeboxFavorite,
  NowPlaying,
  QueueItem,
  SearchHit,
  Track,
} from '@hub/shared'

const SWATCHES: ArtSwatch[] = [
  { bg: '#E4EAEE', fg: '#4B6270', cx: 66, cy: 38, r: 24, band: 74 },
  { bg: '#F4ECDA', fg: '#735623', cx: 50, cy: 44, r: 28, band: 80 },
  { bg: '#E9EDE1', fg: '#55623F', cx: 72, cy: 70, r: 22, band: 30 },
  { bg: '#F3E7DF', fg: '#7D513C', cx: 40, cy: 56, r: 26, band: 84 },
  { bg: '#EDE6F0', fg: '#6E5A72', cx: 64, cy: 30, r: 18, band: 72 },
  { bg: '#D6E0E6', fg: '#2E2A26', cx: 30, cy: 62, r: 30, band: 20 },
]

/** Stable placeholder colors when Spotify didn't give us an image URL. */
export function swatchFor(uri: string): ArtSwatch {
  let h = 0
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) >>> 0
  return SWATCHES[h % SWATCHES.length]!
}

export function artwork(uri: string, imageUrl?: string | null): Artwork {
  return { url: imageUrl || undefined, swatch: swatchFor(uri) }
}

export function trackTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function totalLengthMs(items: { durationMs?: number }[]) {
  const ms = items.reduce((sum, x) => sum + (x.durationMs ?? 0), 0)
  const min = Math.round(ms / 60_000)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} hr ${min % 60} min`
}

export function favoriteToTrack(f: JukeboxFavorite): Track {
  return {
    uri: f.spotifyUri,
    title: f.title,
    artist: f.subtitle || 'Unknown artist',
    album: f.albumTitle || '',
    durationMs: f.durationMs ?? 0,
    art: artwork(f.spotifyUri, f.imageUrl),
  }
}

export function favoriteToCollection(f: JukeboxFavorite): Collection {
  return {
    uri: f.spotifyUri,
    kind: f.kind === 'album' ? 'album' : 'playlist',
    title: f.title,
    subtitle: f.subtitle || (f.kind === 'album' ? 'Album' : 'Playlist'),
    art: artwork(f.spotifyUri, f.imageUrl),
    trackUris: [],
    trackCount: f.trackCount,
  }
}

export function recentToCollection(r: {
  uri: string
  kind: 'album' | 'playlist'
  title: string
  subtitle?: string
  imageUrl?: string
}): Collection {
  return {
    uri: r.uri,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle || (r.kind === 'album' ? 'Album' : 'Playlist'),
    art: artwork(r.uri, r.imageUrl),
    trackUris: [],
  }
}

export function collectionTrackToTrack(t: {
  uri: string
  title: string
  subtitle: string
  album?: string
  imageUrl?: string
  durationMs?: number
}): Track {
  return {
    uri: t.uri,
    title: t.title,
    artist: t.subtitle,
    album: t.album ?? '',
    durationMs: t.durationMs ?? 0,
    art: artwork(t.uri, t.imageUrl),
  }
}

export function queueItemToTrack(q: QueueItem): Track {
  return {
    uri: q.spotifyUri,
    title: q.title,
    artist: q.subtitle || '',
    album: '',
    durationMs: q.durationMs ?? 0,
    art: artwork(q.spotifyUri, q.imageUrl),
  }
}

export function searchHitToTrack(hit: SearchHit): Track {
  return {
    uri: hit.uri,
    title: hit.title,
    artist: hit.subtitle,
    album: hit.album ?? '',
    durationMs: hit.durationMs ?? 0,
    art: artwork(hit.uri, hit.imageUrl),
  }
}

export function searchHitToCollection(hit: SearchHit): Collection {
  return {
    uri: hit.uri,
    kind: hit.kind === 'album' ? 'album' : 'playlist',
    title: hit.title,
    subtitle: hit.subtitle,
    art: artwork(hit.uri, hit.imageUrl),
    trackUris: [],
    trackCount: hit.trackCount,
  }
}

export function nowPlayingToTrack(np: NowPlaying | null | undefined): Track | undefined {
  if (!np?.title) return undefined
  const uri = np.uri ?? `spotify:track:now`
  return {
    uri,
    title: np.title,
    artist: np.artist || '',
    album: np.album || '',
    durationMs: 0,
    art: artwork(uri, np.imageUrl),
  }
}

export function trackMeta(t: Track) {
  return {
    uri: t.uri,
    title: t.title,
    subtitle: t.artist,
    albumTitle: t.album || undefined,
    imageUrl: t.art.url,
    durationMs: t.durationMs || undefined,
  }
}

export function collectionMeta(c: Collection) {
  return {
    uri: c.uri,
    title: c.title,
    subtitle: c.subtitle,
    imageUrl: c.art.url,
    trackCount: c.trackCount ?? (c.trackUris.length || undefined),
    isOwned: c.trackUris.length > 0 ? true : undefined,
  }
}
