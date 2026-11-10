import { useState } from 'react'
import { AppShell, Fab, PageHeader } from '../components/AppShell'
import { Button, IconButton } from '../components/Button'
import { Avatar, Label, Panel, Rail, Segmented } from '../components/primitives'
import { EVENTS, FAMILY, MEMBERS } from '../data/mock'
import { useClock } from '../hooks/useClock'
import { addDays, hourLabel, shortDay, startOfWeek, weekRange } from '../lib/format'
import { who } from '../lib/members'
import s from './Calendar.module.css'

const START_HOUR = 7
const END_HOUR = 20
const HOUR_PX = 56
type View = 'day' | 'week' | 'month' | 'agenda'

export default function Calendar() {
  const now = useClock()
  const [view, setView] = useState<View>('week')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const weekStart = startOfWeek(now)
  const todayIdx = now.getDay()
  const people = [...MEMBERS, FAMILY]
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const nowHour = now.getHours() + now.getMinutes() / 60
  const showNow = nowHour >= START_HOUR && nowHour <= END_HOUR

  const toggle = (id: string) => setHidden((h) => {
    const n = new Set(h)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  return (
    <AppShell fab={<Fab label="Add event" onClick={() => {}} />}>
      <PageHeader
        title={weekRange(now)}
        actions={<>
          <Segmented label="Calendar view" value={view} onChange={setView} options={[
            { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'agenda', label: 'Agenda' },
          ]} />
          <Rail label="Week">
            <IconButton variant="ghost" icon="chevron-left" label="Previous week" />
            <Button variant="surface" pill>Today</Button>
            <IconButton variant="ghost" icon="chevron-right" label="Next week" />
          </Rail>
        </>}
      />

      <div className={s.filters}>
        <Label>Showing</Label>
        {people.map((p) => {
          const on = !hidden.has(p.id)
          return (
            <button key={p.id} type="button" data-color={p.color} aria-pressed={on} className={on ? s.person : `${s.person} ${s.personOff}`} onClick={() => toggle(p.id)}>
              <Avatar initial={p.initial} color={p.color} size="sm" muted={!on} />
              {p.name}
            </button>
          )
        })}
        <span className={s.synced}>Synced from Google · 4 min ago</span>
      </div>

      <Panel pad="none" className={s.cal} aria-label={`Week of ${weekRange(now)}`}>
        <div className={s.row}>
          <div />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={s.dayHead}>
              <span className={s.dayName}>{shortDay(i)}</span>
              <span className={i === todayIdx ? `${s.dayNum} ${s.dayToday}` : s.dayNum}>{addDays(weekStart, i).getDate()}</span>
            </div>
          ))}
        </div>
        <div className={`${s.row} ${s.allDayRow}`}>
          <div className={s.allDayLabel}>All day</div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={s.allDayCell}>
              {EVENTS.filter((e) => e.allDay && e.day === i && !hidden.has(e.who)).map((e) => (
                <span key={e.id} data-color={who(e.who).color} className={s.allDay}>{e.title}</span>
              ))}
            </div>
          ))}
        </div>
        <div className={`${s.body} scroll-y`}>
          <div className={s.grid} style={{ height: hours.length * HOUR_PX }}>
            <div className={s.gutter}>
              {hours.map((h, i) => (
                <span key={h} className={s.hour} style={{ top: i === 0 ? 4 : i * HOUR_PX - 9 }}>{hourLabel(h)}</span>
              ))}
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={i === todayIdx ? `${s.dayCol} ${s.dayColToday}` : s.dayCol}>
                {EVENTS.filter((e) => !e.allDay && e.day === i && !hidden.has(e.who)).map((e) => {
                  const long = e.end - e.start >= 1
                  return (
                    <div key={e.id} data-color={who(e.who).color} className={s.event}
                      style={{ top: (e.start - START_HOUR) * HOUR_PX + 2, height: (e.end - e.start) * HOUR_PX - 4 }}>
                      <span className={s.eventTitle}>{e.title}</span>
                      {long && <span className={s.eventTime}>{hourLabel(e.start)} – {hourLabel(e.end)}</span>}
                    </div>
                  )
                })}
                {i === todayIdx && showNow && (
                  <div className={s.now} style={{ top: (nowHour - START_HOUR) * HOUR_PX }} aria-label="Now" />
                )}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </AppShell>
  )
}
