import type { BlobCharacterProps } from '../types'

/**
 * Nib — a tall, slightly drippy homebody with a snug little cap.
 * Personality: Thoughtful and cozy; always remembers the little things.
 */
export function NibCharacter({
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
        d="M33.0 31.9C36.0 25.3 48.1 22.5 58.3 25.1C69.3 27.8 72.4 40.4 73.0 51.8L74.9 72.0C75.5 80.2 68.8 83.1 63.5 78.2L57.7 72.9C54.7 70.1 52.5 72.9 49.4 78.0C45.3 84.8 40.4 83.0 37.5 76.4C34.9 70.2 32.7 72.7 28.2 77.5C22.4 83.8 16.4 78.1 19.2 70.7L28.0 43.9C29.3 39.6 30.7 35.4 33.0 31.9Z"
        fill="var(--member, var(--moss))"
      />
      <path
        d="M30.6 34.9C35.9 22.0 58.6 18.0 70.1 31.6C70.8 32.8 70.1 34.1 68.9 34.2C57.2 31.7 45.4 32.7 33.3 37.1C31.6 37.7 30.0 36.9 30.6 34.9Z"
        fill="var(--color-ink)"
      />
      <g className={eyesClassName}>
        <circle
          cx="44.3"
          cy="48.7"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="59.0"
          cy="48.4"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M48.9 56.0Q52.2 59.4 55.3 55.9"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
