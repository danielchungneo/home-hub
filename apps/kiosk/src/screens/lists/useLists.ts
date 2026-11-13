import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useAddListItem,
  useClearChecked,
  useClearList,
  useCreateList,
  useDeleteListItem,
  useLists as useListsQuery,
  useMembers,
  useToggleListItem,
} from '../../data/hooks'
import type { MemberColor } from '@hub/shared'
import type { IconName } from '../../components/Icon'
import { useLive } from '../../data/live'
import { ensureSession, supabase } from '../../lib/supabase'
import { who } from '../../lib/members'
import type { ShoppingList } from '../../lib/types'

export interface FeedEntry { id: string; who: string; text: string; when: string }
export interface NewRow { text: string; category: string; qty?: string }

let seq = 0
const nextId = () => `f${Date.now().toString(36)}${++seq}`

/**
 * List state over Supabase. Mutations map to list_items insert / update checked /
 * delete checked. Realtime inserts from phones arrive through `receive`.
 */
export function useLists() {
  const query = useListsQuery()
  const members = useMembers()
  useLive('list_items', 'lists')

  const addItem = useAddListItem()
  const deleteItem = useDeleteListItem()
  const createListMut = useCreateList()
  const toggleItem = useToggleListItem()
  const clearCheckedMut = useClearChecked()
  const clearListMut = useClearList()

  const [feed, setFeed] = useState<FeedEntry[]>([])
  /** Item id → who added it just now ('hub' or a member id). */
  const [fresh, setFresh] = useState<Record<string, string>>({})
  const timers = useRef<number[]>([])
  /** Texts we just inserted from the hub — skip receive for those Realtime echoes. */
  const pendingHub = useRef(new Set<string>())
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const lists: ShoppingList[] = useMemo(() => {
    const rows = query.data ?? []
    return rows.map((l) => ({
      ...l,
      usual: l.usual ?? [],
    }))
  }, [query.data])

  const markFresh = useCallback((ids: string[], by: string) => {
    if (!ids.length) return
    setFresh((f) => ({ ...f, ...Object.fromEntries(ids.map((id) => [id, by])) }))
    timers.current.push(window.setTimeout(() => setFresh((f) => {
      const n = { ...f }
      ids.forEach((id) => delete n[id])
      return n
    }), by === 'hub' ? 1800 : 6000))
  }, [])

  /** INSERT list_items. */
  const add = useCallback((listId: string, rows: NewRow[], by = 'hub') => {
    for (const r of rows) {
      const key = `${listId}:${r.text.toLowerCase()}`
      pendingHub.current.add(key)
      timers.current.push(window.setTimeout(() => pendingHub.current.delete(key), 8000))
      addItem.mutate({ listId, text: r.text, category: r.category, qty: r.qty })
    }
    // Optimistic pending ids aren't stable; highlight by matching text after refetch.
    timers.current.push(window.setTimeout(() => {
      const list = query.data?.find((l) => l.id === listId)
      if (!list) return
      const ids = rows.flatMap((r) => {
        const match = [...list.items].reverse().find((i) => i.text.toLowerCase() === r.text.toLowerCase() && !i.checked)
        return match ? [match.id] : []
      })
      if (ids.length) markFresh(ids, by)
    }, 400))
  }, [addItem, markFresh, query.data])

  /** UPDATE list_items SET checked. */
  const setChecked = useCallback((listId: string, itemId: string, checked: boolean) => {
    toggleItem.mutate({ listId, id: itemId, checked })
    if (!checked) markFresh([itemId], 'hub')
  }, [toggleItem, markFresh])

  /** DELETE list_items WHERE checked. */
  const clearChecked = useCallback((listId: string) => {
    clearCheckedMut.mutate(listId)
  }, [clearCheckedMut])

  /** DELETE all list_items for a list. */
  const clearAll = useCallback((listId: string) => {
    clearListMut.mutate(listId)
  }, [clearListMut])

  /** DELETE one list item. */
  const removeItem = useCallback((listId: string, itemId: string) => {
    deleteItem.mutate({ listId, id: itemId })
  }, [deleteItem])

  /** INSERT lists row; returns the new id. */
  const createList = useCallback(async (input: { name: string; icon: IconName; color: MemberColor }) => {
    return createListMut.mutateAsync({
      name: input.name,
      icon: input.icon,
      color: input.color,
      sortOrder: (query.data?.length ?? 0) + 1,
    })
  }, [createListMut, query.data])

  /** A change from someone's phone (Realtime). Data itself arrives via useLive refetch. */
  const receive = useCallback((listId: string, row: NewRow, memberId: string, name: string) => {
    markFresh(
      (query.data?.find((l) => l.id === listId)?.items ?? [])
        .filter((i) => i.text.toLowerCase() === row.text.toLowerCase() && !i.checked)
        .map((i) => i.id)
        .slice(-1),
      memberId,
    )
    setFeed((f) => [{ id: nextId(), who: memberId, text: `${name} added ${row.text}`, when: 'Just now' }, ...f].slice(0, 6))
  }, [markFresh, query.data])

  // Realtime INSERT → receive for phone-added rows (added_by ≠ hub / missing = skip badge until column exists).
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined
    let cancelled = false
    void ensureSession().then(() => {
      if (cancelled) return
      channel = supabase
        .channel(`lists-receive:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'list_items' },
          (payload) => {
            const row = payload.new as {
              id: string
              list_id: string
              text: string
              category: string | null
              quantity: string | null
              added_by?: string | null
            }
            const key = `${row.list_id}:${row.text.toLowerCase()}`
            if (pendingHub.current.has(key)) {
              pendingHub.current.delete(key)
              return
            }
            const addedBy = row.added_by
            if (!addedBy) return
            const name = who(addedBy).name
            receive(row.list_id, {
              text: row.text,
              category: row.category ?? 'Other',
              qty: row.quantity ?? undefined,
            }, addedBy, name)
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [receive])

  return {
    lists,
    feed,
    fresh,
    add,
    setChecked,
    clearChecked,
    clearAll,
    removeItem,
    createList,
    receive,
    ready: Boolean(query.data && members.data),
    parents: (members.data ?? []).filter((m) => m.role === 'parent'),
  }
}
