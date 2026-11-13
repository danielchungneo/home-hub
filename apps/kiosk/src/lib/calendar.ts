import type { CalendarEvent } from '@hub/shared'
import { hourLabel } from './format'

/** "Leave by 9:45am · 12 min drive", or '' when there's no travel time. */
export const leaveBy = (e: CalendarEvent) =>
  e.travelMin ? `Leave by ${hourLabel(e.start - e.travelMin / 60)} · ${e.travelMin} min drive` : ''

/** One timed event placed into a side-by-side overlap column. */
export type TimedLayout = {
  event: CalendarEvent
  /** 0-based column within its overlap cluster */
  col: number
  /** Total columns in that cluster (at least 1) */
  cols: number
}

/**
 * Pack overlapping timed events into columns (Google Calendar–style).
 * Non-overlapping events keep full width; concurrent ones share the day column.
 */
export function layoutTimedEvents(events: CalendarEvent[]): TimedLayout[] {
  if (events.length === 0) return []

  const sorted = [...events].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  )

  const columnLastEnd: number[] = []
  const placed: { event: CalendarEvent; col: number }[] = []

  for (const event of sorted) {
    let col = 0
    while (col < columnLastEnd.length && columnLastEnd[col]! > event.start) col += 1
    if (col === columnLastEnd.length) columnLastEnd.push(event.end)
    else columnLastEnd[col] = event.end
    placed.push({ event, col })
  }

  // Connected components by time overlap → each cluster shares one column count.
  const parent = placed.map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]!
    let cur = i
    while (parent[cur] !== r) {
      const next = parent[cur]!
      parent[cur] = r
      cur = next
    }
    return r
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  for (let i = 0; i < placed.length; i += 1) {
    const a = placed[i]!.event
    for (let j = i + 1; j < placed.length; j += 1) {
      const b = placed[j]!.event
      if (b.start >= a.end) break
      if (a.start < b.end && b.start < a.end) union(i, j)
    }
  }

  const groupCols = new Map<number, number>()
  for (let i = 0; i < placed.length; i += 1) {
    const root = find(i)
    groupCols.set(root, Math.max(groupCols.get(root) ?? 0, placed[i]!.col + 1))
  }

  return placed.map((p, i) => ({
    event: p.event,
    col: p.col,
    cols: groupCols.get(find(i)) ?? 1,
  }))
}
