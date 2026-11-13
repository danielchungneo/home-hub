import type { BlobCharacterProps } from '../types'

/**
 * Mochi — a cozy dumpling who makes every moment feel a little softer.
 * Personality: Gentle, reassuring, and happiest when everyone is together.
 */
export function MochiCharacter({
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
        d="M18.2 56.4C15.8 44.3 23.2 34.9 34.4 32.3C44.1 30.0 52.2 22.6 63.1 24.8C75.9 27.4 83.5 39.2 82.7 51.8C81.9 64.7 71.6 76.0 58.5 78.9C46.6 81.5 30.2 78.1 23.5 69.8C20.5 66.1 19.1 61.2 18.2 56.4Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle
          cx="44.2"
          cy="49.2"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="59.2"
          cy="47.8"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M49.0 55.8Q52.5 59.2 55.8 55.2"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
