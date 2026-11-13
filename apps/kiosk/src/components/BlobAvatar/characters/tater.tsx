import type { BlobCharacterProps } from '../types'

/**
 * Tater — a friendly, lopsided little potato with a big heart.
 * Personality: Dependable, good-humored, and quietly full of surprises.
 */
export function TaterCharacter({
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
        d="M19.9 60.1C20.9 50.5 27.9 48.4 30.0 36.9C32.4 24.0 43.1 20.4 53.4 25.1C60.1 28.3 60.9 36.9 67.6 38.3C78.5 40.6 84.0 49.6 81.1 60.6C79.1 68.5 76.2 76.3 65.9 77.5C57.7 78.5 51.2 74.3 44.4 77.1C30.3 82.9 17.7 74.0 19.9 60.1Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle
          cx="43.4"
          cy="52.0"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="58.6"
          cy="50.3"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M48.4 58.4Q52.1 62.1 55.5 58.0"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
