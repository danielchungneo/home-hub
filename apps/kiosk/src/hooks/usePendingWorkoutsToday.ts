import { useMemo } from 'react'
import {
  useAthleteProfiles,
  useCoachPlans,
  useMembers,
  useRecentActivities,
} from '../data/hooks'
import { useLive } from '../data/live'
import { localDate } from '../data/mappers'
import type { Member } from '../types'

/**
 * Coach-enabled people who still owe at least one plan session today.
 * Skips rest / recovery days and anyone without a plan yet.
 */
export function usePendingWorkoutsToday(): Member[] {
  const today = localDate()
  const membersQ = useMembers()
  const profilesQ = useAthleteProfiles()
  const plansQ = useCoachPlans(today)
  // Same window as useWorkout so we share the activities cache.
  const actsQ = useRecentActivities(35)

  useLive('activities', 'activities')
  useLive('coach_plans', 'coachPlans')
  useLive('athlete_profiles', 'athleteProfiles')

  return useMemo(() => {
    const members = membersQ.data ?? []
    const profiles = profilesQ.data ?? []
    const plans = plansQ.data ?? []
    const activities = actsQ.data ?? []

    const opted = new Set(profiles.filter((p) => p.coachEnabled).map((p) => p.memberId))

    return members.filter((m) => {
      if (!opted.has(m.id)) return false
      const plan = plans.find((p) => p.memberId === m.id)
      if (!plan) return false
      if (plan.restDay || plan.direction === 'rest') return false
      const done = activities.some(
        (a) =>
          a.memberId === m.id &&
          a.date === today &&
          (a.planPart === 'cardio' || a.planPart === 'strength'),
      )
      return !done
    })
  }, [membersQ.data, profilesQ.data, plansQ.data, actsQ.data, today])
}
