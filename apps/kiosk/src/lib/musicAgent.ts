import type { SearchHit } from '@hub/shared'

export type { SearchHit }

export type CollectionTrackHit = {
  uri: string
  title: string
  subtitle: string
  album?: string
  imageUrl?: string
  durationMs?: number
}

export type CollectionResponse = {
  uri: string
  kind: 'album' | 'playlist'
  title?: string
  subtitle?: string
  imageUrl?: string
  trackCount?: number
  available: boolean
  owned: boolean
  tracks: CollectionTrackHit[]
  error?: string
}

/** Same-origin `/api/music` on the Pi (Caddy proxy); Vite proxies it in dev. */
const base = (import.meta.env.VITE_MUSIC_AGENT_URL ?? '/api/music').replace(/\/$/, '')

export async function searchMusic(query: string): Promise<SearchHit[]> {
  const q = query.trim()
  if (!q) return []
  const res = await fetch(`${base}/search?${new URLSearchParams({ q })}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Search failed (${res.status})`)
  }
  const data = (await res.json()) as { results?: SearchHit[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.results ?? []
}

export async function fetchCollection(uri: string): Promise<CollectionResponse> {
  const u = uri.trim()
  if (!u) throw new Error('uri required')
  const res = await fetch(`${base}/collection?${new URLSearchParams({ uri: u })}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Collection failed (${res.status})`)
  }
  const data = (await res.json()) as CollectionResponse
  if (data.error) throw new Error(data.error)
  return data
}
