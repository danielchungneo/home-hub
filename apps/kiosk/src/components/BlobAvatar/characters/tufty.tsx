import type { BlobCharacterProps } from '../types'

/**
 * Tufty — a shy teardrop with a playful three-pronged hair tuft.
 * Personality: Quietly playful and a little quirky; opens up with a smile.
 */
export function TuftyCharacter({
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
        d="M47.0 30.3C44.6 25.9 42.2 20.2 45.3 17.3C49.7 13.6 53.4 21.1 53.8 25.0C55.7 19.5 58.8 15.4 62.5 17.1C67.4 19.5 62.6 25.8 59.8 28.8C65.2 25.8 71.0 25.1 72.7 28.9C74.7 33.5 66.1 35.3 62.9 38.4C73.8 48.5 80.8 58.4 77.1 69.3C73.6 79.2 62.8 82.0 49.9 81.8C35.0 81.7 22.5 75.1 22.4 63.4C22.2 52.3 33.0 41.5 47.0 30.3Z"
        fill="var(--member, var(--moss))"
      />
      <g className={eyesClassName}>
        <circle
          cx="44.3"
          cy="56.1"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="59.3"
          cy="55.9"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M49.1 63.3Q52.4 66.2 55.6 63.0"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
