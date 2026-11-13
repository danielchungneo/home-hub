import { useEffect, useRef, useState } from 'react'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import type { BlobAnimation } from '../../components/BlobAvatar'
import { Progress } from '../../components/primitives'
import { useMembers, useRewards } from '../../data/hooks'
import { useClock } from '../../hooks/useClock'
import { memberColorProps } from '../../lib/colors'
import { dueDayOf, dueLabel, isActive, scheduleLabel } from '../../lib/tasks'
import type { Frequency, Member, Reward, Task, TaskTemplate } from '../../types'
import { AddTaskSheet, type SheetPreset } from './AddTaskSheet'
import { BountyBoard } from './BountyBoard'
import { useTasks } from './useTasks'
import s from './Tasks.module.css'

const FLOAT_MS = 1100
const ARRIVE_MS = 900

export default function Tasks() {
  const now = useClock()
  const today = now.getDay()
  const membersQ = useMembers()
  const members = membersQ.data ?? []
  const state = useTasks()
  const { tasks, done, sunk, template, toggle, claim, add, balances } = state

  const [personId, setPersonId] = useState('')
  const [sheet, setSheet] = useState<SheetPreset | null>(() => (window.location.hash === '#tasks-add' ? {} : null))
  const [floating, setFloating] = useState<string | null>(null)
  const [arrived, setArrived] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [heroMotion, setHeroMotion] = useState<BlobAnimation>('idle')
  const [heroMotionKey, setHeroMotionKey] = useState(0)
  const timers = useRef<number[]>([])
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!members.length) return
    if (!members.some((m) => m.id === personId)) setPersonId(members[0]!.id)
  }, [members, personId])

  const person = members.find((m) => m.id === personId)
  if (!person) {
    return (
      <AppShell>
        <PageHeader title="Tasks" />
        <div className={s.body}>
          <p className={s.emptyHint}>Add someone in Settings → Family to start assigning tasks.</p>
        </div>
      </AppShell>
    )
  }

  const mine = tasks.filter((t) => t.memberId === personId && isActive(t, now))
  const daily = mine.filter((t) => t.frequency === 'daily')
  const weekly = mine.filter((t) => t.frequency === 'weekly')
  const earnedToday = mine.filter((t) => done.has(t.id)).reduce((n, t) => n + t.points, 0)
  const earnedNew = mine.filter((t) => done.has(t.id) && !sunk.has(t.id)).reduce((n, t) => n + t.points, 0)
  const balance = (balances[personId] ?? 0) + earnedNew

  const onToggle = (t: Task) => {
    const finishing = !done.has(t.id)
    toggle(t.id)
    setFloating(finishing ? t.id : null)
    if (finishing) {
      setHeroMotion('celebrate')
      setHeroMotionKey((n) => n + 1)
      later(FLOAT_MS, () => setFloating((f) => (f === t.id ? null : f)))
    }
  }

  const onClaim = (bountyId: string) => {
    const task = claim(bountyId, personId)
    if (!task) {
      setToast('Bounties aren’t wired to Supabase yet.')
      return
    }
    setArrived(task.id)
    later(ARRIVE_MS, () => setArrived(null))
    setToast(`${template(task.templateId).title} is yours: +${task.points} points when it’s done`)
  }

  const left = (id: string) => tasks.filter((t) => t.memberId === id && isActive(t, now) && !done.has(t.id)).length

  return (
    <AppShell>
      <PageHeader
        title={<span key={personId} className={s.title}>{person.earnsPoints ? `${person.name}’s tasks` : `${person.name}’s care`}</span>}
        actions={<>
          <div role="group" aria-label="Whose tasks" className={s.people}>
            {members.map((m) => {
              const n = left(m.id)
              return (
                <button key={m.id} type="button" {...memberColorProps(m.color)} aria-pressed={m.id === personId} className={s.person}
                  onClick={() => setPersonId(m.id)}>
                  <span className={s.personAvatar}>
                    <MemberBlobAvatar memberId={m.id} size={48} showBackground={false} decorative />
                  </span>
                  <span className={s.personText}>
                    <span className={s.personName}>{m.name}</span>
                    <span className={s.personLeft}>{n ? `${n} left` : 'All done'}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <Button size="lg" pill icon="plus" className={s.addBtn} onClick={() => setSheet({})}>Add a task</Button>
        </>}
      />

      <div className={s.body}>
        <section key={personId} {...memberColorProps(person.color)} className={s.focus} aria-label={`${person.name}’s tasks`}>
          <Hero
          member={person}
          daily={daily}
          weekly={weekly}
          done={done}
          earnedToday={earnedToday}
          balance={balance}
          motion={heroMotion}
          motionKey={heroMotionKey}
        />
          <div className={s.lists}>
            {(['daily', 'weekly'] as Frequency[]).map((f) => (
              <TaskList key={f} frequency={f} member={person} tasks={f === 'daily' ? daily : weekly} today={today} now={now}
                done={done} sunk={sunk} template={template} floating={floating} arrived={arrived}
                onToggle={onToggle} onAdd={() => setSheet({ frequency: f })} />
            ))}
          </div>
        </section>

        <BountyBoard bounties={state.bounties} members={members} member={person} today={today} template={template}
          onClaim={onClaim} onAdd={() => setSheet({ assignee: 'bounty' })} />
      </div>

      {sheet && (
        <AddTaskSheet
          members={members}
          preset={{ assignee: personId, ...sheet }}
          templates={state.templates}
          now={now}
          onClose={() => setSheet(null)}
          onSave={(input, isNew) => {
            const r = add(input)
            setSheet(null)
            if (!r) {
              setToast('Adding tasks isn’t wired to Supabase yet.')
              return
            }
            if (input.assignee !== 'bounty') {
              setPersonId(input.assignee)
              setArrived(r.taskId)
              later(ARRIVE_MS, () => setArrived(null))
            }
            const whoName = members.find((m) => m.id === input.assignee)?.name ?? 'someone'
            const where = input.assignee === 'bounty' ? ' to the bounty board'
              : ` to ${whoName}’s ${input.frequency === 'weekly' ? 'week' : 'day'}`
            setToast(isNew ? `Saved “${r.title}” to the library and added it${where}` : `Added ${r.title}${where}`)
          }}
        />
      )}

      {toast && <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
    </AppShell>
  )
}

/* ---------------- Hero ---------------- */

function Hero({ member, daily, weekly, done, earnedToday, balance, motion = 'idle', motionKey = 0 }: {
  member: Member; daily: Task[]; weekly: Task[]; done: Set<string>; earnedToday: number; balance: number
  motion?: BlobAnimation; motionKey?: number
}) {
  const rewardsQ = useRewards()
  const all = [...daily, ...weekly]
  const doneCount = all.filter((t) => done.has(t.id)).length
  const dd = daily.filter((t) => done.has(t.id)).length
  const wd = weekly.filter((t) => done.has(t.id)).length
  const rewards = [...(rewardsQ.data ?? [])].sort((a, b) => a.cost - b.cost)
  const next = rewards.find((r) => r.cost > balance)
  const readyGoal = [...rewards].reverse().find((r) => r.cost <= balance)
  const goal: Reward | undefined = next ?? readyGoal

  return (
    <div className={s.hero}>
      <span className={s.heroAvatar} aria-hidden="true">
        <MemberBlobAvatar
          memberId={member.id}
          size={96}
          showBackground={false}
          animation={motion}
          animationKey={motionKey}
          decorative
        />
      </span>
      <div className={s.heroMain}>
        <span className={s.greeting}>{member.earnsPoints ? `Good ${partOfDay()}, ${member.name}` : `${member.name}’s day so far`}</span>
        <div className={s.segs} role="progressbar" aria-label="Done" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={doneCount}>
          {all.map((t, i) => (
            <span key={t.id} className={s.seg}>
              <span className={s.segFill} style={{ transform: `scaleX(${i < doneCount ? 1 : 0})`, transitionDelay: `${i * 40}ms` }} />
            </span>
          ))}
        </div>
        <span className={s.heroSub}>{dd} of {daily.length} done today · {wd} of {weekly.length} this week</span>
      </div>
      {member.earnsPoints ? (
        <div className={s.heroStats}>
          <div className={s.stat}>
            <span className={s.statLabel}>Today</span>
            <span key={earnedToday} className={`${s.statValue} anim-pop`}>+{earnedToday}</span>
          </div>
          <span className={s.statRule} />
          <div className={s.goal}>
            <span className={s.statLabel}>{balance} points</span>
            {goal && <>
              <Progress value={Math.min(1, balance / goal.cost)} label={`Progress to ${goal.title}`} />
              <span className={s.goalLine}>{goal.cost > balance ? `${goal.cost - balance} more for ${goal.title}` : `${goal.title} is ready!`}</span>
            </>}
          </div>
        </div>
      ) : (
        <span className={s.carePill}>Baby care · anyone can check these off</span>
      )}
    </div>
  )
}

function partOfDay() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

/* ---------------- Daily / weekly list ---------------- */

const LIST_COPY: Record<Frequency, { kicker: string; title: string; icon: 'sun' | 'calendar'; add: string; wrapped: string }> = {
  daily: { kicker: 'Daily', title: 'Today', icon: 'sun', add: 'Add a daily task', wrapped: 'Today’s all wrapped up' },
  weekly: { kicker: 'Weekly · resets Sunday', title: 'This week', icon: 'calendar', add: 'Add a weekly task', wrapped: 'The week’s list is done' },
}

function TaskList({ frequency, member, tasks, today, now, done, sunk, template, floating, arrived, onToggle, onAdd }: {
  frequency: Frequency; member: Member; tasks: Task[]; today: number; now: Date
  done: Set<string>; sunk: Set<string>; template: (id: string) => TaskTemplate
  floating: string | null; arrived: string | null
  onToggle: (t: Task) => void; onAdd: () => void
}) {
  const copy = LIST_COPY[frequency]
  const doneCount = tasks.filter((t) => done.has(t.id)).length
  const allDone = tasks.length > 0 && doneCount === tasks.length
  const earned = tasks.reduce((n, t) => n + t.points, 0)
  // Bounties first, then open tasks by due day; tasks done before the screen opened sink to the bottom.
  const sorted = [...tasks].sort((a, b) =>
    Number(!!b.bountyId) - Number(!!a.bountyId)
    || Number(sunk.has(a.id) && done.has(a.id)) - Number(sunk.has(b.id) && done.has(b.id))
    || (dueDayOf(a.schedule) ?? 9) - (dueDayOf(b.schedule) ?? 9))

  return (
    <section className={s.list} aria-label={copy.title}>
      <div className={s.listHead}>
        <span className={s.listIcon}><Icon name={copy.icon} size={32} stroke={2.2} /></span>
        <span className={s.listTitles}>
          <span className={s.listKicker}>{copy.kicker}</span>
          <span className={s.listTitle}>{copy.title}</span>
        </span>
        <span className={s.listCount}>{doneCount} of {tasks.length}</span>
        <IconButton icon="plus" label={copy.add} onClick={onAdd} />
      </div>
      <Progress value={tasks.length ? doneCount / tasks.length : 0} label={`${copy.title}: ${doneCount} of ${tasks.length} done`} />
      {allDone && (
        <div className={`${s.wrapped} anim-pop`} role="status">
          <Icon name="sparkle" size={28} stroke={2.2} />
          <span className={s.wrappedText}>{copy.wrapped}</span>
          <span className={s.wrappedSub}>{member.earnsPoints ? `+${earned} points` : 'Nice work, team'}</span>
        </div>
      )}
      <ul className={`${s.cards} scroll-y`}>
        {sorted.map((t, i) => (
          <li key={t.id} style={{ ['--n' as string]: i }}>
            <TaskCard task={t} tpl={template(t.templateId)} member={member} done={done.has(t.id)} today={today} now={now}
              floating={floating === t.id} arriving={arrived === t.id} onToggle={() => onToggle(t)} />
          </li>
        ))}
        {!tasks.length && <li><button type="button" className={s.emptyAdd} onClick={onAdd}><Icon name="plus" size={20} />{copy.add}</button></li>}
      </ul>
    </section>
  )
}

function TaskCard({ task: t, tpl, member, done, today, now, floating, arriving, onToggle }: {
  task: Task; tpl: TaskTemplate; member: Member; done: boolean; today: number; now: Date
  floating: boolean; arriving: boolean; onToggle: () => void
}) {
  const dueDay = dueDayOf(t.schedule)
  const due = t.frequency === 'weekly' && !t.bountyId && !done && dueDay !== undefined ? dueLabel(dueDay, today) : null
  const meta = t.bountyId ? (dueDay === today ? 'Today' : 'This week') : done && t.frequency === 'weekly' ? 'Done this week' : scheduleLabel(t.schedule, now)
  const cls = [s.card, done && s.cardDone, t.bountyId && s.cardBounty, arriving && s.arrive].filter(Boolean).join(' ')
  return (
    <button type="button" aria-pressed={done} className={cls} onClick={onToggle}
      aria-label={`${tpl.title}${done ? ', done. Tap to undo' : ', tap when done'}`}>
      <span className={s.tile}><Icon name={tpl.icon} size={36} stroke={2.2} /></span>
      <span className={s.cardText}>
        <span className={s.cardTitle}>{tpl.title}</span>
        <span className={s.cardMeta}>
          {t.bountyId && <span className={s.bountyTag}>Bounty</span>}
          {member.earnsPoints && t.points > 0 && <span className={s.cardPts}>+{t.points} pts</span>}
          <span className={s.cardSchedule}>{meta}</span>
        </span>
      </span>
      {due && <span className={s.due} data-tone={due.tone}>{due.text}</span>}
      <span className={done ? `${s.check} ${s.checkOn} anim-pop` : s.check} aria-hidden="true">
        {done && <Icon name="tick" size={28} stroke={3} />}
      </span>
      {floating && member.earnsPoints && t.points > 0 && <span className={s.float} aria-hidden="true">+{t.points}</span>}
    </button>
  )
}
