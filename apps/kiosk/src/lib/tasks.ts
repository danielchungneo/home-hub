import type { Schedule, Task } from '../types'

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS = [1, 2, 3, 4, 5]
export const WEEKENDS = [0, 6]

/** yyyy-mm-dd in local time. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Weeks since a fixed Sunday, for "every other week". */
const weekIndex = (d: Date) => Math.floor((d.getTime() - new Date(2026, 0, 4).getTime()) / (7 * 864e5))

/** Does this task belong on today's / this week's list? */
export function isActive(t: Task, now: Date): boolean {
  const s = t.schedule
  switch (s.kind) {
    case 'days': return s.days.includes(now.getDay())
    case 'once': return s.date === isoDate(now)
    case 'weekly': return s.every === 1 || weekIndex(now) % 2 === 0
    case 'thisWeek': return true // removed when the week resets
  }
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && b.every((x) => a.includes(x))

/** "Every day", "Weekdays", "Mon, Wed, Fri". */
export function daysLabel(days: number[]): string {
  if (sameSet(days, EVERY_DAY)) return 'Every day'
  if (sameSet(days, WEEKDAYS)) return 'Weekdays'
  if (sameSet(days, WEEKENDS)) return 'Weekends'
  if (!days.length) return 'Pick days'
  return [...days].sort().map((d) => DAY_SHORT[d]).join(', ')
}

/** Short line under a task title. */
export function scheduleLabel(s: Schedule, now: Date): string {
  switch (s.kind) {
    case 'days': return daysLabel(s.days)
    case 'once': return s.date === isoDate(now) ? 'Today only' : 'One time'
    case 'weekly': return s.every === 1 ? 'Every week' : 'Every other week'
    case 'thisWeek': return 'This week only'
  }
}

/** Weekly due pill: "Due today", "Due Sat", "Late · Mon". */
export function dueLabel(dueDay: number, today: number): { text: string; tone: 'today' | 'late' | 'later' } {
  if (dueDay === today) return { text: 'Due today', tone: 'today' }
  if (dueDay < today) return { text: `Late · ${DAY_SHORT[dueDay]}`, tone: 'late' }
  return { text: `Due ${DAY_SHORT[dueDay]}`, tone: 'later' }
}

/** Bounty due line: "Today", "By Saturday", "This week". */
export function bountyDue(dueDay: number | null, today: number): string {
  if (dueDay === null) return 'This week'
  if (dueDay === today) return 'Today'
  if (dueDay < today) return `Was due ${DAY_LONG[dueDay]}`
  return `By ${DAY_LONG[dueDay]}`
}

export const dueDayOf = (s: Schedule) => (s.kind === 'weekly' || s.kind === 'thisWeek' ? s.dueDay : undefined)
