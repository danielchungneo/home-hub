// Mock data for the Workout coach. In the real app:
//   ACTIVITIES   → `activities` (last 30 days per person)
//   COACH_PLANS  → `coach_plans` for today, written each morning by the coach function
//   mockSwap()   → POST /functions/v1/coach-swap (asks the coach for an alternative)
// See docs/WORKOUT_COACH.md.
import type { Activity, ActivityKind, CoachPlan, SwapReason } from '../types'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

let n = 0
const a = (memberId: string, ago: number, kind: ActivityKind, title: string, minutes: number, distanceMi?: number, feel?: Activity['feel']): Activity =>
  ({ id: `a${++n}`, memberId, date: daysAgo(ago), kind, title, minutes, distanceMi, source: ago % 3 ? 'phone' : 'hub', feel })

/** Last 30 days. Daniel: runs 2–3×/week, push-heavy strength, skips legs. Shelby: lots of stroller walks, some mobility. */
export const ACTIVITIES: Activity[] = [
  a('daniel', 1, 'strength', 'Push + core', 25, undefined, 'right'),
  a('daniel', 2, 'run', 'Easy run', 31, 3.1, 'easy'),
  a('daniel', 4, 'run', 'Tempo run', 28, 3.0, 'hard'),
  a('daniel', 5, 'strength', 'Pull + core', 22, undefined, 'right'),
  a('daniel', 7, 'run', 'Long run', 52, 5.0, 'right'),
  a('daniel', 8, 'strength', 'Push + core', 24),
  a('daniel', 10, 'run', 'Easy run', 30, 3.0),
  a('daniel', 12, 'bike', 'Bike ride', 45, 11),
  a('daniel', 14, 'run', 'Easy run', 29, 3.0, 'easy'),
  a('daniel', 15, 'strength', 'Push + core', 26),
  a('daniel', 18, 'run', 'Intervals', 26, 2.8, 'hard'),
  a('daniel', 21, 'run', 'Long run', 48, 4.6),
  a('daniel', 22, 'strength', 'Full body', 30),
  a('daniel', 26, 'run', 'Easy run', 30, 3.0),
  a('shelby', 0, 'walk', 'Stroller walk', 35, 1.6, 'easy'),
  a('shelby', 1, 'walk', 'Stroller walk', 40, 1.9, 'easy'),
  a('shelby', 3, 'mobility', 'Stretch + mobility', 15, undefined, 'easy'),
  a('shelby', 4, 'walk', 'Stroller walk', 30, 1.4),
  a('shelby', 6, 'walk', 'Stroller walk', 45, 2.1, 'right'),
  a('shelby', 8, 'mobility', 'Yoga flow', 20),
  a('shelby', 9, 'walk', 'Stroller walk', 35, 1.7),
  a('shelby', 13, 'walk', 'Stroller walk', 40, 2.0),
  a('shelby', 16, 'strength', 'Glutes + core', 18, undefined, 'right'),
  a('shelby', 20, 'walk', 'Stroller walk', 30, 1.5),
  a('shelby', 24, 'walk', 'Stroller walk', 35, 1.6),
]

const today = iso(new Date())

export const COACH_PLANS: CoachPlan[] = [
  {
    memberId: 'daniel', date: today, readiness: 'fresh', direction: 'build',
    note: 'You hit every session for two weeks, so the run goes up a few minutes. Your legs got skipped twice, so today is legs and core.',
    basedOn: '14 activities in the last 30 days',
    cardio: {
      kind: 'run', title: 'Easy run', minutes: 30, distanceMi: 3, effort: 'Easy · Zone 2', target: '10:00–10:30 / mi',
      why: 'Yesterday was strength and Tuesday’s tempo felt hard, so today stays conversational.', points: 15,
    },
    strength: {
      title: 'Legs + core', focus: 'Legs', minutes: 25, rounds: 3, points: 20,
      why: 'You’ve done push work 3× this month and legs once. Evening it out.',
      exercises: [
        { name: 'Bodyweight squats', sets: 3, reps: 15, restSec: 45, cue: 'Sit back, chest up, knees track over toes.' },
        { name: 'Reverse lunges', sets: 3, reps: 10, restSec: 45, cue: '10 per leg. Step back, drop the back knee softly.' },
        { name: 'Glute bridges', sets: 3, reps: 15, restSec: 30, cue: 'Squeeze at the top for a second.' },
        { name: 'Wall sit', sets: 3, seconds: 40, restSec: 45, cue: 'Thighs parallel, back flat on the wall.' },
        { name: 'Plank', sets: 3, seconds: 45, restSec: 30, cue: 'Straight line from head to heels.' },
      ],
    },
  },
  {
    memberId: 'shelby', date: today, readiness: 'steady', direction: 'hold',
    note: 'Nine stroller walks this month, nice and steady. Holding the walk where it is and adding a short, gentle strength session.',
    basedOn: '11 activities in the last 30 days',
    cardio: {
      kind: 'walk', title: 'Stroller walk', minutes: 40, distanceMi: 2, effort: 'Easy · brisk', target: 'Brisk enough to chat, not sing',
      why: 'Your walks have crept from 1.4 to 2 miles. Holding there this week.', points: 15,
    },
    strength: {
      title: 'Glutes + core', focus: 'Glutes', minutes: 18, rounds: 3, points: 20,
      why: 'It’s been two weeks since your last strength day. Short and gentle to restart.',
      exercises: [
        { name: 'Glute bridges', sets: 3, reps: 12, restSec: 30, cue: 'Press through the heels, ribs down.' },
        { name: 'Bird dog', sets: 3, reps: 8, restSec: 30, cue: '8 per side, slow and steady.' },
        { name: 'Side-lying leg lifts', sets: 2, reps: 12, restSec: 30, cue: '12 per side, toes pointing forward.' },
        { name: 'Dead bug', sets: 3, reps: 8, restSec: 30, cue: 'Low back stays on the floor.' },
      ],
    },
  },
]

/** Mock of the coach's "something else" answer. The real one calls the coach function with the reason. */
export function mockSwap(plan: CoachPlan, reason: SwapReason): CoachPlan {
  const c = plan.cardio
  const st = plan.strength
  switch (reason) {
    case 'shorter':
      return { ...plan, note: 'Short on time? Same idea, half the clock.',
        cardio: { ...c, minutes: Math.round(c.minutes / 2), distanceMi: c.distanceMi && Math.round(c.distanceMi * 5) / 10, why: 'Half the distance still counts toward the week.' },
        strength: { ...st, rounds: 2, minutes: Math.round(st.minutes * 0.6), exercises: st.exercises.slice(0, 3).map((e) => ({ ...e, sets: 2 })) } }
    case 'easier':
      return { ...plan, readiness: 'tired', direction: 'ease', note: 'Taking it easy today is smart. Gentle movement, nothing to prove.',
        cardio: { ...c, kind: 'walk', title: 'Easy walk', minutes: 25, distanceMi: 1.2, effort: 'Easy', target: 'Relaxed pace', why: 'Movement without the strain.' },
        strength: { ...st, title: 'Stretch + mobility', focus: 'Mobility', rounds: 1, minutes: 12,
          exercises: [
            { name: 'Cat–cow', sets: 1, seconds: 60, restSec: 10, cue: 'Move with your breath.' },
            { name: 'Hip flexor stretch', sets: 2, seconds: 40, restSec: 10, cue: 'Each side, tuck the pelvis.' },
            { name: 'Child’s pose', sets: 1, seconds: 60, restSec: 10, cue: 'Breathe into your back.' },
          ] } }
    case 'no-run':
      return { ...plan, note: 'No run today. A bike ride keeps the engine going with less pounding.',
        cardio: { ...c, kind: 'bike', title: 'Easy bike ride', minutes: 35, distanceMi: 8, effort: 'Easy · Zone 2', target: 'Steady cadence, easy gears', why: 'Same aerobic work, kinder on the legs.' } }
    case 'indoors':
      return { ...plan, note: 'Staying in? Here’s a living-room version.',
        cardio: { ...c, kind: 'run', title: 'Indoor cardio circuit', minutes: 20, distanceMi: undefined, effort: 'Moderate', target: '40s on, 20s off × 20', why: 'Jumping jacks, high knees, stair laps.' } }
  }
}
