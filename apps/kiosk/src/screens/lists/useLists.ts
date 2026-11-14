import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useAddListItem,
  useClearChecked,
  useClearList,
  useCreateList,
  useDeleteList,
  useDeleteListItem,
  useLists as useListsQuery,
  useMembers,
  useToggleListItem,
} from '../../data/hooks'
import type { MemberColor } from '@hub/shared'
import type { IconName } from '../../components/Icon'
import { useLive } from '../../data/live'
import { ensureSession, supabase } from '../../lib/supabase'
import type { ShoppingList } from '../../lib/types'

export interface NewRow { text: string; category: string; qty?: string }

/** The household groceries list stays — everything else can be removed. */
export function isGroceriesList(name: string) {
  const n = name.trim().toLowerCase()
  return n === 'groceries' || n === 'grocery'
}

/**
 * List state over Supabase. Mutations map to list_items insert / update checked /
 * delete. Phone and kiosk stay one-to-one via `useLive` on `list_items`.
 */
export function useLists() {
  const query = useListsQuery()
  const members = useMembers()
  useLive('list_items', 'lists')

  const addItem = useAddListItem()
  const deleteItem = useDeleteListItem()
  const createListMut = useCreateList()
  const deleteListMut = useDeleteList()
  const toggleItem = useToggleListItem()
  const clearCheckedMut = useClearChecked()
  const clearListMut = useClearList()

  /** Item id → who added it just now ('hub' or a member id). */
  const [fresh, setFresh] = useState<Record<string, string>>({})
  const timers = useRef<number[]>([])
  /** Texts we just inserted from the hub — skip phone-badge for those Realtime echoes. */
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

  /** DELETE lists row (and items via cascade). Groceries is protected. */
  const deleteList = useCallback(async (listId: string) => {
    const list = query.data?.find((l) => l.id === listId)
    if (!list) throw new Error('List not found')
    if (isGroceriesList(list.name)) throw new Error('Groceries can’t be deleted')
    await deleteListMut.mutateAsync(listId)
  }, [deleteListMut, query.data])

  // Realtime INSERT from a phone → brief "New · {name}" badge on the row.
  // Checked / unchecked / edits sync through useLive refetch of the same list.
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
              added_by?: string | null
            }
            const key = `${row.list_id}:${row.text.toLowerCase()}`
            if (pendingHub.current.has(key)) {
              pendingHub.current.delete(key)
              return
            }
            const addedBy = row.added_by
            if (!addedBy) return
            markFresh([row.id], addedBy)
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [markFresh])

  return {
    lists,
    fresh,
    add,
    setChecked,
    clearChecked,
    clearAll,
    removeItem,
    createList,
    deleteList,
    ready: Boolean(query.data && members.data),
    parents: (members.data ?? []).filter((m) => m.role === 'parent'),
  }
}
