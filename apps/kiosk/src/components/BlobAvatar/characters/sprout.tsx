import type { BlobCharacterProps } from '../types'

/**
 * Sprout — a curious little seed-drop with one brave leaf.
 * Personality: Curious and optimistic; always ready to try something new.
 */
export function SproutCharacter({
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
        d="M49.9 19.5C51.0 27.2 43.1 33.2 35.7 40.3C25.8 49.1 20.3 59.9 24.2 69.3C28.3 79.2 40.6 82.5 52.2 82.0C66.1 81.4 75.8 72.4 75.3 60.4C74.9 48.8 65.9 39.8 58.4 32.7C53.9 28.6 52.9 23.6 49.9 19.5Z"
        fill="var(--member, var(--moss))"
      />
      <path
        d="M51.0 25.3C52.6 17.0 60.7 13.9 67.6 16.0C65.7 23.3 59.3 28.0 51.0 25.3Z"
        fill="var(--color-ink)"
      />
      <g className={eyesClassName}>
        <circle
          cx="43.2"
          cy="53.0"
          r={eyeR}
          fill="var(--color-ink)"
        />
        <circle
          cx="58.2"
          cy="52.1"
          r={eyeR}
          fill="var(--color-ink)"
        />
      </g>
      <path
        d="M47.7 59.4Q51.1 62.8 54.5 59.1"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
