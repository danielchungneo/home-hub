// Supabase Edge Function: the workout coach.
//   POST { mode: 'daily' }                                  → plans today for every opted-in family member (pg_cron ~4:30am)
//   POST { mode: 'daily', memberId }                        → (re)plans just one person ("Try again", or after opting in)
//   POST { mode: 'swap', memberId, reason: 'shorter'|... }  → replaces one person's plan for today ("Ask for something else")
// Env: OPENAI_API_KEY (reuse the repo's existing key), COACH_MODEL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      HOUSEHOLD_TZ (default America/Chicago)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { COACH_SYSTEM, coachUserMessage, PLAN_SCHEMA, type CoachContext } from '../_shared/coach-prompt.ts'
import { computeSignals, type Direction, type Signals } from '../_shared/coach-signals.ts'

const POINTS = { cardio: 15, strength: 20 } // must match complete_plan_part()
// OPENAI_API_KEY + COACH_MODEL match recipe-import (same OpenAI key; model must support Structured Outputs).
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
function coachModel() {
  const model = Deno.env.get('COACH_MODEL')
  if (!model) throw new Error('COACH_MODEL is not set (use a Structured Outputs model, e.g. the same one as recipe-import)')
  return model
}

let cachedTz: string | null = null
async function householdTz() {
  if (cachedTz) return cachedTz
  const fromEnv = Deno.env.get('HOUSEHOLD_TZ')
  if (fromEnv) {
    cachedTz = fromEnv
    return cachedTz
  }
  const { data } = await db.from('households').select('timezone').limit(1).maybeSingle()
  cachedTz = data?.timezone ?? 'America/New_York'
  return cachedTz
}

const localDate = async (offsetDays = 0) => {
  const tz = await householdTz()
  const d = new Date(Date.now() + offsetDays * 864e5)
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) // yyyy-mm-dd
}
const weekdayName = async () => {
  const tz = await householdTz()
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date())
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    if (body.mode === 'swap') {
      if (!['shorter', 'easier', 'no-run', 'indoors'].includes(body.reason)) return json({ error: 'bad reason' }, 400)
      return json({ plan: await planFor(body.memberId, body.reason) })
    }
    if (body.memberId) return json({ plan: await planFor(body.memberId) })

    // Everyone who has opted in. One person failing never blocks the others.
    const { data: people } = await db.from('athlete_profiles').select('member_id').eq('coach_enabled', true)
    const today = await localDate()
    const { data: existing } = await db.from('coach_plans').select('member_id').eq('date', today)
    const todo = (people ?? []).filter((p) => !(existing ?? []).some((e) => e.member_id === p.member_id)) // safe to re-run
    const results = await Promise.allSettled(todo.map((p) => planFor(p.member_id)))
    return json({
      results: results.map((r, i) => ({ memberId: todo[i].member_id, ok: r.status === 'fulfilled', error: r.status === 'rejected' ? String(r.reason) : undefined })),
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

async function planFor(memberId: string, swapReason?: CoachContext['swapReason']) {
  const today = await localDate()
  const ctx = await buildContext(memberId, today, swapReason)
  if (swapReason === 'easier') ctx.signals.caps.intensity = 'easy'
  if (swapReason === 'shorter') {
    ctx.signals.caps.cardioMaxMin = Math.max(15, Math.round(ctx.signals.caps.cardioMaxMin / 2))
    ctx.signals.caps.strengthMaxMin = Math.max(8, Math.round(ctx.signals.caps.strengthMaxMin / 2))
  }
  const raw = await askCoach(ctx)
  const plan = sanitize(raw, ctx.signals)
  const model = coachModel()
  const row = {
    member_id: memberId, date: today, model, swap_reason: swapReason ?? null,
    direction: ctx.signals.direction,
    signals: ctx.signals,                       // kept for debugging and for tomorrow's deload/adherence maths
    plan: {
      ...plan,
      direction: ctx.signals.direction,
      readiness: readinessFor(ctx.signals.direction),
      basedOn: `${ctx.activities.length} activities in the last 30 days`,
      cardio: { ...plan.cardio, points: POINTS.cardio },
      strength: { ...plan.strength, points: POINTS.strength },
    },
  }
  const { error } = await db.from('coach_plans').upsert(row) // Realtime pushes it to the kiosk
  if (error) throw error
  return row.plan
}

const readinessFor = (d: Direction) => (d === 'build' ? 'fresh' : d === 'rest' || d === 'return' ? 'tired' : 'steady')

async function buildContext(memberId: string, today: string, swapReason?: CoachContext['swapReason']): Promise<CoachContext> {
  const since35 = await localDate(-35)
  const since28 = await localDate(-28)
  const since30 = await localDate(-30)
  const [{ data: member }, { data: profile }, { data: acts }, { data: plans }, { data: current }, weekday] = await Promise.all([
    db.from('members').select('name').eq('id', memberId).single(),
    db.from('athlete_profiles').select('goals, days_per_week, preferred_cardio, equipment, limitations, easy_pace').eq('member_id', memberId).single(),
    db.from('activities').select('date, kind, title, minutes, distance_mi, feel, plan_part').eq('member_id', memberId).gte('date', since35).order('date', { ascending: false }),
    db.from('coach_plans').select('date, direction, plan').eq('member_id', memberId).gte('date', since28).lt('date', today).order('date', { ascending: false }),
    swapReason ? db.from('coach_plans').select('plan').eq('member_id', memberId).eq('date', today).maybeSingle() : Promise.resolve({ data: null }),
    weekdayName(),
  ])
  const A = acts ?? []
  const P = plans ?? []
  const doneRow = (date: string, part: string) => A.find((a) => a.date === date && a.plan_part === part)

  const signals = computeSignals(today, A, P.map((p) => ({
    date: p.date, direction: p.direction, cardioMinutes: p.plan.cardio?.minutes, strengthRounds: p.plan.strength?.rounds,
  })), profile ?? {})

  return {
    today: `${today} (${weekday})`,
    person: { name: member?.name ?? 'there', profile: profile ?? {} },
    signals,
    activities: A.filter((a) => a.date >= since30).map(({ plan_part: _p, ...a }) => a),
    recentPlans: P.slice(0, 7).map((p) => ({
      date: p.date, direction: p.direction, cardio: p.plan.cardio?.title, strength: p.plan.strength?.title,
      cardioDone: !!doneRow(p.date, 'cardio'), strengthDone: !!doneRow(p.date, 'strength'),
    })),
    recentStrength: P.slice(0, 4).map((p) => ({
      date: p.date, title: p.plan.strength?.title, rounds: p.plan.strength?.rounds, exercises: p.plan.strength?.exercises ?? [],
      done: !!doneRow(p.date, 'strength'), feel: doneRow(p.date, 'strength')?.feel ?? null,
    })),
    // weather / busy: fill from the same sources the kiosk uses (weather cache, calendar events) if available.
    swapReason,
    currentPlan: current?.plan,
  }
}

async function askCoach(ctx: CoachContext) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: coachModel(),
      messages: [
        { role: 'system', content: COACH_SYSTEM },
        { role: 'user', content: coachUserMessage(ctx) },
      ],
      response_format: { type: 'json_schema', json_schema: PLAN_SCHEMA },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const out = await res.json()
  const msg = out.choices?.[0]?.message
  if (msg?.refusal) throw new Error(`Coach refused: ${msg.refusal}`)
  if (!msg?.content) throw new Error('Coach did not return a plan')
  return JSON.parse(msg.content)
}

/** Clamp to the signals' caps and tidy, so a bad or over-eager answer can't break the kiosk or overtrain anyone. */
function sanitize(p: any, sig: Signals) {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))
  const { caps } = sig
  const rest = sig.direction === 'rest'
  const rounds = clamp(p.strength?.rounds ?? 2, 1, caps.strengthMaxRounds)
  const ex = (p.strength?.exercises ?? []).slice(0, 6).map((e: any) => ({
    name: String(e.name).slice(0, 40), sets: clamp(e.sets ?? rounds, 1, rounds),
    ...(e.seconds ? { seconds: clamp(e.seconds, 10, 180) } : { reps: clamp(e.reps ?? 10, 1, 50) }),
    restSec: clamp(e.restSec ?? 45, 15, 90), cue: String(e.cue ?? '').slice(0, 90),
  }))
  if (ex.length < 2) throw new Error('Plan had too few exercises')

  let kind = ['run', 'walk', 'bike', 'swim'].includes(p.cardio?.kind) ? p.cardio.kind : 'walk'
  if (rest && kind === 'run') kind = 'walk'                         // recovery days never run
  const minutes = clamp(p.cardio?.minutes ?? 30, 10, rest ? Math.min(25, caps.cardioMaxMin) : caps.cardioMaxMin)
  const scale = p.cardio?.minutes ? minutes / p.cardio.minutes : 1   // keep distance in step with a clamped time
  return {
    note: String(p.note).slice(0, 260),
    restDay: rest || !!p.restDay,
    cardio: {
      kind,
      title: String(p.cardio?.title ?? 'Easy walk').slice(0, 40),
      minutes,
      ...(p.cardio?.distanceMi ? { distanceMi: Math.round(p.cardio.distanceMi * scale * 10) / 10 } : {}),
      effort: caps.intensity === 'easy' ? 'Easy' : String(p.cardio?.effort ?? 'Easy').slice(0, 30),
      ...(p.cardio?.target ? { target: String(p.cardio.target).slice(0, 50) } : {}),
      why: String(p.cardio?.why ?? '').slice(0, 160),
    },
    strength: {
      title: String(p.strength?.title ?? 'Full body').slice(0, 40),
      focus: rest ? 'Mobility' : String(p.strength?.focus ?? 'Full body').slice(0, 20),
      minutes: clamp(p.strength?.minutes ?? 20, 8, caps.strengthMaxMin),
      rounds,
      exercises: ex,
      why: String(p.strength?.why ?? '').slice(0, 160),
    },
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
