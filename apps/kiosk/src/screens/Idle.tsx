import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { IconTile, Label, Progress } from '../components/primitives'
import { useCompleted, useTasks } from '../data/hooks'
import { localDate } from '../data/mappers'
import { EVENTS, MEAL_PLAN, PHOTOS, RECIPES, SETTINGS, WEATHER } from '../data/mock'
import { useClock } from '../hooks/useClock'
import { clock, hourLabel, longDate } from '../lib/format'
import { who } from '../lib/members'
import { PhotoPlaceholder } from './PhotoPlaceholder'
import s from './Idle.module.css'

/** Screensaver: full-bleed photo slideshow with clock and today-at-a-glance. Any tap dismisses it (App handles that). */
export default function Idle() {
  const now = useClock()
  const slides = PHOTOS.filter((p) => p.inSlideshow)
  const [i, setI] = useState(0)

  // Preload/advance one slide at a time; only the current image is mounted.
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % slides.length), SETTINGS.slideSeconds * 1000)
    return () => window.clearInterval(id)
  }, [slides.length])

  const today = now.getDay()
  const hour = now.getHours() + now.getMinutes() / 60
  const agenda = EVENTS.filter((e) => e.day === today && !e.allDay && e.end > hour).slice(0, 4)
  const dinner = MEAL_PLAN.dinner[today]
  const dinnerTitle = dinner ? ('recipeId' in dinner ? RECIPES.find((r) => r.id === dinner.recipeId)?.title : dinner.text) : 'Not planned yet'
  const total = useTasks().data?.length ?? 0
  const done = useCompleted(localDate(now)).data?.length ?? 0
  const photo = slides[i]

  return (
    <div className={s.page} role="dialog" aria-label="Slideshow. Tap anywhere to open the hub.">
      <div key={photo.id} className={`${s.photo} anim-fade`}>
        <PhotoPlaceholder full palette={photo.palette} seed={i} label="Family photo" />
      </div>

      <div className={s.playing}>
        <span className={s.playingIcon}><Icon name="music" size={22} /></span>
        <span className={s.playingText}><strong>Dinner Jazz</strong><span>Playing in the Kitchen</span></span>
      </div>

      <div className={s.clock}>
        <div className={s.time}>{clock(now)}</div>
        <div className={s.date}>{longDate(now)}</div>
        <div className={s.weather}><Icon name="sun" size={30} />{WEATHER.temp}° · {WEATHER.condition} · High {WEATHER.high}°</div>
      </div>

      <aside className={s.today} aria-label="Today at a glance">
        <Label>Today</Label>
        <div className={s.agenda}>
          {agenda.length ? agenda.map((e) => (
            <div key={e.id} data-color={who(e.who).color} className={s.event}>
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
            <strong>{done} of {total} tasks done</strong>
            <Progress value={total ? done / total : 0} label="Tasks done today" />
          </span>
        </div>
      </aside>

      <div className={s.footer}>
        <div className={s.dots} aria-hidden="true">
          {slides.slice(0, 8).map((p, k) => <span key={p.id} className={k === i % 8 ? `${s.dotNav} ${s.dotNavOn}` : s.dotNav} />)}
        </div>
        <span className={s.hint}>Tap anywhere to open the hub</span>
      </div>
    </div>
  )
}
