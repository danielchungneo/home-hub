// deno test supabase/functions/_shared/coach-signals.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { computeSignals, type ActivityRow, type Direction, type PlanRow } from './coach-signals.ts'

const T = '2026-11-13'
const d = (n: number) => { const x = new Date(T + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10) }
/** Both parts done on each given day (days ago), with one feel. */
function history(days: number[], feel = 'right', direction: Direction = 'hold') {
  const acts: ActivityRow[] = []; const plans: PlanRow[] = []
  for (const n of days) {
    acts.push({ date: d(n), kind: 'run', minutes: 30, feel, plan_part: 'cardio' }, { date: d(n), kind: 'strength', minutes: 20, feel, plan_part: 'strength' })
    plans.push({ date: d(n), direction, strengthRounds: 3 })
  }
  return { acts, plans }
}
const FOUR_A_WEEK = [1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24, 26, 27]

Deno.test('consistent and comfortable → build, one notch up', () => {
  const h = history(FOUR_A_WEEK)
  const s = computeSignals(T, h.acts, h.plans, { days_per_week: 4 })
  assertEquals(s.direction, 'build')
  assertEquals(s.caps.strengthMaxRounds, 4)
})
Deno.test('a few missed days → ease, never make it up', () => {
  const h = history(FOUR_A_WEEK.filter((n) => n > 4))
  assertEquals(computeSignals(T, h.acts, h.plans, {}).direction, 'ease')
})
Deno.test('a week or more off → return, easy intensity', () => {
  const h = history(FOUR_A_WEEK.filter((n) => n > 9))
  const s = computeSignals(T, h.acts, h.plans, {})
  assertEquals(s.direction, 'return')
  assertEquals(s.caps.intensity, 'easy')
})
Deno.test('six days straight → rest', () => {
  const h = history([1, 2, 3, 4, 5, 6, 8, 10])
  assertEquals(computeSignals(T, h.acts, h.plans, {}).direction, 'rest')
})
Deno.test('two hard days and trained yesterday → rest', () => {
  const h = history(FOUR_A_WEEK); h.acts[0].feel = 'hard'; h.acts[2].feel = 'hard'
  assertEquals(computeSignals(T, h.acts, h.plans, {}).direction, 'rest')
})
Deno.test('three weeks of building → deload, and it lasts the week', () => {
  const h = history(FOUR_A_WEEK, 'right', 'build')
  assertEquals(computeSignals(T, h.acts, h.plans, {}).direction, 'deload')
  h.plans.push({ date: d(2), direction: 'deload' })
  assertEquals(computeSignals(T, h.acts, h.plans, {}).direction, 'deload')
})
Deno.test('new person → return', () => {
  assertEquals(computeSignals(T, [], [], {}).direction, 'return')
})
