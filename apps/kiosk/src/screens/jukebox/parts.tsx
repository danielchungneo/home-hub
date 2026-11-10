import type { CSSProperties } from 'react'
import { IconButton } from '../../components/Button'
import { trackTime } from '../../lib/jukeboxMedia'
import type { ArtSwatch, Artwork, Collection, Track } from '@hub/shared'
import s from './Jukebox.module.css'

/** Expose an artwork's colors as CSS variables (--art-bg / --art-fg) for tinted surfaces. */
export const artVars = (art: Artwork | undefined): CSSProperties =>
  (art ? { '--art-bg': art.swatch.bg, '--art-fg': art.swatch.fg } : {}) as CSSProperties

function Swatch({ sw, size }: { sw: ArtSwatch; size: number | string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width={size} height={size}>
      <rect width="100" height="100" fill={sw.bg} />
      <circle cx={sw.cx} cy={sw.cy} r={sw.r} fill={sw.fg} />
      <rect y={sw.band} width="100" height="7" fill={sw.fg} opacity=".35" />
    </svg>
  )
}

/**
 * Cover art. Uses the Spotify image URL when present; otherwise draws a placeholder swatch.
 */
export function Cover({ item, size = '100%' }: { item: Track | Collection; size?: number | string }) {
  if (item.art.url) {
    return <img src={item.art.url} alt="" width={size} height={size} loading="lazy" decoding="async" className={s.coverImg} />
  }
  return <Swatch sw={item.art.swatch} size={size} />
}

/** Three bouncing bars; freezes in place when paused. */
export function Equalizer({ playing, label = 'Now playing' }: { playing: boolean; label?: string }) {
  return (
    <span className={playing ? s.eq : `${s.eq} ${s.eqPaused}`} role="img" aria-label={playing ? label : 'Paused'}>
      <span /><span /><span />
    </span>
  )
}

export function FavoriteButton({ on, title, onToggle }: { on: boolean; title: string; onToggle: () => void }) {
  return (
    <IconButton
      icon={on ? 'heart-solid' : 'heart'}
      label={on ? `Remove ${title} from favorites` : `Save ${title} to favorites`}
      aria-pressed={on}
      round={false}
      className={on ? s.favOn : undefined}
      onClick={onToggle}
    />
  )
}

interface TrackRowProps {
  track: Track
  index: number
  isCurrent: boolean
  playing: boolean
  showAlbum?: boolean
  onPlay: () => void
  onPlayNext: () => void
  onQueue: () => void
}

/** A song row: number (or equalizer) · art + title · album · time · Play next · Add to queue. */
export function TrackRow({ track, index, isCurrent, playing, showAlbum = true, onPlay, onPlayNext, onQueue }: TrackRowProps) {
  return (
    <div className={[s.row, showAlbum ? s.rowWithAlbum : s.rowNoAlbum, isCurrent && s.rowCurrent].filter(Boolean).join(' ')}>
      <span className={s.rowNum}>{isCurrent ? <Equalizer playing={playing} /> : index + 1}</span>
      <button type="button" className={s.rowMain} aria-label={`Play ${track.title}`} onClick={onPlay}>
        <span className={s.rowArt}><Cover item={track} size={56} /></span>
        <span className={s.rowText}>
          <span className={s.rowTitle}>{track.title}</span>
          <span className={s.rowSub}>{track.artist}</span>
        </span>
      </button>
      {showAlbum && <span className={s.rowAlbum}>{track.album}</span>}
      <span className={s.rowTime}>{trackTime(track.durationMs)}</span>
      <span className={s.rowActions}>
        <IconButton icon="play-next" label={`Play ${track.title} next`} round={false} onClick={onPlayNext} />
        <IconButton icon="queue-add" label={`Add ${track.title} to queue`} round={false} onClick={onQueue} />
      </span>
    </div>
  )
}
