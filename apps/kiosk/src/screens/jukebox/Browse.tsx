import { useEffect, useState, type CSSProperties } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Label } from '../../components/primitives'
import { searchMusic } from '../../lib/musicAgent'
import {
  favoriteToCollection,
  favoriteToTrack,
  searchHitToCollection,
  searchHitToTrack,
} from '../../lib/jukeboxMedia'
import type { Collection, MediaKind, SearchHit, Track } from '@hub/shared'
import { Cover, FavoriteButton, TrackRow } from './parts'
import type { Jukebox } from './useJukebox'
import s from './Jukebox.module.css'

const TILTS = [-2, 1.5, -1, 2, -1.5, 1, -0.5, 2.5, -2.5, 0.8, -1.2, 1.8, -0.8, 1.2]

const trackProps = (jb: Jukebox, t: Track, i: number, list?: Collection) => ({
  track: t,
  index: i,
  isCurrent: jb.player.current === t.uri,
  playing: jb.player.playing,
  onPlay: () => (list ? jb.playCollection(list, { startUri: t.uri }) : jb.playTrack(t)),
  onPlayNext: () => jb.playNext(t),
  onQueue: () => jb.addToQueue(t),
})

const favMeta = (kind: MediaKind, item: Track | Collection) =>
  kind === 'track'
    ? {
        title: (item as Track).title,
        subtitle: (item as Track).artist,
        albumTitle: (item as Track).album,
        imageUrl: item.art.url,
        durationMs: (item as Track).durationMs,
      }
    : {
        title: (item as Collection).title,
        subtitle: (item as Collection).subtitle,
        imageUrl: item.art.url,
        trackCount: (item as Collection).trackCount,
      }

/* ---------------- Songs: "Jump back in" + favorited songs ---------------- */
export function SongsView({ jb, tracks, recent, onPick, onOpen }: {
  jb: Jukebox; tracks: Track[]; recent: Collection[]; onPick: (c: Collection) => void; onOpen: (c: Collection) => void
}) {
  return (
    <div className={s.songs}>
      {recent.length > 0 && (
        <section aria-label="Jump back in" className={s.jump}>
          <Label>Jump back in</Label>
          <div className={s.jumpGrid}>
            {recent.map((c) => (
              <div key={c.uri} className={s.jumpCard}>
                <button type="button" className={s.jumpArt} aria-label={`Open ${c.title}`} onClick={() => onOpen(c)}>
                  <Cover item={c} size={132} />
                </button>
                <div className={s.jumpText}>
                  <span className={s.kicker}>{c.kind === 'album' ? 'Album' : 'Playlist'}</span>
                  <span className={s.jumpTitle}>{c.title}</span>
                  <span className={s.jumpSub}>{c.subtitle}</span>
                  <button type="button" className={s.roundPlay} aria-label={`Play ${c.title}`} onClick={() => onPick(c)}>
                    <Icon name="play" size={22} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Favorite songs" className={`${s.panel} ${s.listPanel}`}>
        <div className={`${s.row} ${s.rowWithAlbum} ${s.rowHead}`} aria-hidden="true">
          <span>#</span><span>Favorite songs · {tracks.length}</span><span>Album</span><span className={s.right}>Time</span><span />
        </div>
        <div className={`${s.rows} scroll-y`}>
          {tracks.map((t, i) => <TrackRow key={t.uri} {...trackProps(jb, t, i)} />)}
          {!tracks.length && <EmptyFavorites kind="songs" />}
        </div>
      </section>
    </div>
  )
}

/* ---------------- Albums / Playlists: covers leaning on wall ledges ---------------- */
export function WallView({ items, kind, onPick, onOpen }: {
  items: Collection[]; kind: 'album' | 'playlist'; onPick: (c: Collection) => void; onOpen: (c: Collection) => void
}) {
  return (
    <section aria-label={kind === 'album' ? 'Album wall' : 'Playlist wall'} className={s.wall}>
      <span className={s.wallHint}>Tap a cover to put it on · swipe for more <Icon name="arrow-right" size={18} stroke={2.6} /></span>
      <div className={`${s.wallScroll} scroll-x`}>
        <div className={s.wallGrid}>
          {items.map((c, i) => (
            <div key={c.uri} className={s.wallCell}>
              <button type="button" className={s.wallCover} aria-label={`Play ${c.title}`} onClick={() => onPick(c)}
                style={{ '--tilt': `${TILTS[i % TILTS.length]}deg` } as CSSProperties}>
                <Cover item={c} size={230} />
                {c.kind === 'playlist' && !c.art.url && <span className={s.wallPlaylistLabel}>{c.title}</span>}
              </button>
              <div className={s.ledge} aria-hidden="true" />
              <button type="button" className={s.wallCaption} aria-label={`Show songs in ${c.title}`} onClick={() => onOpen(c)}>
                <span className={s.wallTitle}>{c.title}</span>
                <span className={s.wallSub}>{collectionMeta(c)}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      {!items.length && <div className={s.wallEmpty}><EmptyFavorites kind={kind === 'album' ? 'albums' : 'playlists'} /></div>}
    </section>
  )
}

const collectionMeta = (c: Collection) => {
  const n = c.trackCount ?? c.trackUris.length
  if (c.kind === 'album') return n ? `${c.subtitle} · ${n} ${n === 1 ? 'song' : 'songs'}` : c.subtitle
  return n ? `${n} songs` : c.subtitle
}

/* ---------------- Album / playlist detail ---------------- */
export function DetailView({ jb, c, onBack, onPick }: { jb: Jukebox; c: Collection; onBack: () => void; onPick: (c: Collection) => void }) {
  const tracks = c.trackUris.length
    ? c.trackUris.map((uri) => jb.songs.find((t) => t.uri === uri)).filter(Boolean) as Track[]
    : []
  return (
    <section aria-label={c.title} className={`${s.panel} ${s.detail}`}>
      <div className={s.detailHead}>
        <div className={s.detailArt}><Cover item={c} size={220} /></div>
        <div className={s.detailInfo}>
          <div className={s.detailText}>
            <Button variant="secondary" pill icon="chevron-left" className={s.back} onClick={onBack}>
              {c.kind === 'album' ? 'All albums' : 'All playlists'}
            </Button>
            <Label>{c.kind === 'album' ? 'Album' : 'Playlist'}</Label>
            <h2 className={s.detailTitle}>{c.title}</h2>
            <span className={s.detailMeta}>{collectionMeta(c)}</span>
          </div>
          <div className={s.detailActions}>
            <Button size="lg" pill icon="play" onClick={() => onPick(c)}>Play</Button>
            <Button size="lg" pill variant="secondary" icon="shuffle" disabled={!tracks.length} onClick={() => jb.playCollection(c, { shuffle: true })}>Shuffle</Button>
            <Button size="lg" pill variant="secondary" icon="queue-add" disabled={!tracks.length} onClick={() => jb.addAllToQueue(c)}>Add all to queue</Button>
            <FavoriteButton
              on={jb.isFavorite(c.uri)}
              title={c.title}
              onToggle={() => jb.toggleFavorite(c.uri, c.kind, favMeta(c.kind, c))}
            />
          </div>
        </div>
      </div>
      <div className={`${s.rows} ${s.detailRows} scroll-y`}>
        {tracks.map((t, i) => <TrackRow key={t.uri} showAlbum={false} {...trackProps(jb, t, i, c)} />)}
        {!tracks.length && (
          <p className={s.note}>
            Song lists come from Spotify for albums and playlists you own. You can still play this one; Spotify picks the tracks.
          </p>
        )}
      </div>
    </section>
  )
}

/* ---------------- Search: favorites first, then Spotify results you can favorite ---------------- */
type Result = { kind: MediaKind; item: Track | Collection; hit?: SearchHit }

export function SearchView({ jb, query, onPick, onOpen }: { jb: Jukebox; query: string; onPick: (c: Collection) => void; onOpen: (c: Collection) => void }) {
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setError(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const t = window.setTimeout(() => {
      void searchMusic(q)
        .then((results) => {
          if (cancelled) return
          setHits(results)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setHits([])
          setError(err instanceof Error ? err.message : 'Search failed')
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query])

  const q = query.trim().toLowerCase()
  const saved: Result[] = jb.favorites
    .filter((f) => {
      const hay = `${f.title} ${f.subtitle} ${f.albumTitle ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
    .map((f) => ({
      kind: f.kind,
      item: f.kind === 'track' ? favoriteToTrack(f) : favoriteToCollection(f),
    }))

  const more: Result[] = hits
    .filter((h) => !jb.isFavorite(h.uri))
    .map((h) => ({
      kind: h.kind,
      hit: h,
      item: h.kind === 'track' ? searchHitToTrack(h) : searchHitToCollection(h),
    }))

  const row = (x: Result) => {
    const isTrack = x.kind === 'track'
    const t = x.item as Track
    const c = x.item as Collection
    const meta = x.hit
      ? {
          title: x.hit.title,
          subtitle: x.hit.subtitle,
          albumTitle: x.hit.album,
          imageUrl: x.hit.imageUrl,
          durationMs: x.hit.durationMs,
          trackCount: x.hit.trackCount,
          isOwned: x.hit.owned,
        }
      : favMeta(x.kind, x.item)
    return (
      <div key={x.item.uri} className={s.result}>
        <button
          type="button"
          className={s.rowMain}
          aria-label={isTrack ? `Play ${t.title}` : `Open ${c.title}`}
          onClick={() => {
            if (isTrack) jb.playTrack(t)
            else if (x.hit) onOpen(searchHitToCollection(x.hit))
            else onOpen(c)
          }}
        >
          <span className={s.rowArt}><Cover item={x.item} size={56} /></span>
          <span className={s.rowText}>
            <span className={s.rowTitle}>{x.item.title}</span>
            <span className={s.rowSub}>{isTrack ? `${t.artist}${t.album ? ` · ${t.album}` : ''}` : c.subtitle}</span>
          </span>
        </button>
        <span className={s.kindBadge}>{x.kind === 'track' ? 'Song' : x.kind === 'album' ? 'Album' : 'Playlist'}</span>
        <span className={s.rowActions}>
          {isTrack
            ? <Button variant="secondary" icon="queue-add" onClick={() => jb.addToQueue(t)}>Queue</Button>
            : <Button variant="secondary" icon="play" onClick={() => (x.hit ? jb.playSearchHit(x.hit) : onPick(c))}>Play</Button>}
          <FavoriteButton
            on={jb.isFavorite(x.item.uri)}
            title={isTrack ? t.title : c.title}
            onToggle={() => jb.toggleFavorite(x.item.uri, x.kind, meta)}
          />
        </span>
      </div>
    )
  }

  return (
    <section aria-label={`Search results for ${query}`} className={`${s.panel} ${s.search}`}>
      <div className={`${s.rows} scroll-y`}>
        <Label className={s.searchLabel}>In your favorites · {saved.length}</Label>
        {saved.length ? saved.map(row) : <p className={s.note}>None of your favorites match “{query}”.</p>}
        <Label className={s.searchLabel}>From Spotify · tap the heart to add to your tabs</Label>
        {searching && <p className={s.note}>Searching…</p>}
        {!searching && error && <p className={s.note}>{error}</p>}
        {!searching && !error && (more.length ? more.map(row) : <p className={s.note}>No other matches on Spotify.</p>)}
      </div>
    </section>
  )
}

function EmptyFavorites({ kind }: { kind: 'songs' | 'albums' | 'playlists' }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyTitle}>No favorite {kind} yet</span>
      <span>Search above and tap the heart to save {kind} here.</span>
    </div>
  )
}
