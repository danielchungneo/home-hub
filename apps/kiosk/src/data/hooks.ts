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
  type CalendarEvent, type CalendarSource, type Database, type GroceryQty, type HouseholdSettings, type Ingredient, type Json, type JukeboxFavorite, type ListItem, type MediaKind, type MemberColor, type QueueItem, type RecipeStep, type Redemption, type Routine,
} from '@hub/shared'
import { ensureSession, supabase } from '../lib/supabase'
import { fetchOpenMeteo, type Weather } from '../lib/weather'
import type { Recipe, ShoppingList } from '../lib/types'
import { WEATHER as FALLBACK_WEATHER } from './mock'
import {
  localDate,
  toCalendarEvent,
  toCalendarSource,
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
  toSpeaker,
  toTask,
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
      (await run(() => supabase.from('tasks').select('*').is('archived_at', null).order('sort_order'))).map(toTask),
  })

const completedQuery = (date: string) =>
  queryOptions({
    queryKey: ['completions', date],
    queryFn: async () =>
      (await run(() => supabase.from('task_completions').select('task_id').eq('for_date', date))).map((r) => r.task_id),
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
    queryClient.prefetchQuery(completedQuery(localDate())),
    queryClient.prefetchQuery(rewardsQuery()),
    queryClient.prefetchQuery(ledgerQuery()),
    queryClient.prefetchQuery(redemptionsQuery()),
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
    queryFn: async (): Promise<Weather> => {
      await ensureSession()
      const [{ data: household, error: hErr }, { data: settings, error: sErr }] = await Promise.all([
        supabase.from('households').select('location_lat, location_lon').limit(1).maybeSingle(),
        supabase.from('household_settings').select('weather_units').limit(1).maybeSingle(),
      ])
      if (hErr) throw new Error(hErr.message)
      if (sErr) throw new Error(sErr.message)
      const lat = household?.location_lat
      const lon = household?.location_lon
      if (lat == null || lon == null) {
        return { ...FALLBACK_WEATHER, fetchedAt: Date.now() }
      }
      const units = settings?.weather_units === 'c' ? 'c' : 'f'
      return fetchOpenMeteo(lat, lon, units)
    },
  })

// Members

export const useMembers = () => useQuery(membersQuery())

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

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      color?: MemberColor
      routines?: Routine[]
      earnsPoints?: boolean
      roleLabel?: string
    }) => {
      await run(() =>
        supabase.from('members').update({
          color: input.color,
          routine_filters: input.routines,
          earns_points: input.earnsPoints,
          role_label: input.roleLabel,
        }).eq('id', input.id),
      )
    },
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

/** Ids of the tasks completed on `date` (one task_completions row per task per day). */
export const useCompleted = (date: string = localDate()) => useQuery(completedQuery(date))

export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, done, date }: { taskId: string; done: boolean; date: string }) =>
      done
        ? run(() => supabase.from('task_completions').insert({ task_id: taskId, for_date: date }))
        : run(() => supabase.from('task_completions').delete().eq('task_id', taskId).eq('for_date', date)),
    onMutate: ({ taskId, done, date }) =>
      optimistic<string[]>(queryClient, ['completions', date], (ids) =>
        done ? [...ids, taskId] : ids.filter((id) => id !== taskId),
      ),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'completions', 'ledger'),
  })
}

// Rewards

export const useRewards = () => useQuery(rewardsQuery())

export const useLedger = () => useQuery(ledgerQuery())

export const usePendingRedemptions = () => useQuery(redemptionsQuery())

export function useRedeem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, rewardId }: { memberId: string; rewardId: string }) =>
      run(() => supabase.from('reward_redemptions').insert({ member_id: memberId, reward_id: rewardId })),
    onMutate: ({ memberId, rewardId }) =>
      optimistic<Redemption[]>(queryClient, ['redemptions'], (list) => [
        ...list,
        { id: `pending-${Date.now()}`, memberId, rewardId },
      ]),
    onError: (_err, _vars, rollback) => rollback?.(),
    onSettled: () => refetch(queryClient, 'redemptions'),
  })
}

/** Approving spends the points (a database trigger writes the ledger row). */
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

// Lists

export const useLists = () => useQuery(listsQuery())

const patchItems = (listId: string, fn: (items: ListItem[]) => ListItem[]) => (lists: ShoppingList[]) =>
  lists.map((l) => (l.id === listId ? { ...l, items: fn(l.items) } : l))

export function useAddListItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, text }: { listId: string; text: string }) =>
      run(() => supabase.from('list_items').insert({ list_id: listId, text, category: 'Added' })),
    onMutate: ({ listId, text }) =>
      optimistic<ShoppingList[]>(queryClient, ['lists'], patchItems(listId, (items) => [
        ...items,
        { id: `pending-${Date.now()}`, text, category: 'Added', checked: false },
      ])),
    onError: (_err, _vars, rollback) => rollback?.(),
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
      await run(() => supabase.from('recipes').delete().eq('id', id))
      if (row?.image_path) {
        await supabase.storage.from('recipe-images').remove([row.image_path])
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['recipes'] })
      const previous = queryClient.getQueryData<Recipe[]>(['recipes'])
      if (previous) queryClient.setQueryData<Recipe[]>(['recipes'], previous.filter((r) => r.id !== id))
      return () => queryClient.setQueryData(['recipes'], previous)
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
