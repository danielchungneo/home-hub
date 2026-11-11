import { memo } from 'react'
import type { FoodPhoto as Photo } from '@hub/shared'

/**
 * A recipe photo. Shows the real image when `photo.url` exists (store it resized to
 * the largest size it is shown at — 560×392 — as WebP), otherwise draws a plate in the
 * recipe's palette. Palette colors are content, like album art: they are the one place
 * raw hex is allowed outside tokens.css.
 */
const PLATE = { fill: 'var(--color-paper)' }

export const FoodPhoto = memo(function FoodPhoto({ photo, alt = '', className, variant = 0 }: {
  photo: Photo
  alt?: string
  className?: string
  /** Nudges the food so neighbouring placeholders don't look identical. */
  variant?: number
}) {
  if (photo.url) {
    return <img className={className} src={photo.url} alt={alt} loading="lazy" decoding="async" draggable={false} style={{ objectFit: 'cover' }} />
  }
  const [table, f1, f2, f3] = photo.palette
  return (
    <svg className={className} viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <rect width="100" height="70" fill={table} />
      <rect y="54" width="100" height="16" style={{ fill: 'var(--color-surface)' }} opacity=".22" />
      <circle cx="50" cy="35" r="27" style={PLATE} />
      <circle cx="50" cy="35" r="21" style={{ fill: 'var(--color-surface-sunken)' }} />
      <circle cx={42 + (variant % 3) * 2} cy="31" r="10" fill={f1} />
      <circle cx="57" cy="38" r="8" fill={f2} />
      <circle cx="46" cy="43" r="6" fill={f3} />
      <rect x="84" y="12" width="3" height="44" rx="1.5" style={PLATE} opacity=".85" />
      <rect x="12" y="14" width="3" height="40" rx="1.5" style={PLATE} opacity=".85" />
    </svg>
  )
})
