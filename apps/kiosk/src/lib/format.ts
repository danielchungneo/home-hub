const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const weekday = (d: Date) => DAYS[d.getDay()]
export const shortDay = (i: number) => DAYS[i].slice(0, 3)
export const monthDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
export const longDate = (d: Date) => `${weekday(d)}, ${monthDay(d)}`

/** "9:42" (no meridiem) for big clocks. */
export function clock(d: Date) {
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "9:42 AM" */
export function time(d: Date) {
  return `${clock(d)} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

/** Decimal hour to "1:30pm" / "9am". */
export function hourLabel(h: number) {
  const hr = Math.floor(h)
  const m = Math.round((h - hr) * 60)
  const h12 = hr % 12 || 12
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${hr >= 12 ? 'pm' : 'am'}`
}

export function minutes(m: number) {
  if (!m) return '—'
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rest = m % 60
    return rest ? `${h} hr ${rest} min` : `${h} hr`
  }
  return `${m} min`
}

/** Kitchen-friendly quantities: 1.5 → "1½", 0.33 → "⅓". */
export function quantity(q: number) {
  if (!q) return ''
  let whole = Math.floor(q + 1e-6)
  const frac = q - whole
  const map: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']]
  let f = ''
  if (frac > 0.9) whole += 1
  else if (frac > 0.08) f = map.reduce((a, b) => (Math.abs(b[0] - frac) < Math.abs(a[0] - frac) ? b : a))[1]
  return `${whole || ''}${f}`
}

export function startOfWeek(d: Date) {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())
  return s
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function weekRange(d: Date) {
  const s = startOfWeek(d)
  const e = addDays(s, 6)
  return s.getMonth() === e.getMonth()
    ? `${monthDay(s)} – ${e.getDate()}`
    : `${monthDay(s)} – ${monthDay(e)}`
}
