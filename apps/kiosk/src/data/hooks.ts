// Query and mutation hooks for the screens backed by Supabase.
// Mutations update the cache first so taps feel instant on the Pi, then refetch.
import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import {
  groceryQtyToString,
  guessGroceryAisle,
  ingredientToGroceryQty,
  isShoppableIngredient,
  mergeGroceryQty,
  normalizeIngredientName,
  normalizeRecipeTags,
  parseGroceryQty,
  type Activity, type AthleteProfile, type CalendarEvent, type CalendarSource, type CardioKind, type CoachPlan, type Database, type Feel, type GroceryQty, type HouseholdSettings, type Ingredient, type Json, type JukeboxFavorite, type ListItem, type MediaKind, type Member, type MemberColor, type QueueItem, type RecipeStep, type Redemption, type RewardAisle, type RewardDeal, type SwapReason,
} from '@hub/shared'
import { ensureSession, supabase } from '../lib/supabase'
import { fetchOpenMeteo, type Weather } from '../lib/weather'
import type { Recipe, Reward, ShoppingList } from '../lib/types'
import type { Frequency, Schedule } from '../types'
import { isoDate } from '../lib/tasks'
import { startOfWeek } from '../lib/format'
import {
  localDate,
  toActivity,
  toAthleteProfile,
  toBounty,
  toCalendarEvent,
  toCalendarSource,
  toCoachPlan,
  toFavorite,
  toJukeboxState,
  toLedgerEntry,
  toList,
  toMealPlanRow,
  toMember,
  toQueueItem,
  toRecipe,
  toRedemption,
  toReward,
  toRewardDeal,
  toSpeaker,
  toTask,
  toTaskTemplate,
  type MealPlanRow,
} from './mappers'

type JukeboxCommandType = Database['public']['Enums']['jukebox_command_type']

type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>

async function run<T>(query: () => Result<T>): Promise<T> {
  await ensureSession()
  const { data, error } = await query()
  if (error) throw new Error(error.message)
  return data as T
}

async function optimistic<T>(queryClient: QueryClient, queryKey: QueryKey, update: (old: T) => T) {
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData<T>(queryKey)
  if (previous !== undefined) queryClient.setQueryData<T>(queryKey, update(previous))
  return () => queryClient.setQueryData(queryKey, previous)
}

const refetch = (queryClient: QueryClient, ...keys: string[]) =>
  Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))

// Query options are shared by the hooks and prefetchLiveScreens, so the keys can't drift apart.

const membersQuery = () =>
  queryOptions({
    queryKey: ['members'],
    queryFn: async () => (await run(() => supabase.from('members').select('*').order('sort_order'))).map(toMember),
  })

const tasksQuery = () =>
  queryOptions({
    queryKey: ['tasks'],
    queryFn: async () =>
      (
        await run(() =>
          supabase
            .from('tasks')
            .select('*')
            .is('archived_at', null)
            .not('template_id', 'is', null)
            .order('created_at'),
        )
      ).map(toTask),
  })

const taskTemplatesQuery = () =>
  queryOptions({
    queryKey: ['taskTemplates'],
    queryFn: async () =>
      (await run(() => supabase.from('task_templates').select('*').order('uses', { ascending: false }))).map(
        toTaskTemplate,
      ),
  })

const bountiesQuery = () =>
  queryOptions({
    queryKey: ['bounties'],
    queryFn: async () =>
      (
        await run(() =>
          supabase
            .from('bounties')
            .select('*')
            .is('claimed_by', null)
            .order('created_at', { ascending: false }),
        )
      ).map(toBounty),
  })

function scheduleColumns(frequency: Frequency, schedule: Schedule) {
  if (frequency === 'daily') {
    if (schedule.kind === 'once') {
      return {
        days: null as number[] | null,
        once_on: schedule.date,
        every_weeks: null as number | null,
        week_of: null as string | null,
        due_day: null as number | null,
      }
    }
    return {
      days: schedule.kind === 'days' ? schedule.days : [0, 1, 2, 3, 4, 5, 6],
      once_on: null,
      every_weeks: null,
      week_of: null,
      due_day: null,
    }
  }
  if (schedule.kind === 'thisWeek') {
    return {
      days: null,
      once_on: null,
      every_weeks: null,
      week_of: isoDate(startOfWeek(new Date())),
      due_day: schedule.dueDay,
    }
  }
  const every = schedule.kind === 'weekly' ? schedule.every : 1
  const dueDay = schedule.kind === 'weekly' ? schedule.dueDay : 6
  return {
    days: null,
    once_on: null,
    every_weeks: every,
    week_of: null,
    due_day: dueDay,
  }
}

/** Completions for a period day (daily) or the week's Sunday (weekly) — see docs/TASKS.md. */
const completedQuery = (period: string) =>
  queryOptions({
    queryKey: ['completions', period],
    queryFn: async () =>
      (await run(() => supabase.from('task_completions').select('task_id').eq('period', period))).map((r) => r.task_id),
  })

const rewardsQuery = () =>
  queryOptions({
    queryKey: ['rewards'],
    queryFn: async () =>
      (await run(() => supabase.from('rewards').select('*').eq('active', true).order('sort_order'))).map(toReward),
  })

const ledgerQuery = () =>
  queryOptions({
    queryKey: ['ledger'],
    queryFn: async () => {
      const now = new Date()
      const rows = await run(() => supabase.from('points_ledger').select('*').order('created_at', { ascending: false }))
      return rows.map((r) => toLedgerEntry(r, now))
    },
  })

const redemptionsQuery = () =>
  queryOptions({
    queryKey: ['redemptions'],
    queryFn: async () =>
      (
        await run(() =>
          supabase.from('reward_redemptions').select('*').eq('status', 'requested').order('requested_at'),
        )
      ).map(toRedemption),
  })

const rewardDealQuery = () =>
  queryOptions({
    queryKey: ['rewardDeal'],
    queryFn: async (): Promise<RewardDeal | null> => {
      const today = localDate()
      const rows = await run(() =>
        supabase
          .from('reward_deals')
          .select('*')
          .lte('starts_on', today)
          .gte('ends_on', today)
          .order('starts_on', { ascending: false })
          .limit(1),
      )
      const row = rows[0]
      return row ? toRewardDeal(row) : null
    },
  })

const wishlistQuery = () =>
  queryOptions({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const rows = await run(() => supabase.from('wishlist').select('*'))
      const out: Record<string, string | null> = {}
      for (const row of rows) out[row.member_id] = row.reward_id
      return out
    },
  })

const listsQuery = () =>
  queryOptions({
    queryKey: ['lists'],
    queryFn: async () =>
      (
        await run(() =>
          supabase
            .from('lists')
            .select('*, list_items(*)')
            .order('sort_order')
            .order('sort_order', { referencedTable: 'list_items' }),
        )
      ).map(toList),
  })

const speakersQuery = () =>
  queryOptions({
    queryKey: ['speakers'],
    queryFn: async () => (await run(() => supabase.from('speakers').select('*').order('sort_order'))).map(toSpeaker),
  })

const favoritesQuery = () =>
  queryOptions({
    queryKey: ['jukeboxFavorites'],
    queryFn: async () =>
      (await run(() =>
        supabase.from('jukebox_favorites').select('*').order('sort_order').order('created_at', { ascending: false }),
      )).map(toFavorite),
  })

const queueQuery = () =>
  queryOptions({
    queryKey: ['jukeboxQueue'],
    queryFn: async () =>
      (await run(() => supabase.from('jukebox_queue').select('*').order('position'))).map(toQueueItem),
  })

const jukeboxStateQuery = () =>
  queryOptions({
    queryKey: ['jukeboxState'],
    queryFn: async () => {
      await ensureSession()
      const { data, error } = await supabase.from('jukebox_state').select('*').maybeSingle()
      if (error) throw new Error(error.message)
      return toJukeboxState(data)
    },
  })

/** Warm the cache for Tasks, Rewards, Lists and Jukebox. Errors are ignored; the screens retry and show them. */
const calendarSourcesQuery = () =>
  queryOptions({
    queryKey: ['calendarSources'],
    queryFn: async () =>
      (await run(() => supabase.from('calendar_sources').select('*').order('name'))).map(toCalendarSource),
  })

const eventsQuery = (rangeStartIso: string, rangeEndIso: string) =>
  queryOptions({
    queryKey: ['events', rangeStartIso, rangeEndIso],
    queryFn: async () => {
      const rows = await run(() =>
        supabase
          .from('events')
          .select('*, calendar_sources!inner(enabled)')
          .eq('calendar_sources.enabled', true)
          .lt('starts_at', rangeEndIso)
          .gt('ends_at', rangeStartIso)
          .order('starts_at'),
      )
      const rangeStart = new Date(rangeStartIso)
      const rangeEnd = new Date(rangeEndIso)
      return rows
        .map((r) => toCalendarEvent(r, rangeStart, rangeEnd))
        .filter((e): e is CalendarEvent => Boolean(e))
    },
  })

export const prefetchLiveScreens = (queryClient: QueryClient) => {
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return Promise.all([
    queryClient.prefetchQuery(membersQuery()),
    queryClient.prefetchQuery(tasksQuery()),
    queryClient.prefetchQuery(taskTemplatesQuery()),
    queryClient.prefetchQuery(bountiesQuery()),
    queryClient.prefetchQuery(completedQuery(localDate())),
    queryClient.prefetchQuery(rewardsQuery()),
    queryClient.prefetchQuery(ledgerQuery()),
    queryClient.prefetchQuery(redemptionsQuery()),
    queryClient.prefetchQuery(rewardDealQuery()),
    queryClient.prefetchQuery(wishlistQuery()),
    queryClient.prefetchQuery(listsQuery()),
    queryClient.prefetchQuery(speakersQuery()),
    queryClient.prefetchQuery(favoritesQuery()),
    queryClient.prefetchQuery(queueQuery()),
    queryClient.prefetchQuery(jukeboxStateQuery()),
    queryClient.prefetchQuery(calendarSourcesQuery()),
    queryClient.prefetchQuery(eventsQuery(weekStart.toISOString(), weekEnd.toISOString())),
    queryClient.prefetchQuery(recipesQuery()),
    queryClient.prefetchQuery(mealPlanQuery(localDate(weekStart), localDate(new Date(weekEnd.getTime() - 1)))),
    queryClient.prefetchQuery(householdQuery()),
    queryClient.prefetchQuery(householdSettingsQuery()),
    queryClient.prefetchQuery(weatherQuery()),
  ])
}

async function signedRecipeUrls(paths: (string | null)[]) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unique.length) return new Map<string, string>()
  const { data, error } = await supabase.storage.from('recipe-images').createSignedUrls(unique, 60 * 60 * 24)
  if (error) throw new Error(error.message)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl)
  }
  return map
}

const recipesQuery = () =>
  queryOptions({
    queryKey: ['recipes'],
    queryFn: async () => {
      const rows = await run(() => supabase.from('recipes').select('*').order('title'))
      const urls = await signedRecipeUrls(rows.map((r) => r.image_path))
      return rows.map((r) => toRecipe(r, r.image_path ? urls.get(r.image_path) : null))
    },
  })

const mealPlanQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ['mealPlan', from, to],
    queryFn: async () =>
      (await run(() =>
        supabase.from('meal_plan').select('*').gte('date', from).lte('date', to).order('date'),
      )).map(toMealPlanRow),
  })

const householdQuery = () =>
  queryOptions({
    queryKey: ['household'],
    queryFn: async () => {
      await ensureSession()
      const { data, error } = await supabase
        .from('households')
        .select('id, name, import_token, location_lat, location_lon, timezone')
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('No household')
      return data
    },
  })

function toHouseholdSettings(row: {
  household_id: string
  sleep_start: string
  sleep_end: string
  idle_minutes: number
  slide_seconds: number
  weather_units: string
  location_label: string | null
  location_zip: string | null
  pin_protect_rewards: boolean
  pin_protect_settings: boolean
  pin_protect_deletes: boolean
  pin_lock_minutes: number
}): HouseholdSettings {
  return {
    householdId: row.household_id,
    sleepStart: row.sleep_start,
    sleepEnd: row.sleep_end,
    idleMinutes: row.idle_minutes,
    slideSeconds: row.slide_seconds,
    weatherUnits: row.weather_units === 'c' ? 'c' : 'f',
    locationLabel: row.location_label,
    locationZip: row.location_zip,
    pinProtectRewards: row.pin_protect_rewards,
    pinProtectSettings: row.pin_protect_settings,
    pinProtectDeletes: row.pin_protect_deletes,
    pinLockMinutes: row.pin_lock_minutes,
  }
}

const SETTINGS_SELECT =
  'household_id, sleep_start, sleep_end, idle_minutes, slide_seconds, weather_units, location_label, location_zip, pin_protect_rewards, pin_protect_settings, pin_protect_deletes, pin_lock_minutes' as const

const householdSettingsQuery = () =>
  queryOptions({
    queryKey: ['householdSettings'],
    queryFn: async () => {
      const row = await run(() =>
        supabase.from('household_settings').select(SETTINGS_SELECT).limit(1).maybeSingle(),
      )
      if (!row) throw new Error('No household settings')
      return toHouseholdSettings(row)
    },
  })

const weatherQuery = () =>
  queryOptions({
    queryKey: ['weather'],
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
    queryFn: async (): Promise<Weather | null> => {
      await ensureSession()
      const [{ data: household, error: hErr }, { data: settings, error: sErr }] = await Promise.all([
        supabase.from('households').select('location_lat, location_lon').limit(1).maybeSingle(),
        supabase.from('household_settings').select('weather_units').limit(1).maybeSingle(),
      ])
      if (hErr) throw new Error(hErr.message)
      if (sErr) throw new Error(sErr.message)
      const lat = household?.location_lat
      const lon = household?.location_lon
      if (lat == null || lon == null) return null
      const units = settings?.weather_units === 'c' ? 'c' : 'f'
      return fetchOpenMeteo(lat, lon, units)
    },
  })

// Members

/** Active household people for rails, pickers, and shops. Cache still holds everyone for `who()`. */
export const useMembers = () =>
  useQuery({
    ...membersQuery(),
    select: (rows) => rows.filter((m) => m.active),
  })

/** Full roster including inactive — Settings family editor. */
export const useAllMembers = () => useQuery(membersQuery())

export const useHouseholdSettings = () => useQuery(householdSettingsQuery())

export const useWeather = () => useQuery(weatherQuery())

export function useVerifyParentPin() {
  return useMutation({
    mutationFn: async (pin: string) => {
      await ensureSession()
      const { data, error } = await supabase.rpc('verify_parent_pin', { pin })
      if (error) throw new Error(error.message)
      return Boolean(data)
    },
  })
}

export function useSetParentPin() {
  return useMutation({
    mutationFn: async (pin: string) => {
      await ensureSession()
      const { error } = await supabase.rpc('set_parent_pin', { pin })
      if (error) throw new Error(error.message)
    },
  })
}

export function useUpdateHouseholdSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Omit<HouseholdSettings, 'householdId'>>) => {
      const patch: Database['public']['Tables']['household_settings']['Update'] = {}
      if (input.sleepStart !== undefined) patch.sleep_start = input.sleepStart
      if (input.sleepEnd !== undefined) patch.sleep_end = input.sleepEnd
      if (input.idleMinutes !== undefined) patch.idle_minutes = input.idleMinutes
      if (input.slideSeconds !== undefined) patch.slide_seconds = input.slideSeconds
      if (input.weatherUnits !== undefined) patch.weather_units = input.weatherUnits
      if (input.locationLabel !== undefined) patch.location_label = input.locationLabel
      if (input.locationZip !== undefined) patch.location_zip = input.locationZip
      if (input.pinProtectRewards !== undefined) patch.pin_protect_rewards = input.pinProtectRewards
      if (input.pinProtectSettings !== undefined) patch.pin_protect_settings = input.pinProtectSettings
      if (input.pinProtectDeletes !== undefined) patch.pin_protect_deletes = input.pinProtectDeletes
      if (input.pinLockMinutes !== undefined) patch.pin_lock_minutes = input.pinLockMinutes
      await run(() => supabase.from('household_settings').update(patch).not('household_id', 'is', null))
    },
    onSettled: () => {
      void refetch(queryClient, 'householdSettings')
      void queryClient.invalidateQueries({ queryKey: ['weather'] })
    },
  })
}

export type MemberInput = {
  name: string
  role: Member['role']
  roleLabel: string
  /** Named preset or `#RRGGBB` (never system `slate`). */
  color: string
  avatar: string
  earnsPoints: boolean
  active: boolean
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      role?: Member['role']
      roleLabel?: string
      color?: string
      avatar?: string
      earnsPoints?: boolean
      active?: boolean
    }) => {
      const patch: Database['public']['Tables']['members']['Update'] = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.role !== undefined) patch.role = input.role
      if (input.roleLabel !== undefined) patch.role_label = input.roleLabel
      if (input.color !== undefined) patch.color = input.color
      if (input.avatar !== undefined) patch.avatar = input.avatar
      if (input.earnsPoints !== undefined) patch.earns_points = input.earnsPoints
      if (input.active !== undefined) patch.active = input.active
      await run(() => supabase.from('members').update(patch).eq('id', input.id))
    },
    onMutate: async (input) =>
      optimistic<Member[]>(queryClient, ['members'], (list) =>
        list.map((m) => {
          if (m.id !== input.id) return m
          const name = input.name ?? m.name
          return {
            ...m,
            name,
            initial: name.charAt(0).toUpperCase(),
            role: input.role ?? m.role,
            roleLabel: input.roleLabel ?? m.roleLabel,
            color: input.color ?? m.color,
            avatar: input.avatar ?? m.avatar,
            earnsPoints: input.earnsPoints ?? m.earnsPoints,
            active: input.active ?? m.active,
          }
        }),
      ),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'members'),
  })
}

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: MemberInput) => {
      const existing = queryClient.getQueryData<Member[]>(['members']) ?? []
      const row = await run(() =>
        supabase
          .from('members')
          .insert({
            name: input.name,
            role: input.role,
            role_label: input.roleLabel || (input.role === 'parent' ? 'Parent' : 'Child'),
            color: input.color,
            avatar: input.avatar || 'pebble',
            earns_points: input.earnsPoints,
            active: input.active,
            sort_order: existing.length + 1,
          })
          .select('*')
          .single(),
      ) as Parameters<typeof toMember>[0]
      return toMember(row)
    },
    onMutate: (input) =>
      optimistic<Member[]>(queryClient, ['members'], (list) => [
        ...list,
        {
          id: `pending-${Date.now()}`,
          name: input.name,
          initial: input.name.charAt(0).toUpperCase(),
          role: input.role,
          roleLabel: input.roleLabel || (input.role === 'parent' ? 'Parent' : 'Child'),
          color: input.color,
          avatar: input.avatar || 'pebble',
          earnsPoints: input.earnsPoints,
          active: input.active,
        },
      ]),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'members'),
  })
}

/** Hard delete — cascades tasks, points, redemptions, and wishlist for this person. */
export function useDeleteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await run(() => supabase.from('members').delete().eq('id', id))
    },
    onMutate: (id) =>
      optimistic<Member[]>(queryClient, ['members'], (list) => list.filter((m) => m.id !== id)),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'members'),
  })
}

// Calendar

export const useCalendarSources = () => useQuery(calendarSourcesQuery())

export const useEvents = (rangeStart: Date, rangeEnd: Date) =>
  useQuery(eventsQuery(rangeStart.toISOString(), rangeEnd.toISOString()))

export function useToggleCalendarSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await run(() => supabase.from('calendar_sources').update({ enabled }).eq('id', id))
    },
    onMutate: async ({ id, enabled }) => {
      const key = ['calendarSources'] as const
      const rollback = await optimistic<CalendarSource[]>(queryClient, key, (old) =>
        old.map((s) => (s.id === id ? { ...s, enabled } : s)),
      )
      return { rollback }
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => refetch(queryClient, 'calendarSources', 'events'),
  })
}

/** Who a Google calendar’s events show as on the hub. Clears sync_token so the next sync rewrites event colors. */
export function useAssignCalendarSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memberId }: { id: string; memberId: string | null }) => {
      await run(() =>
        supabase
          .from('calendar_sources')
          .update({ member_id: memberId, sync_token: null })
          .eq('id', id),
      )
    },
    onMutate: async ({ id, memberId }) => {
      const key = ['calendarSources'] as const
      const rollback = await optimistic<CalendarSource[]>(queryClient, key, (old) =>
        old.map((s) => (s.id === id ? { ...s, memberId } : s)),
      )
      return { rollback }
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => refetch(queryClient, 'calendarSources', 'events'),
  })
}

/** Pull latest events from Google via the calendar-sync edge function. */
export function useSyncCalendars() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await ensureSession()
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean
        error?: string
        summary?: Array<{ account?: string; error?: string }>
      }>('calendar-sync', {
        method: 'POST',
        body: {},
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      const accountErrors = (data?.summary ?? [])
        .filter((row): row is { account?: string; error: string } => Boolean(row.error))
        .map((row) => (row.account ? `${row.account}: ${row.error}` : row.error))
      if (accountErrors.length) throw new Error(accountErrors.join('; '))
      return data
    },
    onSettled: () => refetch(queryClient, 'calendarSources', 'events'),
  })
}

// Tasks

export const useTasks = () => useQuery(tasksQuery())
export const useTaskTemplates = () => useQuery(taskTemplatesQuery())
export const useBounties = () => useQuery(bountiesQuery())

/** Ids of the tasks completed on `date` (one task_completions row per task per day). */
export const useCompleted = (date: string = localDate()) => useQuery(completedQuery(date))

export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, done, period }: { taskId: string; done: boolean; period: string }) =>
      done
        ? run(() => supabase.from('task_completions').insert({ task_id: taskId, period, for_date: period }))
        : run(() => supabase.from('task_completions').delete().eq('task_id', taskId).eq('period', period)),
    onMutate: ({ taskId, done, period }) =>
      optimistic<string[]>(queryClient, ['completions', period], (ids) =>
        done ? [...ids, taskId] : ids.filter((id) => id !== taskId),
      ),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'completions', 'ledger'),
  })
}

export type AddTaskInput = {
  templateId?: string
  newTemplate?: { title: string; icon: string; points: number; frequency: Frequency }
  /** A member id, or 'bounty' for the bounty board. */
  assignee: string
  frequency: Frequency
  schedule: Schedule
  points: number
}

/** Create a library template (optional), then a task or an open bounty. */
export function useAddTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddTaskInput) => {
      await ensureSession()
      let templateId = input.templateId
      let title = input.newTemplate?.title ?? ''

      if (input.newTemplate) {
        const created = (await run(() =>
          supabase
            .from('task_templates')
            .insert({
              title: input.newTemplate!.title.slice(0, 32),
              icon: input.newTemplate!.icon,
              points: input.newTemplate!.points,
              frequency: input.newTemplate!.frequency,
              uses: 1,
            })
            .select('id, title')
            .single(),
        )) as { id: string; title: string } | null
        if (!created) throw new Error('Couldn’t save task to the library')
        templateId = created.id
        title = created.title
      } else if (templateId) {
        const { data: existing, error } = await supabase
          .from('task_templates')
          .select('title, uses')
          .eq('id', templateId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!existing) throw new Error('Task library entry not found')
        title = existing.title
        await run(() =>
          supabase.from('task_templates').update({ uses: (existing.uses ?? 0) + 1 }).eq('id', templateId!),
        )
      } else {
        throw new Error('Pick a task from the library or create one')
      }

      if (input.assignee === 'bounty') {
        const dueDay =
          input.schedule.kind === 'weekly' || input.schedule.kind === 'thisWeek'
            ? input.schedule.dueDay
            : 6
        await run(() =>
          supabase.from('bounties').insert({
            template_id: templateId!,
            points: Math.max(5, input.points),
            due_day: dueDay,
            week_of: isoDate(startOfWeek(new Date())),
          }),
        )
        return { title, taskId: null as string | null }
      }

      const cols = scheduleColumns(input.frequency, input.schedule)
      const task = (await run(() =>
        supabase
          .from('tasks')
          .insert({
            template_id: templateId!,
            member_id: input.assignee,
            frequency: input.frequency,
            points: input.points,
            days: cols.days,
            once_on: cols.once_on,
            every_weeks: cols.every_weeks,
            week_of: cols.week_of,
            due_day: cols.due_day,
          })
          .select('id')
          .single(),
      )) as { id: string } | null
      if (!task) throw new Error('Couldn’t add that task')
      return { title, taskId: task.id }
    },
    onSettled: () => {
      void refetch(queryClient, 'tasks', 'taskTemplates', 'bounties')
    },
  })
}

/** Race-safe bounty claim → inserts a this-week task for the claimer. */
export function useClaimBounty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bountyId, memberId }: { bountyId: string; memberId: string }) => {
      await ensureSession()
      const claimedAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('bounties')
        .update({ claimed_by: memberId, claimed_at: claimedAt })
        .eq('id', bountyId)
        .is('claimed_by', null)
        .select('*')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const task = (await run(() =>
        supabase
          .from('tasks')
          .insert({
            template_id: data.template_id,
            member_id: memberId,
            frequency: 'weekly',
            points: data.points,
            week_of: data.week_of,
            due_day: data.due_day ?? 6,
            bounty_id: data.id,
          })
          .select('*')
          .single(),
      )) as Parameters<typeof toTask>[0] | null
      if (!task) throw new Error('Couldn’t claim that bounty')
      return toTask(task)
    },
    onSettled: () => {
      void refetch(queryClient, 'tasks', 'bounties')
    },
  })
}

// Rewards

export const useRewards = () => useQuery(rewardsQuery())

export const useLedger = () => useQuery(ledgerQuery())

export const usePendingRedemptions = () => useQuery(redemptionsQuery())

export const useRewardDeal = () => useQuery(rewardDealQuery())

export const useWishlist = () => useQuery(wishlistQuery())

/** Buy: insert redemption (trigger holds stars in the ledger right away). */
export function useRedeem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, rewardId, cost }: { memberId: string; rewardId: string; cost: number }) =>
      run(() =>
        supabase.from('reward_redemptions').insert({ member_id: memberId, reward_id: rewardId, cost }),
      ),
    onMutate: ({ memberId, rewardId, cost }) =>
      optimistic<Redemption[]>(queryClient, ['redemptions'], (list) => [
        ...list,
        { id: `pending-${Date.now()}`, memberId, rewardId, cost },
      ]),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'redemptions', 'ledger'),
  })
}

/** Approve = status only. Deny = status + ledger refund (database trigger). */
export function useDecideRedemption() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      run(() => supabase.from('reward_redemptions').update({ status }).eq('id', id)),
    onMutate: ({ id }) => optimistic<Redemption[]>(queryClient, ['redemptions'], (list) => list.filter((r) => r.id !== id)),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'redemptions', 'ledger'),
  })
}

/** One wishlist goal per person. Tapping the same reward again clears it. */
export function useToggleWishlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, rewardId }: { memberId: string; rewardId: string }) => {
      const current = queryClient.getQueryData<Record<string, string | null>>(['wishlist']) ?? {}
      if (current[memberId] === rewardId) {
        await run(() => supabase.from('wishlist').delete().eq('member_id', memberId))
        return null
      }
      await run(() =>
        supabase.from('wishlist').upsert({ member_id: memberId, reward_id: rewardId }, { onConflict: 'member_id' }),
      )
      return rewardId
    },
    onMutate: ({ memberId, rewardId }) =>
      optimistic<Record<string, string | null>>(queryClient, ['wishlist'], (w) => ({
        ...w,
        [memberId]: w[memberId] === rewardId ? null : rewardId,
      })),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'wishlist'),
  })
}

export type RewardInput = {
  title: string
  blurb: string
  aisle: RewardAisle
  cost: number
  icon: string
  color: MemberColor
}

/** Stock the shop: create a reward. */
export function useCreateReward() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RewardInput) => {
      const existing = queryClient.getQueryData<Reward[]>(['rewards']) ?? []
      const sortOrder = existing.length + 1
      const row = await run(() =>
        supabase
          .from('rewards')
          .insert({
            title: input.title,
            blurb: input.blurb,
            aisle: input.aisle,
            cost: input.cost,
            icon: input.icon,
            color: input.color,
            sort_order: sortOrder,
            active: true,
          })
          .select('*')
          .single(),
      ) as Parameters<typeof toReward>[0]
      return toReward(row)
    },
    onMutate: (input) =>
      optimistic<Reward[]>(queryClient, ['rewards'], (list) => [
        ...list,
        {
          id: `pending-${Date.now()}`,
          title: input.title,
          blurb: input.blurb,
          aisle: input.aisle,
          cost: input.cost,
          icon: input.icon as Reward['icon'],
          color: input.color,
        },
      ]),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'rewards'),
  })
}

/** Stock the shop: edit a reward. */
export function useUpdateReward() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: RewardInput & { id: string }) =>
      run(() =>
        supabase
          .from('rewards')
          .update({
            title: input.title,
            blurb: input.blurb,
            aisle: input.aisle,
            cost: input.cost,
            icon: input.icon,
            color: input.color,
          })
          .eq('id', id),
      ),
    onMutate: ({ id, ...input }) =>
      optimistic<Reward[]>(queryClient, ['rewards'], (list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                title: input.title,
                blurb: input.blurb,
                aisle: input.aisle,
                cost: input.cost,
                icon: input.icon as Reward['icon'],
                color: input.color,
              }
            : r,
        ),
      ),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'rewards'),
  })
}

/** Soft-delete: set active = false so past redemptions keep their reward. */
export function useDeleteReward() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await run(() => supabase.from('rewards').update({ active: false }).eq('id', id))
      await run(() => supabase.from('wishlist').delete().eq('reward_id', id))
      await run(() => supabase.from('reward_deals').delete().eq('reward_id', id))
    },
    onMutate: async (id) => {
      const rollRewards = await optimistic<Reward[]>(queryClient, ['rewards'], (list) => list.filter((r) => r.id !== id))
      const rollWish = await optimistic<Record<string, string | null>>(queryClient, ['wishlist'], (w) => {
        const next = { ...w }
        for (const [memberId, rewardId] of Object.entries(next)) {
          if (rewardId === id) next[memberId] = null
        }
        return next
      })
      const rollDeal = await optimistic<RewardDeal | null>(queryClient, ['rewardDeal'], (deal) =>
        deal?.rewardId === id ? null : deal,
      )
      return () => { rollRewards(); rollWish(); rollDeal() }
    },
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'rewards', 'rewardDeal', 'wishlist'),
  })
}

// Lists

export const useLists = () => useQuery(listsQuery())

const patchItems = (listId: string, fn: (items: ListItem[]) => ListItem[]) => (lists: ShoppingList[]) =>
  lists.map((l) => (l.id === listId ? { ...l, items: fn(l.items) } : l))

export function useAddListItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, text, category, qty }: { listId: string; text: string; category?: string; qty?: string }) =>
      run(() => supabase.from('list_items').insert({
        list_id: listId,
        text,
        category: category ?? 'Other',
        quantity: qty ?? null,
      })),
    onMutate: ({ listId, text, category, qty }) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], patchItems(listId, (items) => [
        ...items,
        { id: `pending-${Date.now()}`, text, category: category ?? 'Other', qty, checked: false },
      ])),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

export function useDeleteListItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { listId: string; id: string }) =>
      run(() => supabase.from('list_items').delete().eq('id', id)),
    onMutate: ({ listId, id }) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], patchItems(listId, (items) => items.filter((i) => i.id !== id))),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

export function useCreateList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      icon,
      color,
      sortOrder,
    }: {
      name: string
      icon: string
      color: MemberColor
      sortOrder: number
    }) => {
      const row = await run(() =>
        supabase
          .from('lists')
          .insert({ name, icon, color, sort_order: sortOrder })
          .select('id')
          .single(),
      ) as { id: string }
      return row.id
    },
    onMutate: async ({ name, icon, color }) => {
      const pendingId = `pending-${Date.now()}`
      const rollback = await optimistic<ShoppingList[]>(queryClient, ['lists'], (lists) => [
        ...lists,
        { id: pendingId, name, icon: icon as ShoppingList['icon'], color, items: [] },
      ])
      return { rollback, pendingId }
    },
    onSuccess: (id, _vars, ctx) => {
      if (!ctx?.pendingId) return
      queryClient.setQueryData<ShoppingList[]>(['lists'], (old) =>
        old?.map((l) => (l.id === ctx.pendingId ? { ...l, id } : l)),
      )
    },
    onError: (_err, _vars, ctx) => ctx?.rollback(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

export function useToggleListItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, checked }: { listId: string; id: string; checked: boolean }) =>
      run(() =>
        supabase.from('list_items').update({ checked_at: checked ? new Date().toISOString() : null }).eq('id', id),
      ),
    onMutate: ({ listId, id, checked }) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], patchItems(listId, (items) =>
        items.map((i) => (i.id === id ? { ...i, checked } : i)),
      )),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

export function useClearChecked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) =>
      run(() => supabase.from('list_items').delete().eq('list_id', listId).not('checked_at', 'is', null)),
    onMutate: (listId) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], patchItems(listId, (items) => items.filter((i) => !i.checked))),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

export function useClearList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) => run(() => supabase.from('list_items').delete().eq('list_id', listId)),
    onMutate: (listId) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], patchItems(listId, () => [])),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

export function useDeleteList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) => run(() => supabase.from('lists').delete().eq('id', listId)),
    onMutate: (listId) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], (lists) => lists.filter((l) => l.id !== listId)),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

/** Creates or reuses a non-expired share token for the phone shopping page. */
export function useListShareLink() {
  return useMutation({
    mutationFn: async (listId: string) => {
      await ensureSession()
      const nowIso = new Date().toISOString()
      const { data: existing, error: existingError } = await supabase
        .from('list_share_tokens')
        .select('token, expires_at')
        .eq('list_id', listId)
        .is('revoked_at', null)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existingError) throw new Error(existingError.message)
      if (existing?.token) return existing.token

      const { data: created, error: createError } = await supabase
        .from('list_share_tokens')
        .insert({ list_id: listId })
        .select('token')
        .single()
      if (createError) throw new Error(createError.message)
      if (!created?.token) throw new Error('Could not create share link')
      return created.token
    },
  })
}

// Recipes / meals

export const useRecipes = () => useQuery(recipesQuery())
export const useHousehold = () => useQuery(householdQuery())
export const useMealPlan = (from: string, to: string) => useQuery(mealPlanQuery(from, to))

export { type Weather }

export function useUpdateRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      title?: string
      servings?: number
      prepMin?: number
      cookMin?: number
      tags?: string[]
      ingredients?: Ingredient[]
      steps?: RecipeStep[]
      favorite?: boolean
    }) =>
      run(() =>
        supabase.from('recipes').update({
          title: input.title,
          servings: input.servings,
          prep_min: input.prepMin,
          cook_min: input.cookMin,
          tags: input.tags
            ? normalizeRecipeTags(input.tags, { prepMin: input.prepMin, cookMin: input.cookMin })
            : input.tags,
          ingredients: input.ingredients as unknown as Json,
          steps: input.steps as unknown as Json,
          favorite: input.favorite,
        }).eq('id', input.id),
      ),
    onMutate: async (input) => {
      if (input.favorite === undefined) return
      await queryClient.cancelQueries({ queryKey: ['recipes'] })
      const previous = queryClient.getQueryData<Recipe[]>(['recipes'])
      if (previous) {
        queryClient.setQueryData<Recipe[]>(
          ['recipes'],
          previous.map((r) => (r.id === input.id ? { ...r, favorite: input.favorite } : r)),
        )
      }
      return () => queryClient.setQueryData(['recipes'], previous)
    },
    onError: (_err, _input, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'recipes'),
  })
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await ensureSession()
      const { data: row, error: fetchError } = await supabase
        .from('recipes')
        .select('image_path')
        .eq('id', id)
        .maybeSingle()
      if (fetchError) throw new Error(fetchError.message)
      // Clear meal-plan slots first: FK is ON DELETE SET NULL, but rows with
      // recipe_id only (title null) would violate meal_plan_entry_check.
      await run(() => supabase.from('meal_plan').delete().eq('recipe_id', id))
      await run(() => supabase.from('recipes').delete().eq('id', id))
      if (row?.image_path) {
        await supabase.storage.from('recipe-images').remove([row.image_path])
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['recipes'] })
      await queryClient.cancelQueries({ queryKey: ['mealPlan'] })
      const previousRecipes = queryClient.getQueryData<Recipe[]>(['recipes'])
      const previousPlans = queryClient.getQueriesData<MealPlanRow[]>({ queryKey: ['mealPlan'] })
      if (previousRecipes) {
        queryClient.setQueryData<Recipe[]>(
          ['recipes'],
          previousRecipes.filter((r) => r.id !== id),
        )
      }
      for (const [key, rows] of previousPlans) {
        if (!rows) continue
        queryClient.setQueryData<MealPlanRow[]>(
          key,
          rows.filter((row) => row.recipeId !== id),
        )
      }
      return () => {
        queryClient.setQueryData(['recipes'], previousRecipes)
        for (const [key, rows] of previousPlans) queryClient.setQueryData(key, rows)
      }
    },
    onError: (_err, _id, rollback) => rollback?.(),
    onSettled: () => {
      void refetch(queryClient, 'recipes')
      void queryClient.invalidateQueries({ queryKey: ['mealPlan'] })
    },
  })
}

export function useUpsertMealPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      date: string
      slot: Database['public']['Enums']['meal_slot']
      recipeId?: string | null
      title?: string | null
      clear?: boolean
    }) => {
      if (input.clear) {
        await run(() =>
          supabase.from('meal_plan').delete().eq('date', input.date).eq('slot', input.slot),
        )
        return
      }
      await ensureSession()
      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('id')
        .limit(1)
        .maybeSingle()
      if (householdError) throw new Error(householdError.message)
      if (!household) throw new Error('No household')
      await run(() =>
        supabase.from('meal_plan').upsert(
          {
            household_id: household.id,
            date: input.date,
            slot: input.slot,
            recipe_id: input.recipeId ?? null,
            title: input.title ?? null,
          },
          { onConflict: 'household_id,date,slot' },
        ),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['mealPlan'] }),
  })
}

async function lookupKrogerAisles(names: string[]) {
  if (!names.length) return {} as Record<string, string>
  await ensureSession()
  const { data, error } = await supabase.functions.invoke<{
    aisles?: Record<string, string>
    error?: string
  }>('kroger-aisles', { body: { names } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.aisles ?? {}
}

/** Apply Kroger aisle labels onto already-inserted items (best-effort, non-blocking). */
async function applyKrogerAisles(listId: string, texts: string[]) {
  if (!texts.length) return
  try {
    const aisles = await lookupKrogerAisles(texts)
    const updates = Object.entries(aisles)
    if (!updates.length) return
    await ensureSession()
    await Promise.all(
      updates.map(([key, category]) => {
        const match = texts.find((t) => normalizeIngredientName(t) === key)
        if (!match) return Promise.resolve()
        return supabase
          .from('list_items')
          .update({ category })
          .eq('list_id', listId)
          .eq('text', match)
          .then(({ error }) => {
            if (error) throw new Error(error.message)
          })
      }),
    )
  } catch {
    // Heuristic categories already written; Kroger can fail quietly.
  }
}

export function useAddWeekIngredients() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      entries,
      recipes,
    }: {
      entries: MealPlanRow[]
      recipes: Recipe[]
    }) => {
      const lists = await run(() =>
        supabase.from('lists').select('id, name, list_items(id, text, quantity)').order('sort_order'),
      )
      const groceries = lists.find((l) => l.name.toLowerCase() === 'groceries') ?? lists[0]
      if (!groceries) throw new Error('No grocery list found')

      type Agg = {
        text: string
        qty: GroceryQty | { display: string } | null
        category: string
      }
      const byName = new Map<string, Agg>()
      for (const entry of entries) {
        if (!entry.recipeId) continue
        const recipe = recipes.find((r) => r.id === entry.recipeId)
        if (!recipe) continue
        for (const ing of recipe.ingredients) {
          if (!isShoppableIngredient(ing.name)) continue
          const key = normalizeIngredientName(ing.name)
          if (!key) continue
          const nextQty = ingredientToGroceryQty(ing)
          const existing = byName.get(key)
          if (!existing) {
            byName.set(key, {
              text: ing.name,
              qty: nextQty,
              category: guessGroceryAisle(ing.name),
            })
            continue
          }
          existing.qty = mergeGroceryQty(
            existing.qty && !('display' in existing.qty) ? existing.qty : parseGroceryQty(groceryQtyToString(existing.qty)),
            nextQty,
          )
        }
      }

      const existingByKey = new Map(
        (groceries.list_items ?? []).map((i) => [
          normalizeIngredientName(i.text),
          { id: i.id, text: i.text, quantity: i.quantity as string | null },
        ]),
      )

      const toInsert: { list_id: string; text: string; quantity: string | null; category: string }[] = []
      const toUpdate: { id: string; quantity: string }[] = []

      for (const [key, value] of byName) {
        const qtyText = groceryQtyToString(value.qty) ?? null
        const onList = existingByKey.get(key)
        if (!onList) {
          toInsert.push({
            list_id: groceries.id,
            text: value.text,
            quantity: qtyText,
            category: value.category,
          })
          continue
        }
        // Same item already on the list — add this week's amount onto it when possible.
        const merged = mergeGroceryQty(parseGroceryQty(onList.quantity), value.qty && !('display' in value.qty) ? value.qty : parseGroceryQty(qtyText))
        const mergedText = groceryQtyToString(merged)
        if (mergedText && mergedText !== (onList.quantity ?? '')) {
          toUpdate.push({ id: onList.id, quantity: mergedText })
        }
      }

      if (toInsert.length) {
        await run(() => supabase.from('list_items').insert(toInsert))
        void applyKrogerAisles(
          groceries.id,
          toInsert.map((row) => row.text),
        ).then(() => refetch(queryClient, 'lists'))
      }
      for (const row of toUpdate) {
        await run(() => supabase.from('list_items').update({ quantity: row.quantity }).eq('id', row.id))
      }
      return { added: toInsert.length, updated: toUpdate.length, listId: groceries.id }
    },
    onSettled: () => refetch(queryClient, 'lists'),
  })
}

// Jukebox — UI writes intent; the Pi music-agent runs playback.

export type FavoriteInput = {
  uri: string
  kind: MediaKind
  title: string
  subtitle?: string
  albumTitle?: string
  imageUrl?: string
  durationMs?: number
  trackCount?: number
  isOwned?: boolean
}

export type QueueTrackInput = {
  spotifyUri: string
  title: string
  subtitle?: string
  imageUrl?: string
  durationMs?: number
}

export const useSpeakers = () => useQuery(speakersQuery())
export const useFavorites = () => useQuery(favoritesQuery())
export const useJukeboxQueue = () => useQuery(queueQuery())
export const useJukeboxState = () => useQuery(jukeboxStateQuery())

export function useJukeboxCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      type,
      speakerId,
      payload = {},
    }: {
      type: JukeboxCommandType
      speakerId?: string | null
      payload?: Json
    }) =>
      run(() =>
        supabase.from('jukebox_commands').insert({
          type,
          speaker_id: speakerId ?? null,
          payload: payload ?? {},
        }),
      ),
    onSettled: () => refetch(queryClient, 'jukeboxState', 'speakers', 'jukeboxQueue'),
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: FavoriteInput) => {
      const existing = queryClient.getQueryData<JukeboxFavorite[]>(['jukeboxFavorites'])?.find((f) => f.spotifyUri === input.uri)
      if (existing) {
        await run(() => supabase.from('jukebox_favorites').delete().eq('id', existing.id))
        return { removed: true as const, title: existing.title }
      }
      const maxOrder = Math.max(0, ...(queryClient.getQueryData<JukeboxFavorite[]>(['jukeboxFavorites']) ?? []).map((f) => f.sortOrder))
      await run(() =>
        supabase.from('jukebox_favorites').insert({
          uri: input.uri,
          kind: input.kind,
          title: input.title,
          subtitle: input.subtitle ?? null,
          album_title: input.albumTitle ?? null,
          image_url: input.imageUrl ?? null,
          duration_ms: input.durationMs ?? null,
          track_count: input.trackCount ?? null,
          is_owned: input.isOwned ?? null,
          sort_order: maxOrder + 1,
        }),
      )
      return { removed: false as const, title: input.title }
    },
    onSettled: () => refetch(queryClient, 'jukeboxFavorites'),
  })
}

async function rewriteQueue(tracks: QueueTrackInput[]) {
  await run(() => supabase.from('jukebox_queue').delete().gte('position', 0))
  if (!tracks.length) return
  await run(() =>
    supabase.from('jukebox_queue').insert(
      tracks.map((t, i) => ({
        position: i,
        spotify_uri: t.spotifyUri,
        title: t.title,
        subtitle: t.subtitle ?? null,
        image_url: t.imageUrl ?? null,
        duration_ms: t.durationMs ?? null,
      })),
    ),
  )
}

const asInput = (q: QueueItem): QueueTrackInput => ({
  spotifyUri: q.spotifyUri,
  title: q.title,
  subtitle: q.subtitle,
  imageUrl: q.imageUrl,
  durationMs: q.durationMs,
})

export function useQueueMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => refetch(queryClient, 'jukeboxQueue')
  const current = () =>
    [...(queryClient.getQueryData<QueueItem[]>(['jukeboxQueue']) ?? [])].sort((a, b) => a.position - b.position)

  return {
    add: useMutation({
      mutationFn: async ({ track, atFront }: { track: QueueTrackInput; atFront?: boolean }) => {
        const rest = current().filter((q) => q.spotifyUri !== track.spotifyUri).map(asInput)
        await rewriteQueue(atFront ? [track, ...rest] : [...rest, track])
      },
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        await rewriteQueue(current().filter((q) => q.id !== id).map(asInput))
      },
      onSettled: invalidate,
    }),
    clear: useMutation({
      mutationFn: async () => rewriteQueue([]),
      onSettled: invalidate,
    }),
    moveUp: useMutation({
      mutationFn: async (id: string) => {
        const list = current()
        const i = list.findIndex((q) => q.id === id)
        if (i <= 0) return
        const next = list.map(asInput)
        ;[next[i - 1], next[i]] = [next[i]!, next[i - 1]!]
        await rewriteQueue(next)
      },
      onSettled: invalidate,
    }),
    replaceAll: useMutation({
      mutationFn: async (tracks: QueueTrackInput[]) => rewriteQueue(tracks),
      onSettled: invalidate,
    }),
  }
}

// ---------- Workout coach ----------

const athleteProfilesQuery = () =>
  queryOptions({
    queryKey: ['athleteProfiles'],
    queryFn: async () =>
      (await run(() => supabase.from('athlete_profiles').select('*'))).map(toAthleteProfile),
  })

const coachPlansQuery = (date: string) =>
  queryOptions({
    queryKey: ['coachPlans', date],
    queryFn: async () => {
      const rows = await run(() =>
        supabase.from('coach_plans').select('member_id, date, plan, direction').eq('date', date),
      )
      return rows.map((r) => toCoachPlan(r.member_id, r.date, r.plan, r.direction))
    },
  })

const activitiesQuery = (since: string) =>
  queryOptions({
    queryKey: ['activities', since],
    queryFn: async () =>
      (
        await run(() =>
          supabase.from('activities').select('*').gte('date', since).order('date', { ascending: false }),
        )
      ).map(toActivity),
  })

export function useAthleteProfiles() {
  return useQuery(athleteProfilesQuery())
}

export function useCoachPlans(date = localDate()) {
  return useQuery(coachPlansQuery(date))
}

export function useRecentActivities(days = 35) {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)
  const since = localDate(sinceDate)
  return useQuery(activitiesQuery(since))
}

export function useCompletePlanPart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { memberId: string; part: 'cardio' | 'strength'; feel?: Feel }) => {
      const args: { p_member: string; p_part: string; p_feel?: string } = {
        p_member: input.memberId,
        p_part: input.part,
      }
      if (input.feel) args.p_feel = input.feel
      const row = await run(() => supabase.rpc('complete_plan_part', args))
      return toActivity(row)
    },
    onSettled: () => refetch(queryClient, 'activities', 'ledger', 'coachPlans'),
  })
}

export function useRateActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { memberId: string; part: 'cardio' | 'strength'; feel: Feel; date: string }) => {
      await run(() =>
        supabase
          .from('activities')
          .update({ feel: input.feel })
          .eq('member_id', input.memberId)
          .eq('date', input.date)
          .eq('plan_part', input.part),
      )
    },
    onMutate: async (input) => {
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 35)
      return optimistic<Activity[]>(queryClient, ['activities', localDate(sinceDate)], (list) =>
        list.map((a) =>
          a.memberId === input.memberId && a.date === input.date && a.planPart === input.part
            ? { ...a, feel: input.feel }
            : a,
        ),
      )
    },
    onSettled: () => refetch(queryClient, 'activities'),
  })
}

export function useLogActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (act: Omit<Activity, 'id' | 'date' | 'source'>) => {
      const row = await run(() =>
        supabase
          .from('activities')
          .insert({
            member_id: act.memberId,
            date: localDate(),
            kind: act.kind,
            title: act.title,
            minutes: act.minutes,
            distance_mi: act.distanceMi ?? null,
            source: 'hub',
            plan_part: null,
            feel: act.feel ?? null,
          })
          .select('*')
          .single(),
      )
      if (!row) throw new Error('Activity insert returned no row')
      return toActivity(row)
    },
    onSettled: () => refetch(queryClient, 'activities'),
  })
}

export function useInvokeCoach() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { mode: 'daily' | 'swap'; memberId?: string; reason?: SwapReason }) => {
      await ensureSession()
      const { data, error } = await supabase.functions.invoke('coach', { body })
      if (error) throw new Error(error.message)
      return data as { plan?: CoachPlan; results?: unknown; error?: string }
    },
    onSettled: () => refetch(queryClient, 'coachPlans', 'activities'),
  })
}

export type AthleteProfileInput = {
  memberId: string
  coachEnabled: boolean
  daysPerWeek: number
  preferredCardio: CardioKind[]
  equipment: string[]
  limitations?: string
  goals?: string
  easyPace?: string
}

export function useUpsertAthleteProfile() {
  const queryClient = useQueryClient()
  const coach = useInvokeCoach()
  return useMutation({
    mutationFn: async (input: AthleteProfileInput) => {
      const row = await run(() =>
        supabase
          .from('athlete_profiles')
          .upsert({
            member_id: input.memberId,
            coach_enabled: input.coachEnabled,
            days_per_week: input.daysPerWeek,
            preferred_cardio: input.preferredCardio,
            equipment: input.equipment,
            limitations: input.limitations?.trim() || null,
            goals: input.goals?.trim() || null,
            easy_pace: input.easyPace?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single(),
      )
      if (!row) throw new Error('Athlete profile upsert returned no row')
      const profile = toAthleteProfile(row)
      if (input.coachEnabled) {
        await coach.mutateAsync({ mode: 'daily', memberId: input.memberId })
      }
      return profile
    },
    onMutate: async (input) =>
      optimistic<AthleteProfile[]>(queryClient, ['athleteProfiles'], (list) => {
        const next: AthleteProfile = {
          memberId: input.memberId,
          coachEnabled: input.coachEnabled,
          daysPerWeek: input.daysPerWeek,
          preferredCardio: input.preferredCardio,
          equipment: input.equipment,
          limitations: input.limitations,
          goals: input.goals,
          easyPace: input.easyPace,
        }
        const i = list.findIndex((p) => p.memberId === input.memberId)
        if (i < 0) return [...list, next]
        const copy = [...list]
        copy[i] = next
        return copy
      }),
    onSettled: () => refetch(queryClient, 'athleteProfiles', 'coachPlans'),
  })
}
