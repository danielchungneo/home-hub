import type { BlobCharacterProps } from '../types'

/**
 * Puddle — a relaxed little pool with an unhurried outlook.
 * Personality: Easygoing and patient; never in a rush to get anywhere.
 */
export function PuddleCharacter({
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
        d="M16.0 60.3C13.7 51.2 22.5 44.6 33.1 43.1C39.2 42.2 41.9 32.7 51.7 31.8C62.9 30.7 67.2 40.8 73.1 42.5C82.5 45.1 87.1 51.5 84.5 60.4C81.7 69.6 68.6 70.1 57.5 68.8C46.4 67.5 35.0 72.8 26.2 69.3C20.4 67.1 17.0 64.4 16.0 60.3Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle
          cx="44.6"
          cy="52.8"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="59.6"
          cy="52.3"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M51.0 59.7Q53.0 56.0 55.0 59.7Q53.0 63.0 51.0 59.7Z"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
