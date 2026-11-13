import { useEffect, useState } from 'react'
import { memberColorProps } from '../../lib/colors'
import { resolveCharacter } from './characters'
import s from './BlobAvatar.module.css'
import type { BlobAnimation, BlobAvatarProps } from './types'

export type {
  BlobAnimation,
  BlobAvatarProps,
  BlobCharacterId,
  BlobColorway,
} from './types'
export { AVAILABLE_BLOB_CHARACTERS, BLOB_CHARACTER_IDS, parseBlobCharacter } from './types'

const MOTION_CLASS: Partial<Record<BlobAnimation, string>> = {
  squish: s.squish,
  hop: s.hop,
  wiggle: s.wiggle,
  nod: s.nod,
  celebrate: s.celebrate,
}

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
export function BlobAvatar({
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
  const [activeMotion, setActiveMotion] = useState<BlobAnimation>('idle')
  const [motionRun, setMotionRun] = useState(0)

  // Remount the character group whenever animation or key changes so the same
  // motion can replay without timers or Web Animations bookkeeping.
  useEffect(() => {
    setActiveMotion(animation)
    setMotionRun((n) => n + 1)
  }, [animation, animationKey])

  const Character = resolveCharacter(character)
  const clickable = typeof onClick === 'function'
  const colorProps = memberColorProps(colorway, { width: size, height: size })
  const motionClass = MOTION_CLASS[activeMotion]
  const eyesClass =
    activeMotion === 'blink' ? `${s.eyes} ${s.blink}` : s.eyes

  const svg = (
    <svg
      className={s.svg}
      aria-hidden="true"
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      focusable="false"
    >
      {showBackground && (
        <circle cx="50" cy="50" r="47" fill="var(--member-tint, var(--moss-tint))" />
      )}
      <Character
        animation={activeMotion}
        motionRun={motionRun}
        faceScale={faceScaleFor(size)}
        className={[s.character, motionClass].filter(Boolean).join(' ')}
        eyesClassName={eyesClass}
      />
    </svg>
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
}
