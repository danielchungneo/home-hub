// Training signals: plain maths, no AI. Decides whether today is a day to build, hold, ease back,
// return after a break, deload or rest, and sets hard caps the model's plan is clamped to.
// The model chooses the workout; this file decides how hard it's allowed to be.
// Pure TypeScript (no Deno APIs) so it can be unit-tested with Node.

export type Direction = 'build' | 'hold' | 'ease' | 'return' | 'deload' | 'rest'

export interface ActivityRow { date: string; kind: string; minutes: number; feel?: string | null; plan_part?: string | null }
export interface PlanRow { date: string; direction?: Direction | null; cardioMinutes?: number; strengthRounds?: number }
export interface ProfileRow { days_per_week?: number | null }

export interface Signals {
  direction: Direction
  reasons: string[]                 // plain-English facts that led to the direction; the coach cites them
  daysSinceLast: number | null      // null = no history
  streak: number                    // consecutive active days ending yesterday
  activeDaysLast7: number
  minutesLast7: number
  minutesWeeklyAvg: number          // average of the 3 weeks before that
  loadRatio: number | null          // last 7 days ÷ the 3-week average (acute:chronic)
  adherence7: number | null         // share of planned parts done in the last 7 days
  adherence14: number | null
  recentFeels: string[]             // newest first, up to 3
  hardYesterday: boolean
  daysSinceDeload: number | null
  caps: {
    cardioMaxMin: number            // today's cardio may not be longer than this
    strengthMaxMin: number
    strengthMaxRounds: number
    intensity: 'easy' | 'moderate' | 'any'
  }
}

const CARDIO = new Set(['run', 'walk', 'bike', 'swim'])
const FACTOR: Record<Direction, number> = { build: 1.1, hold: 1, ease: 0.85, deload: 0.7, return: 0.6, rest: 0.5 }

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5)
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

export function computeSignals(today: string, acts: ActivityRow[], plans: PlanRow[], profile: ProfileRow = {}): Signals {
  const ago = (d: string) => dayDiff(today, d)                    // 1 = yesterday
  const past = acts.filter((a) => ago(a.date) >= 1 && ago(a.date) <= 35)
  const daysPerWeek = profile.days_per_week ?? 4

  // Volume windows (today excluded: it hasn't happened yet)
  const inWin = (lo: number, hi: number) => past.filter((a) => ago(a.date) >= lo && ago(a.date) <= hi)
  const mins = (xs: ActivityRow[]) => xs.reduce((n, a) => n + a.minutes, 0)
  const minutesLast7 = mins(inWin(1, 7))
  const minutesWeeklyAvg = Math.round(mins(inWin(8, 28)) / 3)
  const loadRatio = minutesWeeklyAvg > 0 ? Math.round((minutesLast7 / minutesWeeklyAvg) * 100) / 100 : null

  const activeDates = new Set(past.map((a) => a.date))
  const activeDaysLast7 = [...activeDates].filter((d) => ago(d) <= 7).length
  const last = past.reduce<string | null>((m, a) => (!m || a.date > m ? a.date : m), null)
  const daysSinceLast = last ? ago(last) : null
  let streak = 0
  while (activeDates.has(shift(today, -(streak + 1)))) streak++

  // One feel per day (the hardest that day), newest first: two parts on one day count once.
  const rank: Record<string, number> = { easy: 0, right: 1, hard: 2 }
  const dayFeel = new Map<string, string>()
  for (const a of past) if (a.feel && (!dayFeel.has(a.date) || rank[a.feel] > rank[dayFeel.get(a.date)!])) dayFeel.set(a.date, a.feel)
  const recentFeels = [...dayFeel.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 3).map(([, f]) => f)
  const hardRecent = recentFeels.filter((f) => f === 'hard').length
  const hardYesterday = past.some((a) => ago(a.date) === 1 && a.feel === 'hard')

  // Adherence: of the parts the coach planned, how many were done? (Missed days lower this.)
  const adherence = (days: number) => {
    const ps = plans.filter((p) => ago(p.date) >= 1 && ago(p.date) <= days && p.direction !== 'rest')
    if (!ps.length) return null
    const done = ps.reduce((n, p) => n + past.filter((a) => a.date === p.date && a.plan_part).length, 0)
    return Math.round((done / (ps.length * 2)) * 100) / 100
  }
  const adherence7 = adherence(7)
  const adherence14 = adherence(14)

  const deloads = plans.filter((p) => p.direction === 'deload').map((p) => ago(p.date)).filter((d) => d >= 1)
  const daysSinceDeload = deloads.length ? Math.min(...deloads) : null
  const buildDays21 = plans.filter((p) => p.direction === 'build' && ago(p.date) <= 21).length

  // ---- Decide (first match wins; safety first, then breaks, then progress) ----
  const reasons: string[] = []
  let direction: Direction
  const trainedYesterday = activeDates.has(shift(today, -1))

  if (daysSinceLast === null) {
    direction = 'return'; reasons.push('No activity logged yet, so starting gently')
  } else if (daysSinceLast >= 14) {
    direction = 'return'; reasons.push(`${daysSinceLast} days since the last activity`)
  } else if (daysSinceLast >= 7) {
    direction = 'return'; reasons.push(`A ${daysSinceLast}-day break`)
  } else if (streak >= 6) {
    direction = 'rest'; reasons.push(`${streak} days in a row without a rest day`)
  } else if (hardRecent >= 2 && trainedYesterday) {
    direction = 'rest'; reasons.push(`${hardRecent} of the last 3 training days felt hard`)
  } else if (loadRatio !== null && loadRatio > 1.5) {
    direction = 'ease'; reasons.push(`Last 7 days were ${Math.round(loadRatio * 100)}% of a normal week`)
  } else if (hardRecent >= 2) {
    direction = 'ease'; reasons.push(`${hardRecent} of the last 3 training days felt hard`)
  } else if (trainedYesterday && activeDaysLast7 >= daysPerWeek + 1) {
    direction = 'rest'; reasons.push(`Already ${activeDaysLast7} active days this week (aiming for ${daysPerWeek})`)
  } else if (daysSinceDeload !== null && daysSinceDeload <= 6 && !deloads.some((d) => d >= 7 && d <= 13)) {
    direction = 'deload'; reasons.push('Finishing the lighter week')
  } else if (buildDays21 >= 12 && (daysSinceDeload === null || daysSinceDeload >= 21)) {
    direction = 'deload'; reasons.push('Three weeks of building; a lighter week locks it in')
  } else if (daysSinceLast >= 3) {
    direction = 'ease'; reasons.push(`${daysSinceLast} days since the last activity`)
  } else if (adherence7 !== null && adherence7 < 0.5) {
    direction = 'ease'; reasons.push(`Did ${Math.round(adherence7 * 100)}% of planned sessions this week`)
  } else if (
    (adherence14 ?? 0) >= 0.75 && hardRecent === 0 && recentFeels.length >= 2 &&
    (loadRatio === null || loadRatio <= 1.3) && activeDaysLast7 >= Math.min(3, daysPerWeek)
  ) {
    direction = 'build'
    reasons.push(`Did ${Math.round((adherence14 ?? 0) * 100)}% of planned sessions in two weeks`)
    if (recentFeels.every((f) => f === 'easy')) reasons.push('Recent sessions felt easy')
  } else {
    direction = 'hold'; reasons.push('Consistent enough to hold, not yet enough to push')
  }

  // ---- Caps: grow from what they've actually done, never from what was planned ----
  const recentCardio = past.filter((a) => CARDIO.has(a.kind) && ago(a.date) <= 21).map((a) => a.minutes)
  const recentStrength = past.filter((a) => !CARDIO.has(a.kind) && ago(a.date) <= 21).map((a) => a.minutes)
  const baseCardio = recentCardio.length ? Math.max(median(recentCardio), 15) : 20
  const longestCardio = recentCardio.length ? Math.max(...recentCardio) : 20
  const baseStrength = recentStrength.length ? Math.max(median(recentStrength), 10) : 15
  const lastRounds = plans.filter((p) => p.strengthRounds).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.strengthRounds ?? 2

  const f = FACTOR[direction]
  const cardioMaxMin = clamp(Math.round((direction === 'build' ? longestCardio : baseCardio) * f), 15, 75)
  const strengthMaxMin = clamp(Math.round(baseStrength * (direction === 'build' ? 1.15 : f)), 10, 35)
  const strengthMaxRounds =
    direction === 'build' ? Math.min(lastRounds + 1, 4) :
    direction === 'hold' ? lastRounds :
    direction === 'rest' ? 1 : Math.max(lastRounds - 1, 1)
  const intensity: Signals['caps']['intensity'] =
    direction === 'rest' || direction === 'return' || direction === 'deload' || hardYesterday ? 'easy' :
    direction === 'ease' ? 'moderate' : 'any'

  return {
    direction, reasons, daysSinceLast, streak, activeDaysLast7, minutesLast7, minutesWeeklyAvg, loadRatio,
    adherence7, adherence14, recentFeels, hardYesterday, daysSinceDeload,
    caps: { cardioMaxMin, strengthMaxMin, strengthMaxRounds, intensity },
  }
}

function shift(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
