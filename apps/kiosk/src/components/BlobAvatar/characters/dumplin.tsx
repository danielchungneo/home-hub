import type { BlobCharacterProps } from '../types'

/**
 * Dumplin — a little bao dumpling with a pinched top.
 * Personality: Warm, cozy, and happiest when sharing a meal with family.
 */
export function DumplinCharacter({
  animation,
  motionRun,
  faceScale,
  className,
  eyesClassName,
}: BlobCharacterProps) {
  const eyeR = 1.8 * faceScale
  const strokeW = 1.8 * faceScale
  const pleatW = 1.35 * faceScale

  return (
    <g key={`${animation}:${motionRun}`} className={className}>
      {/* Squat bao body with a gathered knot at the crown. */}
      <path
        d="M50 14C54 14 57 18 59 24C68 27 82 38 82 55C82 72 68 84 50 84C32 84 18 72 18 55C18 38 32 27 41 24C43 18 46 14 50 14Z"
        fill="var(--member, var(--moss))"
      />
      {/* Dough pleats — sit on the crown, not above it. */}
      <path
        d="M50 29Q50 34 50 40"
        stroke="var(--color-ink)"
        strokeWidth={pleatW}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M46 30Q43 35 40 40"
        stroke="var(--color-ink)"
        strokeWidth={pleatW}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M54 30Q57 35 60 40"
        stroke="var(--color-ink)"
        strokeWidth={pleatW}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M43 29Q39 33 36 38"
        stroke="var(--color-ink)"
        strokeWidth={pleatW}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M57 29Q61 33 64 38"
        stroke="var(--color-ink)"
        strokeWidth={pleatW}
        strokeLinecap="round"
        fill="none"
      />
      <g className={eyesClassName}>
        <circle cx="42" cy="54" r={eyeR} fill="var(--color-ink)" />
        <circle cx="58" cy="54" r={eyeR} fill="var(--color-ink)" />
      </g>
      <path
        d="M46.5 61Q50 64.5 53.5 61"
        stroke="var(--color-ink)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
