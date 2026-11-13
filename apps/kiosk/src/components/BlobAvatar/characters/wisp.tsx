import type { BlobCharacterProps } from '../types'

/**
 * Wisp — a soft upright bean with a centered face.
 * Personality: Quietly imaginative, observant, and wonderfully mellow.
 */
export function WispCharacter({
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
      {/* Fat upright bean — plenty of body under the face at every size. */}
      <path
        d="M50 18C66 18 78 32 78 48C78 64 68 80 50 82C32 80 22 64 22 48C22 32 34 18 50 18Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle cx="43.5" cy="46" r={eyeR} fill="var(--color-ink)" />
        <circle cx="56.5" cy="46" r={eyeR} fill="var(--color-ink)" />
      </g>
      <path
        d="M47.5 53Q50 56 52.5 53"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
