import { useState } from 'react'
import { AppShell, Fab, PageHeader } from '../components/AppShell'
import { Button, IconButton } from '../components/Button'
import { Avatar, CheckMark, IconTile, Progress, Rail, Segmented } from '../components/primitives'
import { useCompleted, useMembers, useTasks, useToggleTask, useWeather } from '../data/hooks'
import { useLive } from '../data/live'
import { localDate } from '../data/mappers'
import { HOME_COLUMN } from '../data/mock'
import { useClock } from '../hooks/useClock'
import { clock, monthDay, weekday } from '../lib/format'
import type { Member, Routine } from '@hub/shared'
import type { Task } from '../lib/types'
import s from './Tasks.module.css'

const ROUTINES: { value: Routine; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'chores', label: 'Chores' },
]

export default function Tasks() {
  const now = useClock()
  const today = localDate(now)
  const members = useMembers()
  const tasks = useTasks()
  const completed = useCompleted(today)
  const weather = useWeather()
  useLive('tasks', 'tasks')
  useLive('task_completions', 'completions')

  if (!members.data || !tasks.data || !completed.data) return <AppShell>{null}</AppShell>
  return (
    <TasksView
      now={now}
      today={today}
      members={members.data}
      tasks={tasks.data}
      completed={completed.data}
      weather={weather.data}
    />
  )
}

function TasksView({ now, today, members, tasks, completed, weather }: {
  now: Date; today: string; members: Member[]; tasks: Task[]; completed: string[]
  weather?: { temp: number; condition: string } | null
}) {
  const toggleTask = useToggleTask()
  const done = new Set(completed)
  const toggle = (id: string) => toggleTask.mutate({ taskId: id, done: !done.has(id), date: today })
  const forecast = weather ? `${weather.temp}° ${weather.condition.toLowerCase()}` : '…'

  return (
    <AppShell fab={<Fab label="Quick add" onClick={() => {}} />}>
      <PageHeader
        eyebrow={`${weekday(now)} · ${forecast}`}
        title={<>{monthDay(now)} <span className={s.clock}>{clock(now)}</span></>}
        actions={
          <Rail label="Day">
            <Button variant="ghost" pill icon="filter">Filter</Button>
            <IconButton variant="ghost" icon="chevron-left" label="Previous day" />
            <Button variant="surface" pill>Today</Button>
            <IconButton variant="ghost" icon="chevron-right" label="Next day" />
          </Rail>
        }
      />
      <div className={`${s.board} scroll-x`}>
        {[...members, HOME_COLUMN].map((m) => (
          <Column key={m.id} member={m} tasks={tasks.filter((t) => t.memberId === m.id)} done={done} onToggle={toggle} />
        ))}
      </div>
    </AppShell>
  )
}

function Column({ member, tasks, done, onToggle }: { member: Member; tasks: Task[]; done: Set<string>; onToggle: (id: string) => void }) {
  const [routine, setRoutine] = useState<Routine>(member.id === 'home' ? 'chores' : 'morning')
  const doneCount = tasks.filter((t) => done.has(t.id)).length
  const points = tasks.filter((t) => done.has(t.id)).reduce((sum, t) => sum + t.points, 0)
  const visible = tasks.filter((t) => t.routine === routine)
  const routineDone = visible.length > 0 && visible.every((t) => done.has(t.id))
  const label = ROUTINES.find((r) => r.value === routine)!.label

  return (
    <section data-color={member.color} className={s.column} aria-label={`${member.name}'s tasks`}>
      <div className={s.head}>
        <div className={s.who}>
          <Avatar initial={member.initial} color={member.color} />
          <div className={s.whoText}>
            <div className={s.name}>{member.name}</div>
            <div className={s.sub}>{doneCount}/{tasks.length} done today</div>
          </div>
          {member.earnsPoints && (
            <div className={s.points}>
              <div className={s.pointsValue}>{points}</div>
              <div className={s.pointsLabel}>points</div>
            </div>
          )}
        </div>
        <Progress value={doneCount / tasks.length} label={`${member.name}: ${doneCount} of ${tasks.length} tasks done`} />
      </div>

      <Segmented
        variant="member"
        block
        label={`${member.name}'s routines`}
        value={routine}
        onChange={setRoutine}
        options={ROUTINES.map((r) => {
          const list = tasks.filter((t) => t.routine === r.value)
          return { ...r, sub: `${list.filter((t) => done.has(t.id)).length}/${list.length}` }
        })}
      />

      {routineDone && (
        <div className={`${s.celebrate} anim-pop`} role="status">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          {label} all wrapped up
        </div>
      )}

      <ul className={`${s.list} scroll-y`}>
        {visible.map((t) => {
          const isDone = done.has(t.id)
          return (
            <li key={t.id}>
              <button type="button" className={s.task} aria-pressed={isDone} onClick={() => onToggle(t.id)}>
                <IconTile icon={t.icon} color={member.color} />
                <span className={s.taskText}>
                  <span className={s.taskTitle}>{t.title}</span>
                  {t.points > 0 && <span className={s.taskPts}>+{t.points} points</span>}
                </span>
                <CheckMark checked={isDone} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
