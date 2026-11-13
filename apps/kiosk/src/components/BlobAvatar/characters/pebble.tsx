import type { BlobCharacterProps } from '../types'

/**
 * Pebble — asymmetric river-stone silhouette.
 */
export function PebbleCharacter({
  animation,
  motionRun,
  faceScale,
  className,
  eyesClassName,
}: BlobCharacterProps) {
  const eyeR = 1.8 * faceScale
  const strokeW = 1.8 * faceScale

  return (
    <g key={`${animation}:${motionRun}`} className={className}>
      <path
        fill="var(--member, var(--moss))"
        d="M19.5 60.9C15.4 48.4 19.8 33.8 30.7 27.2C39.1 22.1 51.5 21.0 61.9 24.4C73.3 28.1 80.1 37.4 81.5 49.4C83.0 62.4 76.9 73.7 64.8 78.2C55.7 81.6 42.4 80.2 33.4 76.9C26.5 74.3 22.1 68.7 19.5 60.9Z"
      />
      <g className={eyesClassName}>
        <circle cx="43.4" cy="49.6" r={eyeR} fill="var(--color-ink)" />
        <circle cx="58.4" cy="49.0" r={eyeR} fill="var(--color-ink)" />
      </g>
      <path
        d="M48.0 56.1Q51.3 59.3 54.6 55.8"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
    </g>
  )
}
