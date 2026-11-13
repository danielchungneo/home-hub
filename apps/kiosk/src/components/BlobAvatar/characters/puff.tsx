import type { BlobCharacterProps } from '../types'

/**
 * Puff — a cloud-soft dreamer made from five round little billows.
 * Personality: Dreamy and cheerful; celebrates the smallest wins.
 */
export function PuffCharacter({
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
        d="M22.2 57.8C13.1 49.3 17.9 36.1 29.6 35.2C33.7 25.4 45.7 20.5 55.7 25.6C64.1 22.8 72.7 29.2 72.6 38.5C82.5 41.4 86.9 52.0 79.6 60.7C83.8 72.0 73.4 80.7 61.2 76.4C52.9 83.1 42.9 81.3 37.7 75.5C27.0 78.3 17.8 68.8 22.2 57.8Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle
          cx="43.0"
          cy="51.2"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="58.0"
          cy="50.6"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M47.7 58.0Q51.2 61.8 54.9 57.8"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
