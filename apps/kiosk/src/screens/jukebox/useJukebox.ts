import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Collection, Json, MediaKind, SearchHit, Track } from '@hub/shared'
import {
  useFavorites,
  useJukeboxCommand,
  useJukeboxQueue,
  useJukeboxState,
  useQueueMutations,
  useSpeakers,
  useToggleFavorite,
  type QueueTrackInput,
} from '../../data/hooks'
import { useLive } from '../../data/live'
import { fetchCollection } from '../../lib/musicAgent'
import {
  collectionTrackToTrack,
  favoriteToCollection,
  favoriteToTrack,
  nowPlayingToTrack,
  queueItemToTrack,
  recentToCollection,
  trackMeta,
} from '../../lib/jukeboxMedia'

/*
 * Live jukebox state:
 *  - favorites ← jukebox_favorites (Realtime)
 *  - queue ← jukebox_queue (Realtime)
 *  - now playing / volume / speaker ← jukebox_state (Realtime)
 *  - play/pause/next/… ← jukebox_commands (music-agent)
 */

export interface PlayerState {
  current: string | null
  /** Queue row ids in order (metadata comes from the queue query). */
  queue: string[]
  from: string | null
  playing: boolean
  positionMs: number
  positionAt: number
  speakerId: string
  volume: number // 0–10
  shuffle: boolean
  repeat: boolean
  durationMs: number
  track: Track | undefined
}

const toQueueInput = (t: Track): QueueTrackInput => ({
  spotifyUri: t.uri,
  title: t.title,
  subtitle: t.artist,
  imageUrl: t.art.url,
  durationMs: t.durationMs || undefined,
})

const collectionPayload = (c: Collection, opts: { startUri?: string; shuffle?: boolean } = {}) => ({
  contextUri: c.uri,
  title: c.title,
  subtitle: c.subtitle,
  imageUrl: c.art.url,
  kind: c.kind,
  startUri: opts.startUri,
  shuffle: opts.shuffle ?? false,
})

export function useJukebox() {
  const speakers = useSpeakers()
  const favoritesQuery = useFavorites()
  const queueQuery = useJukeboxQueue()
  const state = useJukeboxState()
  const command = useJukeboxCommand()
  const toggleFav = useToggleFavorite()
  const queueMut = useQueueMutations()

  useLive('speakers', 'speakers')
  useLive('jukebox_state', 'jukeboxState')
  useLive('jukebox_favorites', 'jukeboxFavorites')
  useLive('jukebox_queue', 'jukeboxQueue')

  const [speakerId, setSpeakerId] = useState<string | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>()
  const advanceSent = useRef<string | null>(null)
  /** Block end-of-song advance briefly after play — queue Realtime can arrive before now-playing. */
  const playGraceUntil = useRef(0)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    void command.mutateAsync({ type: 'refresh_speakers' }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  const speakerList = speakers.data ?? []
  const favorites = favoritesQuery.data ?? []
  const queueRows = useMemo(
    () => [...(queueQuery.data ?? [])].sort((a, b) => a.position - b.position),
    [queueQuery.data],
  )
  const live = state.data

  useEffect(() => {
    if (speakerId) return
    const next = live?.speakerId ?? speakerList.find((s) => s.available)?.id ?? speakerList[0]?.id ?? null
    if (next) setSpeakerId(next)
  }, [speakerId, live?.speakerId, speakerList])

  const send = useCallback(
    (type: Parameters<typeof command.mutate>[0]['type'], payload?: Json, sid = speakerId) => {
      void command.mutateAsync({ type, speakerId: sid, payload: payload ?? {} }).catch((err) => {
        console.error('[hub] jukebox', err)
        flash(err instanceof Error ? err.message : 'Playback failed')
      })
    },
    [command, speakerId, flash],
  )

  const npTrack = useMemo(() => {
    const fromState = nowPlayingToTrack(live?.nowPlaying)
    if (fromState && live?.durationMs) return { ...fromState, durationMs: live.durationMs }
    return fromState
  }, [live?.nowPlaying, live?.durationMs])

  const player: PlayerState = {
    current: live?.nowPlaying?.uri ?? null,
    queue: queueRows.map((q) => q.id),
    from,
    playing: live?.isPlaying ?? false,
    positionMs: live?.progressMs ?? 0,
    positionAt: Date.now(),
    speakerId: speakerId ?? '',
    volume: Math.round((live?.volume ?? 40) / 10),
    shuffle: live?.shuffle ?? false,
    repeat: (live?.repeat ?? 'off') !== 'off',
    durationMs: live?.durationMs ?? npTrack?.durationMs ?? 0,
    track: npTrack,
  }

  // progressMs is only refreshed ~every 5s; extrapolate so end-of-song timing stays honest.
  // Cap by wall-clock since the URI changed — otherwise a stale high progress_ms from the
  // previous song (common right after play/advance) schedules advance in a few hundred ms
  // and burns through the album queue.
  const progressSnap = useRef({ uri: null as string | null, ms: 0, at: 0 })
  const trackStartedAt = useRef({ uri: null as string | null, at: 0 })
  useEffect(() => {
    if (player.current !== trackStartedAt.current.uri) {
      trackStartedAt.current = { uri: player.current, at: Date.now() }
      progressSnap.current = { uri: player.current, ms: 0, at: Date.now() }
      return
    }
    const onTrackMs = Date.now() - trackStartedAt.current.at
    // Early after a track change, huge position values are almost always leftover state.
    const ms =
      onTrackMs < 15_000 && player.positionMs > Math.max(30_000, player.durationMs * 0.2)
        ? 0
        : player.positionMs
    progressSnap.current = { uri: player.current, ms, at: Date.now() }
  }, [player.current, player.positionMs, player.playing, player.durationMs])

  const elapsedMs = () => {
    const snap = progressSnap.current
    if (!player.playing || !player.current || snap.uri !== player.current) return 0
    const raw = snap.ms + (Date.now() - snap.at)
    const wall = Date.now() - trackStartedAt.current.at
    return Math.min(player.durationMs || Infinity, raw, wall + 2_000)
  }

  // Reset dedupe when the track changes so the next song can auto-advance once.
  useEffect(() => {
    advanceSent.current = null
  }, [player.current])

  // When the song ends, pop the app queue. Skip when Up next is empty: either the
  // last app-owned track (Spotify stops) or a context playlist (Spotify advances).
  // Sending advance with an empty queue used to pause and kill the next song.
  useEffect(() => {
    if (!player.playing || !player.current || !player.durationMs) return
    if (!queueRows.length) return

    const trackUri = player.current
    const snap = progressSnap.current
    const rawElapsed =
      snap.uri === trackUri ? snap.ms + (Date.now() - snap.at) : 0
    const wallElapsed =
      trackStartedAt.current.uri === trackUri
        ? Date.now() - trackStartedAt.current.at
        : 0
    const elapsed = Math.min(rawElapsed, wallElapsed + 2_000)
    const remaining = player.durationMs - elapsed
    // Never trust a sub-5s remaining in the first 20s of a track — that's the stale-progress bug.
    let delay =
      wallElapsed < 20_000 && remaining < 5_000
        ? Math.max(5_000, player.durationMs - wallElapsed) + 200
        : Math.max(0, remaining) + 200
    // Queue often updates (Realtime) before now-playing after a new play/album.
    // Advancing then would skip the track we just started.
    const graceLeft = playGraceUntil.current - Date.now()
    if (graceLeft > 0) delay = Math.max(delay, graceLeft)

    const id = window.setTimeout(() => {
      if (Date.now() < playGraceUntil.current) return
      if (advanceSent.current === trackUri) return
      advanceSent.current = trackUri
      send('advance')
    }, delay)
    return () => window.clearTimeout(id)
  }, [player.playing, player.current, player.durationMs, player.positionMs, queueRows.length, send])

  const resolveTrack = useCallback(
    (uri: string): Track | undefined => {
      const fav = favorites.find((f) => f.spotifyUri === uri && f.kind === 'track')
      if (fav) return favoriteToTrack(fav)
      const q = queueRows.find((row) => row.spotifyUri === uri)
      if (q) return queueItemToTrack(q)
      if (npTrack?.uri === uri) return npTrack
      return undefined
    },
    [favorites, queueRows, npTrack],
  )

  const actions = useMemo(() => ({
    playTrack: (track: Track | string) => {
      const t = typeof track === 'string' ? resolveTrack(track) : track
      if (!t) return
      setFrom(null)
      playGraceUntil.current = Date.now() + 10_000
      advanceSent.current = null
      send('play', { uri: t.uri })
    },
    playCollection: (c: Collection, opts: { startUri?: string; shuffle?: boolean } = {}) => {
      setFrom(c.title)
      playGraceUntil.current = Date.now() + 10_000
      advanceSent.current = null
      send('play', collectionPayload(c, opts))
      flash(opts.shuffle ? `Shuffling “${c.title}”` : `Playing “${c.title}”`)
    },
    playSearchHit: (hit: SearchHit) => {
      playGraceUntil.current = Date.now() + 10_000
      advanceSent.current = null
      if (hit.kind === 'track') {
        setFrom(null)
        send('play', { uri: hit.uri })
        return
      }
      setFrom(hit.title)
      send('play', {
        contextUri: hit.uri,
        title: hit.title,
        subtitle: hit.subtitle,
        imageUrl: hit.imageUrl,
        kind: hit.kind,
        shuffle: false,
      })
    },
    playNext: (track: Track | string) => {
      const t = typeof track === 'string' ? resolveTrack(track) : track
      if (!t) return
      void queueMut.add.mutateAsync({ track: toQueueInput(t), atFront: true })
      flash(`“${t.title}” plays next`)
    },
    addToQueue: (track: Track | string) => {
      const t = typeof track === 'string' ? resolveTrack(track) : track
      if (!t) return
      void queueMut.add.mutateAsync({ track: toQueueInput(t) })
      flash(`Added “${t.title}” to the queue`)
    },
    addAllToQueue: (c: Collection) => {
      void (async () => {
        try {
          const collection = await fetchCollection(c.uri)
          const tracks = collection.tracks.map(collectionTrackToTrack)
          if (!tracks.length) {
            flash(`Spotify doesn’t share this playlist’s tracks`)
            return
          }
          void queueMut.replaceAll.mutateAsync([
            ...queueRows.map((q) => asQueue(q)),
            ...tracks.filter((t) => t.uri !== player.current).map(toQueueInput),
          ])
          flash(`Added ${c.title} to the queue`)
        } catch (err) {
          flash(err instanceof Error ? err.message : 'Couldn’t load songs')
        }
      })()
    },
    playFromQueue: (i: number) => {
      const row = queueRows[i]
      if (!row) return
      const rest = queueRows.filter((_, k) => k !== i).map(asQueue)
      void queueMut.replaceAll.mutateAsync(rest)
      playGraceUntil.current = Date.now() + 10_000
      advanceSent.current = null
      send('play', { uri: row.spotifyUri })
    },
    moveUp: (i: number) => {
      const row = queueRows[i]
      if (!row) return
      void queueMut.moveUp.mutateAsync(row.id)
    },
    remove: (i: number) => {
      const row = queueRows[i]
      if (!row) return
      void queueMut.remove.mutateAsync(row.id)
    },
    clearQueue: () => {
      void queueMut.clear.mutateAsync()
    },
    toggle: () => send(player.playing ? 'pause' : 'resume'),
    next: () => {
      if (queueRows.length) send('advance')
      else send('skip')
    },
    prev: () => send('previous'),
    setSpeaker: (id: string) => {
      const sp = speakerList.find((x) => x.id === id)
      if (sp && !sp.available) flash(`${sp.name} speaker is asleep — wake it, then try again`)
      setSpeakerId(id)
      send('transfer', {}, id)
    },
    volume: (delta: number) => {
      const next = Math.max(0, Math.min(100, (live?.volume ?? 40) + delta * 10))
      send('volume', { volume: next })
    },
    toggleShuffle: () => send('shuffle', { state: !player.shuffle }),
    toggleRepeat: () => send('repeat', { state: player.repeat ? 'off' : 'context' }),
    toggleFavorite: (
      uri: string,
      kind: MediaKind,
      meta?: { title: string; subtitle?: string; albumTitle?: string; imageUrl?: string; durationMs?: number; trackCount?: number; isOwned?: boolean },
    ) => {
      const existing = favorites.find((f) => f.spotifyUri === uri)
      const title = meta?.title ?? existing?.title ?? resolveTrack(uri)?.title ?? 'Item'
      void toggleFav
        .mutateAsync({
          uri,
          kind,
          title,
          subtitle: meta?.subtitle ?? existing?.subtitle,
          albumTitle: meta?.albumTitle ?? existing?.albumTitle,
          imageUrl: meta?.imageUrl ?? existing?.imageUrl,
          durationMs: meta?.durationMs ?? existing?.durationMs,
          trackCount: meta?.trackCount ?? existing?.trackCount,
          isOwned: meta?.isOwned ?? existing?.isOwned,
        })
        .then((r) => flash(r.removed ? `Removed “${r.title}” from favorites` : `Saved “${r.title}” to favorites`))
        .catch((err) => flash(err instanceof Error ? err.message : 'Couldn’t update favorites'))
    },
  }), [
    resolveTrack, send, queueMut, flash, queueRows, player.current, player.playing, player.shuffle, player.repeat,
    speakerList, live?.volume, favorites, toggleFav,
  ])

  const favoriteUris = useMemo(() => new Set(favorites.map((f) => f.spotifyUri)), [favorites])

  const songs = useMemo(
    () => favorites.filter((f) => f.kind === 'track').map(favoriteToTrack),
    [favorites],
  )
  const albums = useMemo(
    () => favorites.filter((f) => f.kind === 'album').map(favoriteToCollection),
    [favorites],
  )
  const playlists = useMemo(
    () => favorites.filter((f) => f.kind === 'playlist').map(favoriteToCollection),
    [favorites],
  )
  const recent = useMemo(
    () => (live?.recent ?? []).map(recentToCollection),
    [live?.recent],
  )
  const queueTracks = useMemo(() => queueRows.map(queueItemToTrack), [queueRows])

  const ready = Boolean(speakers.data && favoritesQuery.data && queueQuery.data && state.data)

  return {
    ready,
    player,
    elapsedMs,
    favorites,
    songs,
    albums,
    playlists,
    recent,
    queueTracks,
    speakers: speakerList,
    isFavorite: (uri: string) => favoriteUris.has(uri),
    toast,
    trackMeta,
    ...actions,
  }
}

const asQueue = (q: { spotifyUri: string; title: string; subtitle?: string; imageUrl?: string; durationMs?: number }): QueueTrackInput => ({
  spotifyUri: q.spotifyUri,
  title: q.title,
  subtitle: q.subtitle,
  imageUrl: q.imageUrl,
  durationMs: q.durationMs,
})

export type Jukebox = ReturnType<typeof useJukebox>
