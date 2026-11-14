import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useAthleteProfiles,
  useCoachPlans,
  useCompletePlanPart,
  useInvokeCoach,
  useLogActivity,
  useRateActivity,
  useRecentActivities,
} from '../../data/hooks'
import { useLive } from '../../data/live'
import { ACTIVITIES, COACH_PLANS, mockSwap } from '../../data/workout'
import { localDate } from '../../data/mappers'
import type { Activity, AthleteProfile, CoachPlan, Feel, SwapReason } from '../../types'

const THINK_MS = 1400
/** Set `VITE_USE_MOCK=true` to exercise the Workout UI without Supabase. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

type Part = 'cardio' | 'strength'

function useWorkoutMock() {
  const [plans, setPlans] = useState<CoachPlan[]>(COACH_PLANS)
  const [activities, setActivities] = useState<Activity[]>(ACTIVITIES)
  const [thinking, setThinking] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const today = localDate()
  const profiles: AthleteProfile[] = plans.map((p) => ({
    memberId: p.memberId,
    coachEnabled: true,
    daysPerWeek: 4,
    preferredCardio: ['run', 'walk'],
    equipment: [],
  }))

  const plan = useCallback((memberId: string) => plans.find((p) => p.memberId === memberId), [plans])
  const doneToday = useCallback(
    (memberId: string, part: Part) =>
      activities.find((a) => a.memberId === memberId && a.date === today && a.planPart === part),
    [activities, today],
  )

  const complete = useCallback(
    (memberId: string, part: Part, feel?: Feel) => {
      const p = plans.find((x) => x.memberId === memberId)
      if (!p || activities.some((a) => a.memberId === memberId && a.date === today && a.planPart === part)) return
      const act: Activity =
        part === 'cardio'
          ? {
              id: `w${Date.now()}`,
              memberId,
              date: today,
              kind: p.cardio.kind,
              title: p.cardio.title,
              minutes: p.cardio.minutes,
              distanceMi: p.cardio.distanceMi,
              source: 'hub',
              planPart: part,
              feel,
            }
          : {
              id: `w${Date.now()}`,
              memberId,
              date: today,
              kind: 'strength',
              title: p.strength.title,
              minutes: p.strength.minutes,
              source: 'hub',
              planPart: part,
              feel,
            }
      setActivities((a) => [act, ...a])
    },
    [plans, activities, today],
  )

  const rate = useCallback(
    (memberId: string, part: Part, feel: Feel) =>
      setActivities((as) =>
        as.map((a) => (a.memberId === memberId && a.date === today && a.planPart === part ? { ...a, feel } : a)),
      ),
    [today],
  )

  const log = useCallback(
    (act: Omit<Activity, 'id' | 'date' | 'source'>) =>
      setActivities((as) => [{ ...act, id: `l${Date.now()}`, date: today, source: 'hub' }, ...as]),
    [today],
  )

  const swap = useCallback((memberId: string, reason: SwapReason) => {
    setThinking(memberId)
    timers.current.push(
      window.setTimeout(() => {
        setPlans((ps) => ps.map((p) => (p.memberId === memberId ? mockSwap(p, reason) : p)))
        setThinking(null)
      }, THINK_MS),
    )
  }, [])

  const retryPlan = useCallback((_memberId: string) => {
    /* mock always has a plan */
  }, [])

  return {
    ready: true,
    plans,
    activities,
    profiles,
    thinking,
    today,
    plan,
    doneToday,
    complete,
    rate,
    log,
    swap,
    retryPlan,
  }
}

function useWorkoutLive() {
  const today = localDate()
  const plansQ = useCoachPlans(today)
  const actsQ = useRecentActivities(35)
  const profilesQ = useAthleteProfiles()
  useLive('coach_plans', 'coachPlans')
  useLive('activities', 'activities')
  useLive('athlete_profiles', 'athleteProfiles')
  useLive('points_ledger', 'ledger')

  const completeMut = useCompletePlanPart()
  const rateMut = useRateActivity()
  const logMut = useLogActivity()
  const coachMut = useInvokeCoach()
  const [thinking, setThinking] = useState<string | null>(null)

  const plans = plansQ.data ?? []
  const activities = actsQ.data ?? []
  const profiles = profilesQ.data ?? []

  const plan = useCallback((memberId: string) => plans.find((p) => p.memberId === memberId), [plans])
  const doneToday = useCallback(
    (memberId: string, part: Part) =>
      activities.find((a) => a.memberId === memberId && a.date === today && a.planPart === part),
    [activities, today],
  )

  const complete = useCallback(
    (memberId: string, part: Part, feel?: Feel) => {
      completeMut.mutate({ memberId, part, feel })
    },
    [completeMut],
  )

  const rate = useCallback(
    (memberId: string, part: Part, feel: Feel) => {
      rateMut.mutate({ memberId, part, feel, date: today })
    },
    [rateMut, today],
  )

  const log = useCallback(
    (act: Omit<Activity, 'id' | 'date' | 'source'>) => {
      logMut.mutate(act)
    },
    [logMut],
  )

  const swap = useCallback(
    (memberId: string, reason: SwapReason) => {
      setThinking(memberId)
      coachMut.mutate(
        { mode: 'swap', memberId, reason },
        { onSettled: () => setThinking(null) },
      )
    },
    [coachMut],
  )

  const retryPlan = useCallback(
    (memberId: string) => {
      setThinking(memberId)
      coachMut.mutate(
        { mode: 'daily', memberId },
        { onSettled: () => setThinking(null) },
      )
    },
    [coachMut],
  )

  return {
    ready: Boolean(plansQ.data && actsQ.data && profilesQ.data),
    plans,
    activities,
    profiles,
    thinking,
    today,
    plan,
    doneToday,
    complete,
    rate,
    log,
    swap,
    retryPlan,
  }
}

/**
 * Workout state. Live path reads `coach_plans` / `activities`, completes via
 * `complete_plan_part`, and asks the coach edge function for swaps / retries.
 * Mock path stays behind `VITE_USE_MOCK=true` (compile-time switch).
 */
export function useWorkout() {
  // VITE_USE_MOCK is fixed at build time, so only one hook tree mounts.
  return USE_MOCK ? useWorkoutMock() : useWorkoutLive()
}

export type WorkoutState = ReturnType<typeof useWorkout>
