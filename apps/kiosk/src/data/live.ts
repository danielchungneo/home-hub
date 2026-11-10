import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ensureSession, supabase } from '../lib/supabase'

type RealtimeChannel = ReturnType<typeof supabase.channel>
type LiveTable =
  | 'tasks'
  | 'task_completions'
  | 'points_ledger'
  | 'reward_redemptions'
  | 'list_items'
  | 'speakers'
  | 'jukebox_state'
  | 'jukebox_commands'
  | 'jukebox_favorites'
  | 'jukebox_queue'
  | 'events'
  | 'calendar_sources'

let channelCount = 0

/** Refetch the given query keys whenever `table` changes. Mount it only on the screen showing that data. */
export function useLive(table: LiveTable, ...queryKeys: string[]) {
  const queryClient = useQueryClient()
  const keys = queryKeys.join(',')

  useEffect(() => {
    let channel: RealtimeChannel | undefined
    let cancelled = false
    const refetch = () => {
      for (const key of keys.split(',')) void queryClient.invalidateQueries({ queryKey: [key] })
    }

    void ensureSession().then(() => {
      if (cancelled) return
      let joined = false
      channel = supabase
        .channel(`live:${table}:${++channelCount}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, refetch)
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          // A rejoin means the connection dropped; catch up on anything missed.
          if (joined) refetch()
          joined = true
        })
    })

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [queryClient, table, keys])
}
