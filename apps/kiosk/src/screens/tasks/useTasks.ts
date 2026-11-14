import { useCallback, useMemo, useState } from 'react'
import {
  useAddTask,
  useBounties,
  useClaimBounty,
  useCompleted,
  useLedger,
  useTaskTemplates,
  useTasks as useLiveTasks,
  useToggleTask,
} from '../../data/hooks'
import { localDate } from '../../data/mappers'
import { useLive } from '../../data/live'
import type { Frequency, Schedule, TaskTemplate } from '../../types'

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

/** Tasks screen state over live Supabase rows. */
export function useTasks() {
  const period = localDate()
  const tasksQ = useLiveTasks()
  const templatesQ = useTaskTemplates()
  const bountiesQ = useBounties()
  const completedQ = useCompleted(period)
  const ledgerQ = useLedger()
  const toggleMut = useToggleTask()
  const addMut = useAddTask()
  const claimMut = useClaimBounty()
  useLive('tasks', 'tasks')
  useLive('task_templates', 'taskTemplates')
  useLive('bounties', 'bounties')
  useLive('task_completions', 'completions')
  useLive('points_ledger', 'ledger')

  const templates = templatesQ.data ?? []
  const bounties = bountiesQ.data ?? []
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

  const claim = useCallback(
    async (bountyId: string, memberId: string) => {
      const task = await claimMut.mutateAsync({ bountyId, memberId })
      return task
    },
    [claimMut],
  )

  const add = useCallback(
    async (input: NewTask) => {
      const r = await addMut.mutateAsync({
        templateId: input.templateId,
        newTemplate: input.newTemplate
          ? {
              title: input.newTemplate.title,
              icon: input.newTemplate.icon,
              points: input.newTemplate.points,
              frequency: input.newTemplate.frequency,
            }
          : undefined,
        assignee: input.assignee,
        frequency: input.frequency,
        schedule: input.schedule,
        points: input.points,
      })
      return r
    },
    [addMut],
  )

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
    ready: Boolean(tasksQ.data && completedQ.data && templatesQ.data && bountiesQ.data),
  }
}

export type TasksState = ReturnType<typeof useTasks>
