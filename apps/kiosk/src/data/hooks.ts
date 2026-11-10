// Query and mutation hooks for the screens backed by Supabase.
// Mutations update the cache first so taps feel instant on the Pi, then refetch.
import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import type { Database, Json, JukeboxFavorite, ListItem, MediaKind, QueueItem, Redemption } from '@hub/shared'
import { ensureSession, supabase } from '../lib/supabase'
import type { ShoppingList } from '../lib/types'
import {
  localDate,
  toFavorite,
  toJukeboxState,
  toLedgerEntry,
  toList,
  toMember,
  toQueueItem,
  toRedemption,
  toReward,
  toSpeaker,
  toTask,
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
export const prefetchLiveScreens = (queryClient: QueryClient) =>
  Promise.all([
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
  ])

// Members

export const useMembers = () => useQuery(membersQuery())

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
