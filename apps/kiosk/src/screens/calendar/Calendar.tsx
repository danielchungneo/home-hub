import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent, WeatherKind } from '@hub/shared'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { Label, Rail, Segmented } from '../../components/primitives'
import { useCalendarSources, useEvents, useMembers, useSyncCalendars, useWeather } from '../../data/hooks'
import { useLive } from '../../data/live'
import { FAMILY } from '../../lib/members'
import { useClock } from '../../hooks/useClock'
import { layoutTimedEvents, leaveBy } from '../../lib/calendar'
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
  weekday,
} from '../../lib/format'
import { memberColorProps } from '../../lib/colors'
import { who } from '../../lib/members'
import { EventDetails, type Anchor } from './EventDetails'
import s from './Calendar.module.css'

const START_HOUR = 7
const END_HOUR = 20
/** Pixels per hour in the day/week grid. Tall enough that 15- and 30-min blocks stay readable. */
const HOUR_PX = 96
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
type View = 'day' | 'week' | 'month'
type Dir = 'next' | 'prev'

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function eventStartDate(e: CalendarEvent, rangeStart: Date) {
  if (e.startsAt) return new Date(e.startsAt)
  return addDays(rangeStart, e.day)
}

function eventOnDay(e: CalendarEvent, day: Date, rangeStart: Date) {
  if (e.allDay && e.startsAt) {
    const startKey = e.startsAt.slice(0, 10)
    const endKey = (e.endsAt ?? e.startsAt).slice(0, 10)
    const dayKey = localDateKey(day)
    return dayKey >= startKey && dayKey <= endKey
  }
  return sameDay(eventStartDate(e, rangeStart), day)
}

function weeksBetween(a: Date, b: Date) {
  return Math.round((startOfWeek(a).getTime() - startOfWeek(b).getTime()) / 86_400_000 / 7)
}

function syncedLabel(iso?: string, syncing?: boolean) {
  if (syncing) return 'Syncing…'
  if (!iso) return 'Waiting for Google sync'
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (mins < 1) return 'Synced · just now'
  if (mins === 1) return 'Synced · 1 min ago'
  if (mins < 60) return `Synced · ${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `Synced · ${hrs} hr${hrs === 1 ? '' : 's'} ago`
}

function weatherKindFromCondition(condition: string): WeatherKind {
  const c = condition.toLowerCase()
  if (c.includes('rain') || c.includes('shower') || c.includes('thunder')) return 'rainy'
  if (c.includes('cloud') || c.includes('fog') || c.includes('overcast')) return 'cloudy'
  return 'sunny'
}

export default function Calendar() {
  const now = useClock()
  const todayIdx = now.getDay()
  const nowHour = now.getHours() + now.getMinutes() / 60
  const [view, setView] = useState<View>('week')
  const [week, setWeek] = useState(0)
  const [month, setMonth] = useState(0)
  const [focusDay, setFocusDay] = useState(todayIdx)
  const [dir, setDir] = useState<Dir>('next')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [popped, setPopped] = useState<string | null>(null)
  const [open, setOpen] = useState<{ id: string; anchor: Anchor } | null>(null)
  const [ready, setReady] = useState(false)
  const gridRef = useRef<HTMLElement>(null)
  const hoursScrollRef = useRef<HTMLDivElement>(null)
  const eventRefs = useRef(new Map<string, HTMLElement>())

  const members = useMembers()
  const sources = useCalendarSources()
  const sync = useSyncCalendars()
  const weather = useWeather()
  useLive('events', 'events')
  useLive('calendar_sources', 'calendarSources')

  useEffect(() => {
    const r = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(r)
  }, [])

  const weekStart = addDays(startOfWeek(now), week * 7)
  const monthCursor = addMonths(startOfMonth(now), month)
  const monthGridStart = startOfWeek(startOfMonth(monthCursor))
  const rangeStart = view === 'month' ? monthGridStart : weekStart
  const rangeEnd = view === 'month' ? addDays(monthGridStart, 42) : addDays(weekStart, 7)
  const thisWeek = week === 0
  const thisMonth = month === 0
  const eventsQuery = useEvents(rangeStart, rangeEnd)
  const allEvents = eventsQuery.data ?? []
  const events = allEvents.filter((e) => !hidden.has(e.who))
  const days = view === 'day' ? [focusDay] : [0, 1, 2, 3, 4, 5, 6]

  const people = useMemo(() => {
    const live = members.data ?? []
    const srcs = (sources.data ?? []).filter((src) => src.enabled)
    const syncedMemberIds = new Set(
      srcs.map((src) => src.memberId).filter((id): id is string => Boolean(id)),
    )
    const list = live
      .filter((m) => syncedMemberIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, initial: m.initial, color: m.color }))
    if (srcs.some((src) => !src.memberId)) list.push(FAMILY)
    return list
  }, [members.data, sources.data])

  const lastSynced = useMemo(() => {
    const times = (sources.data ?? [])
      .map((src) => src.lastSyncedAt)
      .filter((x): x is string => Boolean(x))
      .map((x) => Date.parse(x))
    if (!times.length) return undefined
    return new Date(Math.max(...times)).toISOString()
  }, [sources.data])

  const go = (d: Dir, patch: () => void) => { setDir(d); setOpen(null); patch() }
  const step = (d: Dir) => go(d, () => {
    const n = d === 'next' ? 1 : -1
    if (view === 'month') { setMonth((m) => m + n); return }
    if (view === 'week') { setWeek((w) => w + n); return }
    const next = focusDay + n
    if (next < 0) { setFocusDay(6); setWeek((w) => w - 1) }
    else if (next > 6) { setFocusDay(0); setWeek((w) => w + 1) }
    else setFocusDay(next)
  })
  const goToday = () => go(
    (view === 'month' ? month : week) > 0 ? 'prev' : 'next',
    () => {
      setWeek(0)
      setMonth(0)
      setFocusDay(todayIdx)
    },
  )
  const openDay = (d: Date) => {
    go('next', () => {
      setWeek(weeksBetween(d, now))
      setMonth(
        (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()),
      )
      setFocusDay(d.getDay())
      setView('day')
    })
  }
  const toggle = (id: string) => {
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
    setPopped(id)
    setOpen(null)
  }
  const openEvent = (id: string) => {
    const el = eventRefs.current.get(id)
    const box = gridRef.current?.getBoundingClientRect()
    if (!el || !box) return
    const r = el.getBoundingClientRect()
    setOpen({
      id,
      anchor: {
        top: r.top - box.top,
        left: r.left - box.left,
        right: r.right - box.left,
        height: r.height,
        boxWidth: box.width,
        boxHeight: box.height,
      },
    })
  }

  const title = view === 'month'
    ? monthYear(monthCursor)
    : view === 'day'
      ? `${DAY_LONG[focusDay]}, ${MONTHS[addDays(weekStart, focusDay).getMonth()]} ${addDays(weekStart, focusDay).getDate()}`
      : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${addDays(weekStart, 6).getMonth() !== weekStart.getMonth() ? MONTHS[addDays(weekStart, 6).getMonth()].slice(0, 3) + ' ' : ''}${addDays(weekStart, 6).getDate()}`
  const periodLabel = view === 'month'
    ? (thisMonth ? 'This month' : month > 0 ? `${month} month${month > 1 ? 's' : ''} ahead` : `${-month} month${month < -1 ? 's' : ''} ago`)
    : (thisWeek ? 'This week' : week > 0 ? `${week} week${week > 1 ? 's' : ''} ahead` : `${-week} week${week < -1 ? 's' : ''} ago`)
  const sceneKey = `${view}-${view === 'month' ? month : `${week}-${view === 'day' ? focusDay : ''}`}`

  // Pin the hours scroller so "now" sits near the top when opening day/week for this week.
  useEffect(() => {
    if (view === 'month') return
    const el = hoursScrollRef.current
    if (!el) return

    const hour = new Date().getHours() + new Date().getMinutes() / 60
    const id = requestAnimationFrame(() => {
      if (!thisWeek || hour <= START_HOUR) {
        el.scrollTop = 0
        return
      }
      const clamped = Math.min(hour, END_HOUR)
      const pad = Math.round(HOUR_PX * 0.25) // ~15 min of past above the line
      el.scrollTop = Math.max(0, (clamped - START_HOUR) * HOUR_PX - pad)
    })
    return () => cancelAnimationFrame(id)
  }, [view, sceneKey, thisWeek])
  const openEv = open ? events.find((e) => e.id === open.id) : undefined
  const todayWeatherKind = weather.data ? weatherKindFromCondition(weather.data.condition) : 'cloudy'
  const navUnit = view === 'month' ? 'Month' : view === 'day' ? 'Day' : 'Week'

  if (!members.data || !sources.data) return <AppShell>{null}</AppShell>

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Calendar · ${periodLabel}`}
        title={<span key={sceneKey} className={s.title} data-dir={dir}>{title}</span>}
        actions={<>
          <Segmented
            label="View"
            value={view}
            onChange={(v) => go(v === 'day' || v === 'month' ? 'next' : 'prev', () => {
              if (v === 'month') {
                const shown = addDays(weekStart, view === 'day' ? focusDay : 0)
                setMonth(
                  (shown.getFullYear() - now.getFullYear()) * 12 + (shown.getMonth() - now.getMonth()),
                )
              }
              setView(v)
              if (v === 'day' && thisWeek) setFocusDay(todayIdx)
            })}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
          <Rail label={navUnit}>
            <IconButton variant="ghost" icon="chevron-left" label={`Previous ${navUnit.toLowerCase()}`} onClick={() => step('prev')} />
            <Button variant="surface" pill onClick={goToday}>Today</Button>
            <IconButton variant="ghost" icon="chevron-right" label={`Next ${navUnit.toLowerCase()}`} onClick={() => step('next')} />
          </Rail>
          <Button
            variant="secondary"
            pill
            icon="refresh"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            {syncedLabel(lastSynced, sync.isPending)}
          </Button>
          <Button size="lg" pill icon="plus">Add event</Button>
        </>}
      />

      <div className={s.strip}>
        <Label>Showing</Label>
        {people.map((p) => {
          const on = !hidden.has(p.id)
          const isMember = p.id !== FAMILY.id
          return (
            <button key={p.id} type="button" {...memberColorProps(p.color)} aria-pressed={on} className={s.person} onClick={() => toggle(p.id)}>
              {isMember && (
                <span key={popped === p.id ? `${p.id}-${hidden.size}` : p.id} className={popped === p.id ? `${s.avatar} anim-pop` : s.avatar}>
                  <MemberBlobAvatar memberId={p.id} size={36} showBackground={false} decorative />
                </span>
              )}
              {p.name}
              <span className={s.personCount}>{allEvents.filter((e) => e.who === p.id).length}</span>
            </button>
          )
        })}
        <span className={s.spacer} />
        <Countdowns now={now} />
      </div>

      <div className={s.body}>
        <Today
          now={now}
          nowHour={nowHour}
          ready={ready}
          events={
            view === 'month'
              ? events.filter((e) => eventOnDay(e, startOfDay(now), rangeStart))
              : thisWeek ? events.filter((e) => e.day === todayIdx) : []
          }
          weatherKind={todayWeatherKind}
          weatherTemp={weather.data?.temp}
          weatherHigh={weather.data?.high}
          onOpen={(id) => {
            if (view === 'month' || !thisWeek || view === 'day') {
              go('prev', () => {
                setWeek(0)
                setMonth(0)
                setView('week')
                window.setTimeout(() => openEvent(id), 450)
              })
            } else openEvent(id)
          }}
        />

        <section ref={gridRef} className={s.grid} aria-label={title}>
          {view === 'month' ? (
            <div key={sceneKey} className={s.scene} data-dir={dir}>
              <MonthGrid
                cursor={monthCursor}
                rangeStart={monthGridStart}
                events={events}
                now={now}
                onSelectDay={openDay}
              />
            </div>
          ) : (
            <div key={sceneKey} className={s.scene} data-dir={dir} style={{ ['--cols' as string]: days.length }}>
              <div className={s.heads}>
                <span />
                {days.map((d) => {
                  const isToday = thisWeek && d === todayIdx
                  return (
                    <button
                      key={d}
                      type="button"
                      className={isToday ? `${s.head} ${s.headToday}` : s.head}
                      aria-label={view === 'day' ? 'Back to the week' : `Open ${DAY_LONG[d]}`}
                      onClick={() => (view === 'day'
                        ? go('prev', () => setView('week'))
                        : go('next', () => { setView('day'); setFocusDay(d) }))}
                    >
                      <span className={s.headName}>{view === 'day' ? DAY_LONG[d] : shortDay(d)}</span>
                      <span className={s.headNum}>{addDays(weekStart, d).getDate()}</span>
                    </button>
                  )
                })}
              </div>

              <div className={s.allDayRow}>
                <span className={s.allDayLabel}>All day</span>
                {days.map((d) => (
                  <div key={d} className={thisWeek && d === todayIdx ? `${s.allDayCell} ${s.colToday}` : s.allDayCell}>
                    {events.filter((e) => e.allDay && eventOnDay(e, addDays(weekStart, d), weekStart)).map((e) => (
                      <span key={e.id} {...memberColorProps(who(e.who).color)} className={s.allDay}>
                        {e.title}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              <div ref={hoursScrollRef} className={`${s.hoursScroll} scroll-y`}>
                <div className={s.hoursGrid} style={{ height: (END_HOUR - START_HOUR) * HOUR_PX, ['--hour-px' as string]: `${HOUR_PX}px` }}>
                  <div className={s.gutter}>
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <span key={i} className={s.hour} style={{ top: i === 0 ? 4 : i * HOUR_PX - 8 }}>
                        {hourLabel(START_HOUR + i).replace(/(am|pm)$/, ' $1')}
                      </span>
                    ))}
                  </div>
                  {days.map((d, ci) => {
                    const isToday = thisWeek && d === todayIdx
                    const laidOut = layoutTimedEvents(events.filter((e) => !e.allDay && e.day === d))
                    return (
                      <div key={d} className={isToday ? `${s.col} ${s.colToday}` : s.col}>
                        {laidOut.map(({ event: e, col, cols }, k) => {
                          const past = thisWeek && (d < todayIdx || (d === todayIdx && e.end <= nowHour))
                          const big = view === 'day' && cols === 1
                          const showTime = (big || e.end - e.start >= 1) && (cols === 1 || view === 'day')
                          return (
                            <button
                              key={e.id}
                              type="button"
                              {...memberColorProps(who(e.who).color, {
                                top: (e.start - START_HOUR) * HOUR_PX + 2,
                                height: Math.max((e.end - e.start) * HOUR_PX - 4, 18),
                                zIndex: open?.id === e.id ? 4 : col + 1,
                                ['--n' as string]: ci * 4 + k,
                                ['--col' as string]: col,
                                ['--cols' as string]: cols,
                              })}
                              ref={(el) => {
                                if (el) eventRefs.current.set(e.id, el)
                                else eventRefs.current.delete(e.id)
                              }}
                              className={[s.event, big && s.eventBig, past && s.eventPast, open?.id === e.id && s.eventOpen, e.end - e.start < 1 && s.eventShort, cols > 1 && s.eventSplit].filter(Boolean).join(' ')}
                              aria-label={`${e.title}, ${DAY_LONG[d]} ${hourLabel(e.start)}`}
                              onClick={() => openEvent(e.id)}
                            >
                              <span className={s.eventTitle}>{e.title}</span>
                              {showTime && <span className={s.eventTime}>{hourLabel(e.start)} – {hourLabel(e.end)}</span>}
                              {big && e.where && <span className={s.eventTime}>{e.where}</span>}
                            </button>
                          )
                        })}
                        {isToday && nowHour >= START_HOUR && nowHour <= END_HOUR && (
                          <div className={s.now} style={{ top: (nowHour - START_HOUR) * HOUR_PX }} aria-label={`Now, ${hourLabel(nowHour)}`}>
                            <span className={s.nowDot} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {open && openEv && <EventDetails event={openEv} anchor={open.anchor} onClose={() => setOpen(null)} />}
        </section>
      </div>
    </AppShell>
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
              className={[s.monthCell, !inMonth && s.monthCellMuted, isToday && s.monthCellToday].filter(Boolean).join(' ')}
              onClick={() => onSelectDay(d)}
              aria-label={`${longDate(d)}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
            >
              <span className={isToday ? `${s.monthNum} ${s.monthNumToday}` : s.monthNum}>{d.getDate()}</span>
              <div className={s.monthEvents}>
                {shown.map((e) => (
                  <span key={e.id} {...memberColorProps(who(e.who).color)} className={s.monthEvent}>
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

/** Coming-up countdowns — no table or hook yet; hide until wired. */
function Countdowns(_props: { now: Date }) {
  return null
}

const RING = 2 * Math.PI * 56

function Today({ now, nowHour, ready, events, weatherKind, weatherTemp, weatherHigh, onOpen }: {
  now: Date
  nowHour: number
  ready: boolean
  events: CalendarEvent[]
  weatherKind: WeatherKind
  weatherTemp?: number
  weatherHigh?: number
  onOpen: (id: string) => void
}) {
  // Parent already scopes to today; keep timed events only for the ring + list.
  const todays = events
    .filter((e) => !e.allDay)
    .sort((a, b) => a.start - b.start)
  const next = todays.find((e) => e.start > nowHour)
  const mins = next ? Math.round((next.start - nowHour) * 60) : 0
  const ringFill = next ? Math.max(0.04, 1 - Math.min(mins, 60) / 60) : 1
  const nowIdx = todays.filter((e) => e.start <= nowHour).length
  const nw = next ? who(next.who) : null

  return (
    <aside className={s.today} aria-label="Today">
      <div className={s.upNext} {...memberColorProps(nw?.color ?? 'moss')}>
        <span className={s.ring}>
          <svg className={s.ringMeter} aria-hidden="true" width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="56" className={s.ringTrack} />
            <circle cx="66" cy="66" r="56" className={s.ringFill} strokeDasharray={RING} strokeDashoffset={ready ? RING * (1 - ringFill) : RING} />
          </svg>
          <span className={s.ringText}>
            {next
              ? <><span className={s.ringNum}>{mins >= 60 ? Math.floor(mins / 60) : mins}</span><span className={s.ringUnit}>{mins >= 60 ? 'hr' : 'min'}</span></>
              : <Icon name="moon" size={44} stroke={2.2} />}
          </span>
        </span>
        <span className={s.upText}>
          {next ? <>
            <span className={s.upKicker}>Up next · {nw!.name}</span>
            <span className={s.upTitle}>{next.title}</span>
            <span className={s.upTime}>{hourLabel(next.start)} – {hourLabel(next.end)}{next.where ? ` · ${next.where}` : ''}</span>
            {next.travelMin && <span className={s.upLeave}>{leaveBy(next)}</span>}
          </> : <>
            <span className={s.upKicker}>That’s everything</span>
            <span className={s.upTitle}>Nothing else today</span>
            <span className={s.upTime}>Enjoy the evening.</span>
          </>}
        </span>
      </div>

      <section className={s.timeline} aria-label="Today’s timeline">
        <div className={s.tlHead}>
          <span className={s.tlDay}>{weekday(now)}</span>
          {weatherTemp != null && weatherHigh != null ? (
            <span className={s.tlWx}><WeatherIcon kind={weatherKind} />{weatherTemp}° now · {weatherHigh}° high</span>
          ) : (
            <span className={s.tlWx}>Weather needs a location</span>
          )}
        </div>
        <div className={`${s.tlList} scroll-y`}>
          {todays.length > 0 && (
            <>
              <span className={s.tlTrack} aria-hidden="true" />
              <span className={s.tlFill} aria-hidden="true" style={{ transform: `scaleY(${ready ? nowIdx / todays.length : 0})` }} />
            </>
          )}
          {todays.map((e, i) => {
            const w = who(e.who)
            const past = e.end <= nowHour
            const isNext = e === next
            return (
              <div key={e.id} style={{ display: 'contents' }}>
                {i === nowIdx && (
                  <div className={s.tlRow} style={{ ['--n' as string]: i }}>
                    <span className={s.tlTime} /><span className={s.tlNowDot} /><span className={s.tlNow}>Now · {hourLabel(nowHour)}</span>
                  </div>
                )}
                <div className={s.tlRow} {...memberColorProps(w.color, { ['--n' as string]: i + 1 })}>
                  <span className={s.tlTime}>{hourLabel(e.start).replace(/(am|pm)$/, '')}</span>
                  <span className={[s.tlDot, past && s.tlDotPast, isNext && s.tlDotNext].filter(Boolean).join(' ')} />
                  <button type="button" className={[s.tlEvent, past && s.tlPast, isNext && s.tlNext].filter(Boolean).join(' ')} onClick={() => onOpen(e.id)}>
                    <span className={s.tlText}>
                      <span className={s.tlTitle}>{e.title}</span>
                      <span className={s.tlSub}>{past ? 'Done · ' : ''}{e.where ?? w.name}</span>
                    </span>
                    <span className={s.tlAvatar}>
                      <MemberBlobAvatar memberId={w.id} size={32} showBackground={false} decorative />
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
          {nowIdx === todays.length && todays.length > 0 && (
            <div className={s.tlRow} style={{ ['--n' as string]: todays.length + 1 }}>
              <span className={s.tlTime} /><span className={s.tlNowDot} /><span className={s.tlNow}>Now · {hourLabel(nowHour)}</span>
            </div>
          )}
          {!todays.length && <span className={s.tlEmpty}>Nothing on the calendar today.</span>}
        </div>
      </section>
    </aside>
  )
}

export function WeatherIcon({ kind }: { kind: WeatherKind }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" className={s.wx} data-kind={kind}>
      {kind === 'sunny' && <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>}
      {kind === 'cloudy' && <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 18z" />}
      {kind === 'rainy' && <path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15zM9 18l-1 3M13 18l-1 3M17 18l-1 3" />}
    </svg>
  )
}
