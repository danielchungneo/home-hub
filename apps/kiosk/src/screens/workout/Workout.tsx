import { useEffect, useMemo, useRef, useState } from 'react'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { Label } from '../../components/primitives'
import { useMembers } from '../../data/hooks'
import { memberColorProps } from '../../lib/colors'
import { useClock } from '../../hooks/useClock'
import { monthDay, weekday } from '../../lib/format'
import type { Activity, ActivityKind, CoachDirection, CoachPlan, Feel, Member, SwapReason } from '../../types'
import { CARDIO_ICON, FEELS, Star } from './parts'
import { Session } from './Session'
import { useWorkout } from './useWorkout'
import s from './Workout.module.css'

const DIRECTION_LABEL: Record<CoachDirection, string> = {
  build: 'Building', hold: 'Holding steady', ease: 'Easing back in', return: 'Welcome back', deload: 'Lighter week', rest: 'Recovery day',
}

const SWAPS: { id: SwapReason; label: string }[] = [
  { id: 'shorter', label: 'Shorter' }, { id: 'easier', label: 'Easier today' }, { id: 'no-run', label: 'No running' }, { id: 'indoors', label: 'Indoors' },
]

export default function Workout() {
  const now = useClock()
  const w = useWorkout()
  const membersQ = useMembers()
  const members = membersQ.data ?? []

  // Opted-in people (coach_enabled), whether or not today's plan has landed yet.
  const athletes = useMemo(() => {
    const opted = new Set(w.profiles.filter((p) => p.coachEnabled).map((p) => p.memberId))
    return members.filter((m) => m.active && opted.has(m.id))
  }, [members, w.profiles])

  const [whoId, setWhoId] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const [session, setSession] = useState(() => window.location.hash === '#workout-session')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!athletes.length) {
      setWhoId('')
      return
    }
    if (!athletes.some((m) => m.id === whoId)) setWhoId(athletes[0]!.id)
  }, [athletes, whoId])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const me = athletes.find((m) => m.id === whoId) ?? athletes[0]

  if (!me) {
    return (
      <AppShell>
        <PageHeader eyebrow={`Coach · ${weekday(now)}, ${monthDay(now)}`} title="Training" />
        <div className={s.empty}>
          No one has turned on the coach yet. Turn it on for a person in Settings, and their plan shows up here right away.
        </div>
      </AppShell>
    )
  }

  const plan = w.plan(me.id)
  const thinking = w.thinking === me.id

  const finish = (part: 'cardio' | 'strength', feel?: Feel) => {
    w.complete(me.id, part, feel)
    const pts = part === 'cardio' ? plan!.cardio.points : plan!.strength.points
    setToast(`+${pts} stars for ${me.name}. Nice work!`)
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Coach · ${weekday(now)}, ${monthDay(now)}`}
        title={<span key={me.id} className={s.title}>{me.name}’s training</span>}
        actions={<>
          <div role="group" aria-label="Whose plan" className={s.people}>
            {athletes.map((m) => {
              const done = (['cardio', 'strength'] as const).filter((p) => w.doneToday(m.id, p)).length
              return (
                <button
                  key={m.id}
                  type="button"
                  {...memberColorProps(m.color)}
                  aria-pressed={m.id === me.id}
                  className={s.person}
                  onClick={() => { setWhoId(m.id); setAskOpen(false) }}
                >
                  <MemberBlobAvatar memberId={m.id} size={44} decorative className={s.personAvatar} />
                  <span className={s.personText}>
                    <span className={s.personName}>{m.name}</span>
                    <span className={s.personSub}>{done} of 2 done</span>
                  </span>
                </button>
              )
            })}
          </div>
          <QuickLog member={me} onLog={(act) => { w.log(act); setToast(`Logged ${act.title}. Your coach will see it tomorrow.`) }} />
        </>}
      />

      <div className={s.body}>
        <div key={me.id} className={s.main} {...memberColorProps(me.color)}>
          {!plan && !thinking ? (
            <section className={s.coach} aria-label="Coach’s note" aria-live="polite">
              <span className={s.coachMark} aria-hidden="true"><Icon name="sparkle" size={44} stroke={2.2} /></span>
              <div className={s.coachText}>
                <span className={s.coachKicker}>Your coach</span>
                <span className={s.note}>Your coach is still planning today</span>
                <span className={s.coachChips}>
                  <Button size="lg" pill icon="refresh" onClick={() => w.retryPlan(me.id)}>Try again</Button>
                </span>
              </div>
            </section>
          ) : (
            <section className={s.coach} aria-label="Coach’s note" aria-live="polite">
              <span className={s.coachMark} aria-hidden="true"><Icon name="sparkle" size={44} stroke={2.2} /></span>
              <div className={s.coachText}>
                <span className={s.coachKicker}>Your coach · looked at {plan?.basedOn}</span>
                {thinking
                  ? <span className={s.thinking}>Thinking about a new plan<span className={s.dots}><i /><i /><i /></span></span>
                  : <span key={plan?.note} className={s.note}>{plan?.note}</span>}
                <span className={s.coachChips}>
                  {plan && (
                    <span className={s.readiness} data-r={plan.readiness}>
                      {plan.direction ? DIRECTION_LABEL[plan.direction] : plan.readiness === 'fresh' ? 'Feeling fresh' : plan.readiness === 'steady' ? 'Steady' : 'Take it easy'}
                    </span>
                  )}
                  {!askOpen
                    ? <button type="button" className={s.ask} onClick={() => setAskOpen(true)} disabled={thinking || !plan}>Ask for something else</button>
                    : SWAPS.map((o, i) => (
                      <button
                        key={o.id}
                        type="button"
                        className={s.swap}
                        style={{ ['--n' as string]: i }}
                        onClick={() => { w.swap(me.id, o.id); setAskOpen(false) }}
                      >
                        {o.label}
                      </button>
                    ))}
                </span>
              </div>
            </section>
          )}

          {plan && (
            <div key={plan.note} className={thinking ? `${s.plans} ${s.plansThinking}` : s.plans}>
              <CardioCard plan={plan} done={w.doneToday(me.id, 'cardio')} onDone={() => finish('cardio')} onRate={(f) => w.rate(me.id, 'cardio', f)} />
              <StrengthCard plan={plan} done={w.doneToday(me.id, 'strength')} onStart={() => setSession(true)} onDone={() => finish('strength')} onRate={(f) => w.rate(me.id, 'strength', f)} />
            </div>
          )}
        </div>

        <aside className={s.side}>
          <MonthCard member={me} activities={w.activities} />
          <WeekCard athletes={athletes} activities={w.activities} />
        </aside>
      </div>

      {session && plan && (
        <Session
          member={me}
          plan={plan.strength}
          onClose={() => setSession(false)}
          onFinish={(feel) => { setSession(false); finish('strength', feel) }}
        />
      )}

      {toast && <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
    </AppShell>
  )
}

function CardioCard({ plan, done, onDone, onRate }: { plan: CoachPlan; done?: Activity; onDone: () => void; onRate: (f: Feel) => void }) {
  const c = plan.cardio
  return (
    <section data-color="fjord" className={done ? `${s.card} ${s.cardDone}` : s.card} aria-label={`Cardio: ${c.title}`}>
      <div className={s.cardHead}>
        <span className={s.cardIcon}><Icon name={CARDIO_ICON[c.kind]} size={40} stroke={2.2} /></span>
        <span className={s.cardTitles}>
          <span className={s.cardKicker}>Cardio · {c.effort}</span>
          <span className={s.cardTitle}>{c.title}</span>
        </span>
        <span className={s.points}><Star />+{c.points}</span>
      </div>

      <div className={s.stats}>
        {c.distanceMi !== undefined && <Stat value={c.distanceMi.toFixed(1)} unit="miles" />}
        <Stat value={String(c.minutes)} unit="minutes" />
        {c.target && <span className={s.target}><Icon name="stopwatch" size={26} stroke={2.4} />{c.target}</span>}
      </div>

      <svg className={s.route} viewBox="0 0 560 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M10 90 C 90 20, 150 110, 230 60 S 380 10, 430 70 S 520 100, 550 30" pathLength="100" />
        <circle cx="10" cy="90" r="7" className={s.routeStart} />
        <circle cx="550" cy="30" r="9" className={s.routeEnd} />
      </svg>

      <span className={s.why}>{c.why}</span>
      <span className={s.spacer} />
      {done ? <DonePanel points={c.points} done={done} onRate={onRate} />
        : <div className={s.actions}><Button size="lg" pill icon="tick" className={s.grow} onClick={onDone}>I did it</Button></div>}
    </section>
  )
}

function StrengthCard({ plan, done, onStart, onDone, onRate }: { plan: CoachPlan; done?: Activity; onStart: () => void; onDone: () => void; onRate: (f: Feel) => void }) {
  const st = plan.strength
  return (
    <section data-color="honey" className={done ? `${s.card} ${s.cardDone}` : s.card} aria-label={`Calisthenics: ${st.title}`}>
      <div className={s.cardHead}>
        <span className={s.cardIcon}><Icon name="dumbbell" size={40} stroke={2.2} /></span>
        <span className={s.cardTitles}>
          <span className={s.cardKicker}>Calisthenics · {st.focus}</span>
          <span className={s.cardTitle}>{st.title}</span>
        </span>
        <span className={s.points}><Star />+{st.points}</span>
      </div>
      <div className={s.stats}>
        <Stat value={String(st.minutes)} unit="minutes" />
        <Stat value={String(st.rounds)} unit={st.rounds === 1 ? 'round' : 'rounds'} />
        <Stat value={String(st.exercises.length)} unit="moves" />
      </div>
      <ol className={s.moves}>
        {st.exercises.map((e, i) => (
          <li key={e.name} className={s.move} style={{ ['--n' as string]: i }}>
            <span className={s.moveNum}>{i + 1}</span>
            <span className={s.moveName}>{e.name}</span>
            <span className={s.moveDose}>{e.sets} × {e.reps ?? `${e.seconds}s`}</span>
          </li>
        ))}
      </ol>
      <span className={s.why}>{st.why}</span>
      <span className={s.spacer} />
      {done ? <DonePanel points={st.points} done={done} onRate={onRate} />
        : <div className={s.actions}>
            <Button variant="secondary" size="lg" pill onClick={onDone}>I did it</Button>
            <Button size="lg" pill icon="play" className={s.grow} onClick={onStart}>Start workout</Button>
          </div>}
    </section>
  )
}

function DonePanel({ points, done, onRate }: { points: number; done: Activity; onRate: (f: Feel) => void }) {
  return (
    <div className={s.donePanel}>
      <span className={s.doneStamp}><Icon name="tick" size={22} stroke={3} />Done · +{points}<Star size={18} /></span>
      <span role="group" aria-label="How did it feel?" className={s.feelRow}>
        {FEELS.map((f) => (
          <button key={f.id} type="button" aria-pressed={done.feel === f.id} className={s.feel} onClick={() => onRate(f.id)}>{f.label}</button>
        ))}
      </span>
    </div>
  )
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return <span className={s.stat}><span className={s.statValue}>{value}</span><span className={s.statUnit}>{unit}</span></span>
}

const kindGroup = (k: ActivityKind) => (k === 'strength' ? 'strength' : k === 'mobility' ? 'mobility' : 'cardio')

function MonthCard({ member, activities }: { member: Member; activities: Activity[] }) {
  const mine = activities.filter((a) => a.memberId === member.id)
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (34 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const groups = new Set(mine.filter((a) => a.date === key).map((a) => kindGroup(a.kind)))
    const kind = groups.size > 1 ? 'both' : groups.size ? [...groups][0] : 'none'
    return { key, kind, today: i === 34, day: d.getDay() }
  })
  const pad = days[0]!.day
  const month = mine.filter((a) => days.slice(5).some((d) => d.key === a.date))
  const miles = month.reduce((n, a) => n + (a.distanceMi ?? 0), 0)
  let streak = 0
  for (let i = days.length - 1; i >= 0 && days[i]!.kind !== 'none'; i--) streak++

  return (
    <section key={member.id} className={s.month} aria-label="Last 30 days">
      <div className={s.monthHead}>
        <span className={s.monthTitle}>Last 30 days</span>
        {streak > 1 && <span className={s.streak}><Icon name="sun" size={20} stroke={2.6} />{streak}-day streak</span>}
      </div>
      <div className={s.weekdays} aria-hidden="true">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className={s.heat}>
        {Array.from({ length: pad }, (_, i) => <span key={`p${i}`} />)}
        {days.map((d, i) => (
          <span key={d.key} title={d.key} data-kind={d.kind} className={d.today ? `${s.cell} ${s.cellToday}` : s.cell} style={{ ['--n' as string]: i }} />
        ))}
      </div>
      <div className={s.legend}>
        <span><i data-kind="cardio" />Cardio</span><span><i data-kind="strength" />Strength</span><span><i data-kind="both" />Both</span><span><i data-kind="mobility" />Mobility</span>
      </div>
      <div className={s.totals}>
        <Stat value={String(month.length)} unit="workouts" />
        <Stat value={miles.toFixed(1)} unit="miles" />
        <Stat value={String(month.filter((a) => a.kind === 'strength').length)} unit="strength" />
      </div>
    </section>
  )
}

function WeekCard({ athletes, activities }: { athletes: Member[]; activities: Activity[] }) {
  const start = new Date(); start.setDate(start.getDate() - start.getDay())
  const keys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const todayIdx = new Date().getDay()
  return (
    <section className={s.week} aria-label="This week">
      <Label>This week</Label>
      {athletes.map((m) => {
        const mine = activities.filter((a) => a.memberId === m.id && keys.includes(a.date))
        return (
          <div key={m.id} {...memberColorProps(m.color)} className={s.weekRow}>
            <MemberBlobAvatar memberId={m.id} size={36} decorative className={s.weekAvatar} />
            <span className={s.weekDots}>
              {keys.map((k, i) => {
                const did = mine.some((a) => a.date === k)
                return <span key={k} className={[s.weekDot, did && s.weekDotOn, i === todayIdx && s.weekDotToday].filter(Boolean).join(' ')} style={{ ['--n' as string]: i }} />
              })}
            </span>
            <span className={s.weekCount}>{mine.length}</span>
          </div>
        )
      })}
    </section>
  )
}

const LOG_KINDS: { kind: ActivityKind; label: string; icon: IconName }[] = [
  { kind: 'run', label: 'Run', icon: 'shoe' }, { kind: 'walk', label: 'Walk', icon: 'stroller' }, { kind: 'bike', label: 'Bike', icon: 'bike' },
  { kind: 'strength', label: 'Strength', icon: 'dumbbell' }, { kind: 'mobility', label: 'Stretch', icon: 'leaf' },
]

function QuickLog({ member, onLog }: { member: Member; onLog: (a: Omit<Activity, 'id' | 'date' | 'source'>) => void }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ActivityKind>('walk')
  const [minutes, setMinutes] = useState(30)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className={s.logWrap}>
      <Button variant="rail" size="lg" pill icon="plus" onClick={() => setOpen((o) => !o)}>Log a workout</Button>
      {open && (
        <div className={s.logPop} role="dialog" aria-label="Log a workout">
          <Label>What did {member.name} do?</Label>
          <div className={s.logKinds}>
            {LOG_KINDS.map((k) => (
              <button key={k.kind} type="button" aria-pressed={kind === k.kind} className={s.logKind} onClick={() => setKind(k.kind)}>
                <Icon name={k.icon} size={30} stroke={2.2} />{k.label}
              </button>
            ))}
          </div>
          <div className={s.logMinutes}>
            <span className={s.logMinLabel}>Minutes</span>
            <IconButton variant="secondary" icon="minus" label="Fewer minutes" onClick={() => setMinutes((m) => Math.max(5, m - 5))} />
            <span key={minutes} className={`${s.logMinValue} anim-pop`}>{minutes}</span>
            <IconButton variant="secondary" icon="plus" label="More minutes" onClick={() => setMinutes((m) => Math.min(180, m + 5))} />
          </div>
          <span className={s.logNote}>Extra workouts don’t earn stars, but the coach uses them to plan.</span>
          <Button size="lg" pill block onClick={() => { onLog({ memberId: member.id, kind, title: LOG_KINDS.find((k) => k.kind === kind)!.label, minutes }); setOpen(false) }}>Save</Button>
        </div>
      )}
    </div>
  )
}
