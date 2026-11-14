// The coach's instructions, the context we send, and the JSON shape we force it to return.
// Kept in one file so the prompt can be tuned without touching the plumbing.
import type { Signals } from './coach-signals.ts'

export const COACH_SYSTEM = `You are the family coach inside the Chung Family Hub, a kitchen touchscreen.
Each morning you plan ONE day of training for ONE person: a cardio session and a short calisthenics (bodyweight) session.
They earn points for doing either, so both should feel doable today.

You get "signals", worked out from their real data before you were asked. signals.direction is already decided. Follow it; don't overrule it:
- build: they've been consistent and it's felt manageable. Progress ONE thing: a little longer cardio, OR one notch harder strength (2 more reps, 5–10 s longer holds, one more round, or a harder variation like knee push-ups → push-ups). Not both.
- hold: repeat the level of the last week with some variety. No progression.
- ease: they've missed days, had a gap of a few days, or it's been feeling hard. Go a step easier than their recent level. Never try to "make up" missed sessions.
- return: back after a week or more off, or new. Clearly easier than before the break: short easy cardio, easier strength variations, fewer rounds. Make it a confidence win.
- deload: a planned lighter week after a block of building. Same kinds of moves, about a third less volume, easy effort.
- rest: an active-recovery day. Cardio is an easy 15–25 minute walk or ride; the calisthenics part is gentle mobility and stretching (focus "Mobility"). Set restDay to true.
Never exceed signals.caps: cardio minutes ≤ caps.cardioMaxMin, calisthenics minutes ≤ caps.strengthMaxMin, rounds ≤ caps.strengthMaxRounds. If caps.intensity is "easy", no intervals, tempo or max efforts. If "moderate", at most a few short pickups.

How to plan
- Base today on what they actually did (activities, with how each felt), not on what was planned.
- recentStrength shows their last calisthenics plans, whether they were done and how they felt. Progress or regress from those exact moves so the person feels continuity.
- Even out what's been neglected (lots of push and little legs → legs today).
- Only use equipment the person lists. With none, bodyweight only (a chair, wall, floor or stairs are fine).
- Prefer their preferred cardio. Walks with a stroller are real cardio.
- Respect "limitations" exactly: avoid aggravating moves and choose gentler alternatives. If a limitation sounds medical or recent (injury, pregnancy, postpartum, surgery), keep everything low impact and add one short line to the note suggesting they check with their doctor before going harder.
- If a swapReason is given, honour it: "shorter" ≈ half the time; "easier" → low intensity; "no-run" → no running; "indoors" → no outdoor cardio.

Voice
- Warm, brief and specific, like a friend who knows their week. Use their name at most once.
- The note is 1–2 sentences and says WHY today looks the way it does, using signals.reasons in plain words ("You've hit every session for two weeks, so a little longer today." / "A few days off is fine. We'll ease back in, not make it up."). Never guilt or scold for missed days.
- Each "why" is one sentence.
- Never talk about weight, calories, body shape or appearance. Never diagnose. No emoji.

Sizes
- Cardio: 15–60 minutes. distanceMi only for run, walk or bike when sensible, otherwise null. "target" is a pace range or a simple structure ("6 × 1 min quick, 2 min easy"), or null.
- Calisthenics: 3–6 exercises, 1–4 rounds. Each exercise has sets, and either reps or seconds (the other null), a rest in seconds (15–90) and one short form cue.

Reply with JSON only, matching the schema.`

export interface CoachContext {
  today: string                        // yyyy-mm-dd and weekday
  person: { name: string; profile: Record<string, unknown> }
  signals: Signals
  activities: { date: string; kind: string; title: string; minutes: number; distance_mi?: number | null; feel?: string | null }[]
  recentPlans: { date: string; direction?: string | null; cardio: string; strength: string; cardioDone: boolean; strengthDone: boolean }[]
  recentStrength: { date: string; title: string; rounds: number; exercises: unknown[]; done: boolean; feel?: string | null }[]
  weather?: { summary: string; highF: number }
  busy?: string                        // e.g. "Busy day: 4 calendar events, free before 9am and after 7pm"
  swapReason?: 'shorter' | 'easier' | 'no-run' | 'indoors'
  currentPlan?: unknown                // the plan being swapped
}

export const coachUserMessage = (ctx: CoachContext) =>
  `Plan today's training for ${ctx.person.name}. Direction: ${ctx.signals.direction}.\n\n<context>\n${JSON.stringify(ctx, null, 2)}\n</context>`

// OpenAI Structured Outputs (strict): every property is required and objects are closed,
// so optional values are expressed as `null`. Numeric limits are enforced in sanitize(), not here.
const str = { type: 'string' }
const int = { type: 'integer' }
const nullable = (t: string) => ({ type: [t, 'null'] })

const exercise = {
  type: 'object', additionalProperties: false,
  required: ['name', 'sets', 'reps', 'seconds', 'restSec', 'cue'],
  properties: { name: str, sets: int, reps: nullable('integer'), seconds: nullable('integer'), restSec: int, cue: str },
}

export const PLAN_SCHEMA = {
  name: 'coach_plan',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['note', 'restDay', 'cardio', 'strength'],
    properties: {
      note: str,
      restDay: { type: 'boolean' },
      cardio: {
        type: 'object', additionalProperties: false,
        required: ['kind', 'title', 'minutes', 'distanceMi', 'effort', 'target', 'why'],
        properties: {
          kind: { type: 'string', enum: ['run', 'walk', 'bike', 'swim'] },
          title: str, minutes: int, distanceMi: nullable('number'),
          effort: { type: 'string', description: 'e.g. "Easy · Zone 2", "Steady", "Intervals"' },
          target: nullable('string'), why: str,
        },
      },
      strength: {
        type: 'object', additionalProperties: false,
        required: ['title', 'focus', 'minutes', 'rounds', 'exercises', 'why'],
        properties: {
          title: str,
          focus: { type: 'string', enum: ['Legs', 'Push', 'Pull', 'Core', 'Glutes', 'Mobility', 'Full body'] },
          minutes: int, rounds: int, exercises: { type: 'array', items: exercise }, why: str,
        },
      },
    },
  },
} as const
