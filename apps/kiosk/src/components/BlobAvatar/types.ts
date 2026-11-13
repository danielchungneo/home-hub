/** Family member colorways — named token or custom `#RRGGBB`. */
export type BlobColorway = string

/**
 * Planned blob cast. Only `pebble` ships today; the rest are reserved so
 * character IDs stay stable when artwork is added.
 */
export const BLOB_CHARACTER_IDS = [
  'pebble',
  'mochi',
  'sprout',
  'puddle',
  'nib',
  'puff',
  'tater',
  'wisp',
  'dumplin',
  'jam',
  'clover',
  'tufty',
] as const

export type BlobCharacterId = (typeof BLOB_CHARACTER_IDS)[number]

const CHARACTER_SET = new Set<string>(BLOB_CHARACTER_IDS)

/** Old ids that still may live on member rows. */
const CHARACTER_ALIASES: Record<string, BlobCharacterId> = {
  button: 'dumplin',
}

/** Coerce a stored avatar string into a known character id (default pebble). */
export function parseBlobCharacter(value: string | null | undefined): BlobCharacterId {
  if (!value) return 'pebble'
  if (CHARACTER_SET.has(value)) return value as BlobCharacterId
  return CHARACTER_ALIASES[value] ?? 'pebble'
}

/** Characters with artwork registered and selectable in Profiles. */
export const AVAILABLE_BLOB_CHARACTERS: readonly BlobCharacterId[] = BLOB_CHARACTER_IDS

/** One-shot motions. `idle` draws the character at rest. */
export type BlobAnimation =
  | 'idle'
  | 'squish'
  | 'hop'
  | 'blink'
  | 'wiggle'
  | 'nod'
  | 'celebrate'

export interface BlobAvatarProps {
  /** Which blob to draw. Defaults to pebble; unimplemented IDs fall back to pebble. */
  character?: BlobCharacterId
  /** Member colorway (deep fill + optional tint ring). */
  colorway?: BlobColorway
  /** Diameter in CSS pixels. Recommended: 28, 48, 64, 96, 200. */
  size?: number
  /** One-shot motion to play. Retrigger with a new `animationKey`. */
  animation?: BlobAnimation
  /** Bump this to replay the same `animation`. */
  animationKey?: number | string
  /** Soft member-tint circle behind the blob. */
  showBackground?: boolean
  onClick?: () => void
  className?: string
  /** Accessible name, e.g. "Daniel's Pebble avatar". */
  ariaLabel?: string
  /** Hide from the accessibility tree when a parent already names the control. */
  decorative?: boolean
}

/** Shared props each character SVG receives from BlobAvatar. */
export interface BlobCharacterProps {
  animation: BlobAnimation
  motionRun: number
  /** Scales facial features so 28px stays readable. */
  faceScale: number
  className?: string
  eyesClassName?: string
}
