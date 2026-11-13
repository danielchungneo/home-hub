import type { BlobCharacterProps } from '../types'

/**
 * Clover — a soft four-lobed lucky charm with a serene smile.
 * Personality: Kind and hopeful; notices the good in everything.
 */
export function CloverCharacter({
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
        d="M25.5 57.5C17.6 52.7 19.6 41.5 28.0 37.5C33.9 34.8 38.4 37.2 42.2 29.6C47.0 20.0 61.8 21.3 67.3 30.9C70.4 36.4 68.3 42.1 75.3 46.3C84.7 52.0 81.6 66.0 71.7 69.0C65.9 70.7 64.2 77.5 54.7 79.2C45.0 80.8 40.5 73.0 34.3 73.5C24.6 74.2 18.5 64.3 25.5 57.5Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle
          cx="43.3"
          cy="52.6"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="58.3"
          cy="52.2"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M47.8 59.0Q51.4 62.7 55.0 58.8"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
