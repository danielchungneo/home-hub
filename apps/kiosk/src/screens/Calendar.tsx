import { useMemo, useState, type ReactNode } from 'react'
import type { CalendarEvent } from '@hub/shared'
import { AppShell, Fab, PageHeader } from '../components/AppShell'
import { Button, IconButton } from '../components/Button'
import { Avatar, Label, Panel, Rail, Segmented } from '../components/primitives'
import { useCalendarSources, useEvents, useMembers, useSyncCalendars } from '../data/hooks'
import { useLive } from '../data/live'
import { FAMILY } from '../data/mock'
import { useClock } from '../hooks/useClock'
import {
  addDays,
  addMonths,
  hourLabel,
  longDate,
  monthYear,
  sameDay,
  shortDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekRange,
  weekday,
} from '../lib/format'
import { who } from '../lib/members'
import s from './Calendar.module.css'

const START_HOUR = 7
const END_HOUR = 20
const HOUR_PX = 56
const AGENDA_DAYS = 21
type View = 'day' | 'week' | 'month' | 'agenda'

function syncedLabel(iso?: string, syncing?: boolean) {
  if (syncing) return 'Syncing from Google…'
  if (!iso) return 'Waiting for first Google sync'
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (mins < 1) return 'Synced from Google · just now'
  if (mins === 1) return 'Synced from Google · 1 min ago'
  if (mins < 60) return `Synced from Google · ${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `Synced from Google · ${hrs} hr${hrs === 1 ? '' : 's'} ago`
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function eventStartDate(e: CalendarEvent, rangeStart: Date) {
  if (e.startsAt) return new Date(e.startsAt)
  return addDays(rangeStart, e.day)
}

function eventOnDay(e: CalendarEvent, day: Date, rangeStart: Date) {
  // All-day events are stored as UTC calendar-date bounds from Google.
  if (e.allDay && e.startsAt) {
    const startKey = e.startsAt.slice(0, 10)
    const endKey = (e.endsAt ?? e.startsAt).slice(0, 10)
    const dayKey = localDateKey(day)
    return dayKey >= startKey && dayKey <= endKey
  }
  return sameDay(eventStartDate(e, rangeStart), day)
}

export default function Calendar() {
  const now = useClock()
  const [view, setView] = useState<View>('week')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))

  const members = useMembers()
  const sources = useCalendarSources()
  const sync = useSyncCalendars()
  useLive('events', 'events')
  useLive('calendar_sources', 'calendarSources')

  const range = useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(cursor)
      return { start, end: addDays(start, 1) }
    }
    if (view === 'month') {
      const gridStart = startOfWeek(startOfMonth(cursor))
      return { start: gridStart, end: addDays(gridStart, 42) }
    }
    if (view === 'agenda') {
      const start = startOfDay(cursor)
      return { start, end: addDays(start, AGENDA_DAYS) }
    }
    const start = startOfWeek(cursor)
    return { start, end: addDays(start, 7) }
  }, [cursor, view])

  const eventsQuery = useEvents(range.start, range.end)
  const events = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => !hidden.has(e.who)),
    [eventsQuery.data, hidden],
  )

  const people = useMemo(() => {
    const live = members.data ?? []
    return [...live.map((m) => ({ id: m.id, name: m.name, initial: m.initial, color: m.color })), FAMILY]
  }, [members.data])

  const lastSynced = useMemo(() => {
    const times = (sources.data ?? [])
      .map((src) => src.lastSyncedAt)
      .filter((x): x is string => Boolean(x))
      .map((x) => Date.parse(x))
    if (!times.length) return undefined
    return new Date(Math.max(...times)).toISOString()
  }, [sources.data])

  const onToday =
    view === 'month'
      ? cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()
      : view === 'week'
        ? sameDay(startOfWeek(cursor), startOfWeek(now))
        : sameDay(cursor, now)

  const title =
    view === 'day' || view === 'agenda' ? longDate(cursor)
      : view === 'month' ? monthYear(cursor)
        : weekRange(cursor)

  const navLabel =
    view === 'day' ? 'Day'
      : view === 'month' ? 'Month'
        : view === 'agenda' ? 'Agenda'
          : 'Week'

  const step = (dir: -1 | 1) => {
    setCursor((c) => {
      if (view === 'month') return addMonths(c, dir)
      if (view === 'week') return addDays(c, dir * 7)
      return addDays(c, dir)
    })
  }

  const toggle = (id: string) => setHidden((h) => {
    const n = new Set(h)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  let body: ReactNode
  if (view === 'day') {
    body = (
      <TimeGrid
        days={[startOfDay(cursor)]}
        rangeStart={range.start}
        events={events}
        now={now}
        single
      />
    )
  } else if (view === 'month') {
    body = (
      <MonthGrid
        cursor={cursor}
        rangeStart={range.start}
        events={events}
        now={now}
        onSelectDay={(d) => {
          setCursor(startOfDay(d))
          setView('day')
        }}
      />
    )
  } else if (view === 'agenda') {
    body = <AgendaList cursor={cursor} rangeStart={range.start} events={events} now={now} />
  } else {
    body = (
      <TimeGrid
        days={Array.from({ length: 7 }, (_, i) => addDays(range.start, i))}
        rangeStart={range.start}
        events={events}
        now={now}
      />
    )
  }

  return (
    <AppShell fab={<Fab label="Add event" onClick={() => {}} />}>
      <PageHeader
        title={title}
        actions={<>
          <Segmented label="Calendar view" value={view} onChange={setView} options={[
            { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'agenda', label: 'Agenda' },
          ]} />
          <Rail label={navLabel}>
            <IconButton variant="ghost" icon="chevron-left" label={`Previous ${navLabel.toLowerCase()}`} onClick={() => step(-1)} />
            <Button
              variant={onToday ? 'surface' : 'ghost'}
              pill
              onClick={() => setCursor(startOfDay(now))}
            >
              Today
            </Button>
            <IconButton variant="ghost" icon="chevron-right" label={`Next ${navLabel.toLowerCase()}`} onClick={() => step(1)} />
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
        <div className={s.syncRow}>
          <span className={s.synced}>
            {sync.isError ? 'Sync failed · try again' : syncedLabel(lastSynced, sync.isPending)}
          </span>
          <Button
            variant="secondary"
            pill
            icon="refresh"
            disabled={sync.isPending}
            className={sync.isPending ? s.syncing : undefined}
            onClick={() => void sync.mutateAsync()}
          >
            {sync.isPending ? 'Syncing' : 'Sync'}
          </Button>
        </div>
      </div>

      <Panel pad="none" className={s.cal} aria-label={title}>
        {body}
      </Panel>
    </AppShell>
  )
}

function TimeGrid({
  days,
  rangeStart,
  events,
  now,
  single,
}: {
  days: Date[]
  rangeStart: Date
  events: CalendarEvent[]
  now: Date
  single?: boolean
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const nowHour = now.getHours() + now.getMinutes() / 60
  const showNow = nowHour >= START_HOUR && nowHour <= END_HOUR
  const cols = days.length
  const gridStyle = { gridTemplateColumns: single ? '76px minmax(0, 1fr)' : `76px repeat(${cols}, minmax(0, 1fr))` }

  return (
    <>
      <div className={s.row} style={gridStyle}>
        <div />
        {days.map((d) => {
          const isToday = sameDay(d, now)
          return (
            <div key={d.toISOString()} className={s.dayHead}>
              <span className={s.dayName}>{shortDay(d.getDay())}</span>
              <span className={isToday ? `${s.dayNum} ${s.dayToday}` : s.dayNum}>{d.getDate()}</span>
            </div>
          )
        })}
      </div>
      <div className={`${s.row} ${s.allDayRow}`} style={gridStyle}>
        <div className={s.allDayLabel}>All day</div>
        {days.map((d) => (
          <div key={d.toISOString()} className={s.allDayCell}>
            {events.filter((e) => e.allDay && eventOnDay(e, d, rangeStart)).map((e) => (
              <span key={e.id} data-color={who(e.who).color} className={s.allDay}>{e.title}</span>
            ))}
          </div>
        ))}
      </div>
      <div className={`${s.body} scroll-y`}>
        <div className={s.grid} style={{ ...gridStyle, height: hours.length * HOUR_PX }}>
          <div className={s.gutter}>
            {hours.map((h, i) => (
              <span key={h} className={s.hour} style={{ top: i === 0 ? 4 : i * HOUR_PX - 9 }}>{hourLabel(h)}</span>
            ))}
          </div>
          {days.map((d) => {
            const isToday = sameDay(d, now)
            return (
              <div key={d.toISOString()} className={isToday ? `${s.dayCol} ${s.dayColToday}` : s.dayCol}>
                {events.filter((e) => !e.allDay && eventOnDay(e, d, rangeStart)).map((e) => {
                  const start = Math.max(START_HOUR, e.start)
                  const end = Math.min(END_HOUR, Math.max(start + 0.25, e.end))
                  const long = end - start >= 1
                  return (
                    <div key={e.id} data-color={who(e.who).color} className={s.event}
                      style={{ top: (start - START_HOUR) * HOUR_PX + 2, height: (end - start) * HOUR_PX - 4 }}>
                      <span className={s.eventTitle}>{e.title}</span>
                      {long && <span className={s.eventTime}>{hourLabel(start)} – {hourLabel(end)}</span>}
                    </div>
                  )
                })}
                {isToday && showNow && (
                  <div className={s.now} style={{ top: (nowHour - START_HOUR) * HOUR_PX }} aria-label="Now" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function MonthGrid({
  cursor,
  rangeStart,
  events,
  now,
  onSelectDay,
}: {
  cursor: Date
  rangeStart: Date
  events: CalendarEvent[]
  now: Date
  onSelectDay: (d: Date) => void
}) {
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(rangeStart, i)), [rangeStart])
  const month = cursor.getMonth()

  return (
    <div className={s.month}>
      <div className={s.monthHead}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={s.monthDow}>{shortDay(i)}</span>
        ))}
      </div>
      <div className={s.monthGrid}>
        {days.map((d) => {
          const inMonth = d.getMonth() === month
          const isToday = sameDay(d, now)
          const dayEvents = events.filter((e) => eventOnDay(e, d, rangeStart))
          const shown = dayEvents.slice(0, 3)
          const more = dayEvents.length - shown.length
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={[
                s.monthCell,
                !inMonth && s.monthCellMuted,
                isToday && s.monthCellToday,
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDay(d)}
              aria-label={`${longDate(d)}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
            >
              <span className={isToday ? `${s.monthNum} ${s.dayToday}` : s.monthNum}>{d.getDate()}</span>
              <div className={s.monthEvents}>
                {shown.map((e) => (
                  <span key={e.id} data-color={who(e.who).color} className={s.monthEvent}>
                    {e.allDay ? e.title : `${hourLabel(e.start)} ${e.title}`}
                  </span>
                ))}
                {more > 0 && <span className={s.monthMore}>+{more} more</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AgendaList({
  cursor,
  rangeStart,
  events,
  now,
}: {
  cursor: Date
  rangeStart: Date
  events: CalendarEvent[]
  now: Date
}) {
  const days = useMemo(() => Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(startOfDay(cursor), i)), [cursor])

  const groups = days.map((d) => ({
    day: d,
    items: events
      .filter((e) => eventOnDay(e, d, rangeStart))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return a.start - b.start
      }),
  })).filter((g) => g.items.length > 0)

  if (!groups.length) {
    return (
      <div className={`${s.agenda} scroll-y`}>
        <p className={s.agendaEmpty}>Nothing on the calendar for the next few weeks.</p>
      </div>
    )
  }

  return (
    <div className={`${s.agenda} scroll-y`}>
      {groups.map(({ day, items }) => (
        <section key={day.toISOString()} className={s.agendaGroup}>
          <header className={s.agendaHead}>
            <span className={sameDay(day, now) ? `${s.agendaDay} ${s.agendaDayToday}` : s.agendaDay}>
              {sameDay(day, now) ? 'Today' : weekday(day)}
            </span>
            <span className={s.agendaDate}>{longDate(day).replace(/^[^,]+, /, '')}</span>
          </header>
          <ul className={s.agendaList}>
            {items.map((e) => (
              <li key={e.id} data-color={who(e.who).color} className={s.agendaItem}>
                <span className={s.agendaWhen}>{e.allDay ? 'All day' : `${hourLabel(e.start)} – ${hourLabel(e.end)}`}</span>
                <span className={s.agendaTitle}>{e.title}</span>
                <span className={s.agendaWho}>{who(e.who).name}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
