import type { BlobCharacterProps } from '../types'

/**
 * Jam — a sweet, slightly slumped dollop with a tiny star-shaped flourish.
 * Personality: Warm and generous; makes ordinary days feel special.
 */
export function JamCharacter({
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
        d="M19.2 61.6C18.7 47.4 29.7 41.0 40.3 38.9C49.0 37.3 51.8 24.5 61.0 24.2C70.5 23.8 72.2 37.4 74.4 43.9C76.3 50.1 82.6 53.3 81.5 63.8C80.3 75.1 67.8 79.6 52.5 79.2C35.5 78.8 19.7 75.2 19.2 61.6Z"
        fill="var(--member, var(--moss))"
      />
      <path
        d="M70.7 29.1L73.5 34.6L79.5 35.4L75.2 39.5L76.3 45.5L70.9 42.6L65.5 45.2L66.6 39.2L62.4 34.9L68.3 34.3Z"
        fill="var(--color-ink)"
      />
      <g className={eyesClassName}>
        <circle
          cx="43.9"
          cy="53.0"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="58.4"
          cy="52.8"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M48.5 60.0Q51.8 63.1 55.1 59.8"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
