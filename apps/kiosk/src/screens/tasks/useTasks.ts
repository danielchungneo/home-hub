import { useCallback, useMemo, useState } from 'react'
import {
  useCompleted,
  useLedger,
  useTasks as useLiveTasks,
  useToggleTask,
} from '../../data/hooks'
import { localDate } from '../../data/mappers'
import { useLive } from '../../data/live'
import type { Bounty, Frequency, Schedule, Task, TaskTemplate } from '../../types'

/** What the Add sheet hands back. */
export interface NewTask {
  templateId?: string
  newTemplate?: Omit<TaskTemplate, 'id' | 'uses'>
  /** A member id, or 'bounty' for the bounty board. */
  assignee: string
  frequency: Frequency
  schedule: Schedule
  points: number
}

/**
 * Tasks screen state over live Supabase rows where wired.
 * Template library, bounties, and add/claim still need hooks — those stay empty.
 */
export function useTasks() {
  const period = localDate()
  const tasksQ = useLiveTasks()
  const completedQ = useCompleted(period)
  const ledgerQ = useLedger()
  const toggleMut = useToggleTask()
  useLive('tasks', 'tasks')
  useLive('task_completions', 'completions')
  useLive('points_ledger', 'ledger')

  const templates: TaskTemplate[] = []
  const bounties: Bounty[] = []
  const tasks = tasksQ.data ?? []
  const done = useMemo(() => new Set(completedQ.data ?? []), [completedQ.data])
  /** Snapshot of done when first loaded so new checks don't jump to the bottom. */
  const [sunk] = useState(() => new Set<string>())

  const template = useCallback(
    (id: string): TaskTemplate =>
      templates.find((t) => t.id === id) ?? {
        id,
        title: 'Task',
        icon: 'check',
        points: 0,
        frequency: 'daily',
        uses: 0,
      },
    [templates],
  )

  const toggle = useCallback(
    (taskId: string) => {
      const isDone = done.has(taskId)
      void toggleMut.mutateAsync({ taskId, done: !isDone, period }).catch(() => {})
    },
    [done, period, toggleMut],
  )

  /** Bounty claim — not wired to Supabase yet. */
  const claim = useCallback((_bountyId: string, _memberId: string): Task | null => null, [])

  /** Add task / template / bounty — not wired to Supabase yet. */
  const add = useCallback((_input: NewTask): { title: string; taskId: string | null } | null => null, [])

  const balances = useMemo(() => {
    const out: Record<string, number> = {}
    for (const l of ledgerQ.data ?? []) out[l.memberId] = (out[l.memberId] ?? 0) + l.delta
    return out
  }, [ledgerQ.data])

  return {
    templates,
    tasks,
    bounties,
    done,
    sunk,
    template,
    toggle,
    claim,
    add,
    balances,
    ready: Boolean(tasksQ.data && completedQ.data),
  }
}

export type TasksState = ReturnType<typeof useTasks>
