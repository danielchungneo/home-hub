import type { IconName } from '../../components/Icon'
import type { CardioKind, Feel } from '../../types'
import s from './Workout.module.css'

export const CARDIO_ICON: Record<CardioKind, IconName> = { run: 'shoe', walk: 'stroller', bike: 'bike', swim: 'droplet' }

/** The 3-button check-in after a workout. Stored on the activity; the coach reads it. */
export const FEELS: { id: Feel; label: string }[] = [{ id: 'easy', label: 'Easy' }, { id: 'right', label: 'Just right' }, { id: 'hard', label: 'Hard' }]

/** Gold star (stars are the family's points). */
export function Star({ size = 18 }: { size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={s.star}><path d="M12 3l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L2.9 9.7l6.3-.9z" /></svg>
}
