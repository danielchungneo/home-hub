import { memo, useEffect, useRef } from 'react'
import { memberColorProps } from '../../lib/colors'
import { resolveCharacter } from './characters'
import s from './BlobAvatar.module.css'
import { playBlobMotion } from './motion'
import type { BlobAvatarProps } from './types'

export type {
  BlobAnimation,
  BlobAvatarProps,
  BlobCharacterId,
  BlobColorway,
} from './types'
export { AVAILABLE_BLOB_CHARACTERS, BLOB_CHARACTER_IDS, parseBlobCharacter } from './types'
/** Scale facial strokes so tiny assignee avatars stay readable on the Pi. */
function faceScaleFor(size: number) {
  if (size <= 28) return 1.7
  if (size <= 48) return 1.3
  return 1
}

/**
 * Soft blob avatar for family members. Artwork is per-character; colorways
 * reuse the hub's member palette via `data-color`.
 */
export const BlobAvatar = memo(function BlobAvatar({
  character = 'pebble',
  colorway = 'moss',
  size = 64,
  animation = 'idle',
  animationKey = 0,
  showBackground = true,
  onClick,
  className = '',
  ariaLabel = 'Pebble avatar',
  decorative = false,
}: BlobAvatarProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Replayed with Web Animations on the existing nodes: remounting the SVG per motion (the old
  // key trick) cost the Pi a style, layout and paint pass for the whole avatar every time.
  useEffect(() => {
    const run = playBlobMotion(svgRef.current, animation)
    return () => run?.cancel()
  }, [animation, animationKey])

  const Character = resolveCharacter(character)
  const clickable = typeof onClick === 'function'
  const colorProps = memberColorProps(colorway, { width: size, height: size })

  // Motions animate the outer <svg> (a CSS box the compositor can move) rather than a group
  // inside it, which Chromium re-styles, re-lays-out and repaints on the main thread every
  // frame. The tint disc is its own layer so it stays put while the character moves.
  const svg = (
    <>
      {showBackground && (
        <svg className={s.bg} aria-hidden="true" viewBox="0 0 100 100" focusable="false">
          <circle cx="50" cy="50" r="47" fill="var(--member-tint, var(--moss-tint))" />
        </svg>
      )}
      <svg
        ref={svgRef}
        className={s.svg}
        aria-hidden="true"
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        focusable="false"
      >
        <Character faceScale={faceScaleFor(size)} eyesClassName={s.eyes} />
      </svg>
    </>
  )

  const rootClass = [s.root, clickable && s.interactive, className].filter(Boolean).join(' ')

  if (clickable) {
    return (
      <button
        type="button"
        className={rootClass}
        {...colorProps}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {svg}
      </button>
    )
  }

  if (decorative) {
    return (
      <span className={rootClass} {...colorProps} aria-hidden="true">
        {svg}
      </span>
    )
  }

  return (
    <span className={rootClass} {...colorProps} role="img" aria-label={ariaLabel}>
      {svg}
    </span>
  )
})
