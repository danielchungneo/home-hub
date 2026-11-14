# Workout coach

An AI coach on the Workout tab plans **one cardio session and one calisthenics session per day for every family member who has opted in** (`athlete_profiles.coach_enabled`), based on that person's last 30 days. Doing either part earns stars (cardio 15, calisthenics 20), once per part per day. The coach uses OpenAI (the key the repo already has).

The coach has two halves:

1. **Signals (plain code, `coach-signals.ts`)** decide *how hard today may be*: build, hold, ease, return, deload or rest, plus hard caps on minutes, rounds and intensity.
2. **The model (OpenAI)** decides *what the workout is* inside those limits, and explains it in the coach's voice.

That split is what keeps it smart about progression and safe: the model never decides to push someone who's been missing days, and its answer is clamped to the caps anyway.

## How it fits together

```
 pg_cron 4:30am ──► Edge Function `coach` (mode: daily)
                     │ for each opted-in person (in parallel; one failing doesn't block the rest; re-runs skip done ones)
                     │   signals = computeSignals(35 days of activities, 28 days of plans, profile)  → direction + caps
                     │   context = profile + signals + 30 days of activities (with feel) + last 7 plans + last 4 strength plans
                     │   OpenAI Chat Completions, Structured Outputs (strict json_schema matching CoachPlan)
                     │   sanitize: clamp to caps → points set server-side → upsert coach_plans(member_id, date, direction, signals)
                     ▼
 Kiosk Workout tab ◄── Realtime on coach_plans / activities
   "I did it" / session finish ──► rpc('complete_plan_part', member, part, feel)
                                     → activities row (+ feel) and points_ledger row, once per part per day
   "Ask for something else"   ──► functions.invoke('coach', { mode: 'swap', memberId, reason })
   Quick log (extra activity) ──► insert activities (no plan_part, no stars)
```

The model never decides points, difficulty direction or caps, and never writes to the database. The function validates its answer, and the RPC is the only way stars are earned.

## How the coach decides difficulty

Every morning, per person, from what they **actually did** (not what was planned). First match wins:

| Direction | When | What today looks like |
| --- | --- | --- |
| **return** | No history, or 7+ days since the last activity | ~60% of their usual cardio, easier variations, easy effort only. "Welcome back." |
| **rest** | 6 days in a row, or 2 of the last 3 training days felt hard and they trained yesterday, or already over their `days_per_week` | Active recovery: 15–25 min easy walk/ride + mobility (still earns stars) |
| **ease** | Last 7 days were >150% of a normal week, 2 of 3 recent days felt hard, 3–6 days since the last activity, or under 50% of planned sessions done this week | ~85% of usual, one round fewer, moderate effort. Missed sessions are never "made up". |
| **deload** | ~3 weeks of building (12+ build days in 21 and no deload in 3 weeks); lasts the week | ~70% volume, same moves, easy effort |
| **build** | 75%+ of planned sessions done over 2 weeks, nothing felt hard lately, load ratio ≤ 1.3, 3+ active days this week | One notch up on ONE thing: cardio up to ~110% of their longest recent session, or strength +1 round / +2 reps / longer holds / harder variation |
| **hold** | Everything else | Same level, some variety |

Inputs: days since last activity, active-day streak, minutes in the last 7 days vs the 3-week average (load ratio), plan adherence over 7 and 14 days, the hardest feel on each of the last 3 training days, whether yesterday felt hard, and recent directions (for deloads). `days_per_week` from the profile sets the rest-day target.

Caps from the direction: `cardioMaxMin`, `strengthMaxMin`, `strengthMaxRounds`, `intensity` (easy / moderate / any). A yesterday that felt hard forces `intensity: easy` whatever the direction. Swaps tighten the caps further ("shorter" halves them, "easier" forces easy).

The Easy / Just right / Hard check-in on the kiosk is the feedback loop: it's what moves someone between build, hold and ease. The `direction` and the numbers behind it are saved on each `coach_plans` row (`signals` jsonb) so you can see why the coach chose what it did.

Tests: `deno test supabase/functions/_shared/coach-signals.test.ts` (consistent → build, missed days → ease, a week off → return, 6 straight → rest, 3 weeks of building → deload).

## Server files (`supabase/`)

| File | What it does |
| --- | --- |
| `migrations/20261113000000_workout_coach.sql` | `athlete_profiles`, `activities`, `coach_plans`, the `activities_one_part_per_day` unique index, `complete_plan_part()` RPC, RLS on |
| `functions/_shared/coach-signals.ts` | Plain-code progression: direction (build / hold / ease / return / deload / rest) and caps |
| `functions/_shared/coach-signals.test.ts` | Deno tests for the scenarios above |
| `functions/_shared/coach-prompt.ts` | System prompt (directions, rules, voice), context type, strict JSON schema |
| `functions/coach/index.ts` | Deno edge function: `daily` (everyone opted in, or one `memberId`) and `swap`, OpenAI call, clamp, upsert |

### Tables

- **athlete_profiles** — one per person; `coach_enabled` (default **false**: opt-in), `goals`, `days_per_week`, `preferred_cardio[]`, `equipment[]`, `limitations` (free text the person writes themselves, e.g. "sore left knee, no jumping"), `easy_pace`.
- **activities** — everything they did: `kind` (run, walk, bike, swim, strength, mobility, sport, other), `minutes`, `distance_mi`, `feel` (easy / right / hard), `source` (hub, phone, strava, apple_health) + `external_id` for imports, and `plan_part` (cardio / strength) when it completed today's plan.
- **coach_plans** — `(member_id, date)` primary key, `plan` jsonb (the kiosk's `CoachPlan`, including `direction`), `model`, `swap_reason`, `direction`, `signals` jsonb.

### Safety rules in the prompt

- Not a medical professional; never diagnose. Limitations are respected exactly; anything that sounds medical or recent (injury, pregnancy, postpartum, surgery) → low impact plus a one-line "check with your doctor before going harder".
- Difficulty follows the direction above; the model can't overrule it and its plan is clamped to the caps.
- Missed days are never made up; returns after a break are a confidence win, not a test.
- No talk of weight, calories, body shape or appearance. Short, warm, specific.

Tune the thresholds in `coach-signals.ts` and the voice and workout choices in `coach-prompt.ts`.

## Setup

1. `supabase db push` (or run the migration). Then add RLS policies that match the family-scoped policies on the other tables (read for the household; writes only through the RPC and the function).
2. Secrets (same OpenAI key as `recipe-import`; model must support Structured Outputs / `json_schema`):
   ```bash
   supabase secrets set OPENAI_API_KEY=<the key the repo already uses>   # skip if already set
   supabase secrets set COACH_MODEL=gpt-4o-mini                          # same model recipe-import uses
   # optional — otherwise the function reads households.timezone
   # supabase secrets set HOUSEHOLD_TZ=America/New_York
   ```
   Local serve: put the same values in `supabase/functions/.env` (gitignored).
3. `supabase functions deploy coach`
4. Schedule: migration `20261122000100_coach_daily_cron.sql` registers `coach-daily` at `30 10 * * *` via `invoke_coach_daily()`, which reads `project_url` and `service_role_key` from Vault (same as calendar-sync).
5. Opt people in: Settings → Workout coach (parent PIN on the toggle). Turning it on upserts `athlete_profiles` and calls `{ mode: 'daily', memberId }` so the first plan appears right away. Seed opts in Daniel and Shelby locally.
6. Test: `curl -X POST .../functions/v1/coach -H "Authorization: Bearer <service key>" -d '{"mode":"daily"}'` and check `coach_plans`.

**Cost:** one call per opted-in person per morning plus the occasional swap, about 4–5k input and ~600 output tokens each. A few cents a day for a family on a small or mid-size model.

## Kiosk wiring (`src/screens/workout/useWorkout.ts`)

The hook already has the final shape; only its internals change.

| Hook | Mock today | Supabase |
| --- | --- | --- |
| `plans` | `COACH_PLANS` | `from('coach_plans').select('member_id, plan').eq('date', today)` + Realtime. The person switcher only shows people with a plan, i.e. who opted in |
| `activities` | `ACTIVITIES` | `from('activities').select('*').gte('date', 35 days ago)` + Realtime |
| `complete(id, part, feel?)` | local insert + ledger | `rpc('complete_plan_part', { p_member, p_part, p_feel })` |
| `rate(id, part, feel)` | local update | `update activities set feel where member_id, date = today, plan_part` |
| `log(id, kind, minutes)` | local insert | `insert activities { source: 'hub', plan_part: null }` |
| `swap(id, reason)` | `mockSwap` after 1.4s | `functions.invoke('coach', { body: { mode: 'swap', memberId, reason } })`; show "Thinking…" until it returns (usually 3–8s) |
| `doneToday(id, part)` | derived | derived from `activities` where `plan_part = part` and `date = today` |

If an opted-in person has no plan for today (function failed, just opted in), show "Your coach is still planning today" with a Try again button that calls `functions.invoke('coach', { body: { mode: 'daily', memberId } })`. If nobody has opted in, the tab shows a short empty state pointing to Settings (already built).

The balance in the Star Shop stays the sum of `points_ledger`, so workout stars show up there automatically.

## Later

- **Strava**: webhook → edge function → upsert into `activities` with `source: 'strava'`, `external_id` = activity id. Match to `plan_part` if it's a run/ride on a day with an undone cardio plan.
- **Apple Health**: the Expo phone app reads workouts with HealthKit and upserts the same way (`source: 'apple_health'`).
- **Weather and busy days**: pass the kiosk's weather cache and today's calendar events into the context (`weather`, `busy` fields already exist) so rainy days lean indoors and packed days get shorter plans.
- **Kids**: no coaching for under-18s; give them the Quick log only.
