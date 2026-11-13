import { useMemo } from 'react'
import { Icon } from '../components/Icon'
import { IconTile, Label, Progress } from '../components/primitives'
import {
  useCompleted,
  useEvents,
  useHouseholdSettings,
  useJukeboxState,
  useMealPlan,
  useRecipes,
  useTasks,
  useWeather,
} from '../data/hooks'
import { useLive } from '../data/live'
import { localDate } from '../data/mappers'
import { useClock } from '../hooks/useClock'
import { memberColorProps } from '../lib/colors'
import { addDays, clock, hourLabel, longDate, startOfWeek } from '../lib/format'
import { who } from '../lib/members'
import s from './Idle.module.css'

/** Screensaver: clock and today-at-a-glance. Photos slideshow not wired yet. Any tap dismisses (App handles that). */
export default function Idle() {
  const now = useClock()
  const settings = useHouseholdSettings()
  const weather = useWeather()
  const jukebox = useJukeboxState()
  const period = localDate(now)
  const tasksQ = useTasks()
  const completedQ = useCompleted(period)
  useLive('events', 'events')
  useLive('meal_plan', 'mealPlan')
  useLive('tasks', 'tasks')
  useLive('task_completions', 'completions')
  useLive('jukebox_state', 'jukeboxState')

  const today = now.getDay()
  const hour = now.getHours() + now.getMinutes() / 60
  const todayStr = localDate(now)
  const weekStart = useMemo(() => startOfWeek(now), [now])
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const events = useEvents(weekStart, weekEnd).data ?? []
  const agenda = events
    .filter((e) => e.day === today && !e.allDay && e.end > hour)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4)
  const mealPlan = useMealPlan(todayStr, todayStr).data ?? []
  const recipes = useRecipes().data ?? []
  const dinner = mealPlan.find((m) => m.slot === 'dinner')
  const dinnerTitle = dinner
    ? (dinner.recipeId ? recipes.find((r) => r.id === dinner.recipeId)?.title : dinner.title) ?? dinner.title ?? 'Not planned yet'
    : 'Not planned yet'
  const total = tasksQ.data?.length ?? 0
  const done = completedQ.data?.length ?? 0
  const w = weather.data
  const playing = jukebox.data?.nowPlaying
  void settings.data?.slideSeconds

  return (
    <div className={s.page} role="dialog" aria-label="Idle. Tap anywhere to open the hub.">
      <div className={s.photoEmpty} aria-hidden="true" />

      {playing ? (
        <div className={s.playing}>
          <span className={s.playingIcon}><Icon name="music" size={22} /></span>
          <span className={s.playingText}>
            <strong>{playing.title}</strong>
            <span>{playing.artist ? `Playing · ${playing.artist}` : 'Playing'}</span>
          </span>
        </div>
      ) : null}

      <div className={s.clock}>
        <div className={s.time}>{clock(now)}</div>
        <div className={s.date}>{longDate(now)}</div>
        <div className={s.weather}>
          {w ? (
            <>
              <Icon name={w.icon} size={30} />
              {`${w.temp}° · ${w.condition} · High ${w.high}°`}
            </>
          ) : (
            'Weather needs a location in Settings'
          )}
        </div>
      </div>

      <aside className={s.today} aria-label="Today at a glance">
        <Label>Today</Label>
        <div className={s.agenda}>
          {agenda.length ? agenda.map((e) => (
            <div key={e.id} {...memberColorProps(who(e.who).color)} className={s.event}>
              <span className={s.dot} />
              <span className={s.eventTitle}>{e.title}</span>
              <span className={s.eventTime}>{e.start <= hour ? `Now – ${hourLabel(e.end)}` : hourLabel(e.start)}</span>
            </div>
          )) : <span className={s.eventTime}>Nothing else on the calendar today.</span>}
        </div>
        <div className={s.divider} />
        <div className={s.line}>
          <IconTile icon="utensils" color="clay" size={56} />
          <span className={s.lineText}><Label>Dinner tonight</Label><span className={s.dinner}>{dinnerTitle}</span></span>
        </div>
        <div className={s.line}>
          <IconTile icon="check" color="moss" size={56} />
          <span className={s.lineText} data-color="moss">
            <strong>{total ? `${done} of ${total} tasks done` : 'No tasks yet'}</strong>
            <Progress value={total ? done / total : 0} label="Tasks done today" />
          </span>
        </div>
      </aside>

      <div className={s.footer}>
        <span className={s.hint}>Photos slideshow not wired yet · Tap to open the hub</span>
      </div>
    </div>
  )
}
