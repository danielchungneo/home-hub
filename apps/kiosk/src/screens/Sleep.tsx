import { useHouseholdSettings, useWeather } from '../data/hooks'
import { useClock } from '../hooks/useClock'
import { clock, formatTimeOfDay, longDate } from '../lib/format'
import s from './Sleep.module.css'

/**
 * Night mode: a dim clock on near-black. The whole screen is the wake button.
 * On the Pi, also drop the backlight (e.g. via /sys/class/backlight or `vcgencmd display_power 0`)
 * from a small local service; the UI only signals the state.
 */
export default function Sleep({ onWake }: { onWake: () => void }) {
  const now = useClock()
  const weather = useWeather()
  const settings = useHouseholdSettings()
  const temp = weather.data?.temp
  const sleepEnd = settings.data?.sleepEnd

  return (
    <button type="button" className={s.page} onClick={onWake} aria-label="Tap to wake the hub">
      <span className={s.time}>{clock(now)}</span>
      <span className={s.date}>{longDate(now)}{temp != null ? ` · ${temp}°` : ''}</span>
      <span className={s.hint}>
        {sleepEnd ? `Sleeping until ${formatTimeOfDay(sleepEnd)} · tap to wake` : 'Tap to wake'}
      </span>
    </button>
  )
}
