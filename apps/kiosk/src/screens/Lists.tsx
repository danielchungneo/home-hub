import { useEffect, useMemo, useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { Avatar, CheckMark, IconTile, Label, Panel, StatusPill } from '../components/primitives'
import {
  useAddListItem,
  useAddWeekIngredients,
  useClearChecked,
  useClearList,
  useDeleteList,
  useHouseholdSettings,
  useListShareLink,
  useLists,
  useMealPlan,
  useMembers,
  useRecipes,
  useToggleListItem,
} from '../data/hooks'
import { useLive } from '../data/live'
import { localDate } from '../data/mappers'
import { addDays, shortDay, startOfWeek } from '../lib/format'
import { who } from '../lib/members'
import { aisleSortKey, type ListItem } from '@hub/shared'
import type { ShoppingList } from '../lib/types'
import s from './Lists.module.css'

function shopUrl(token: string) {
  const base = (import.meta.env.VITE_LIST_SHOP_URL as string | undefined)?.replace(/\/$/, '')
    || 'https://chung-smart-home.vercel.app/shop'
  return `${base}/?token=${encodeURIComponent(token)}`
}

export default function Lists() {
  const lists = useLists()
  // Assignee avatars resolve through who(), which reads the cached members.
  const members = useMembers()
  useLive('list_items', 'lists')
  useLive('meal_plan', 'mealPlan')
  useLive('recipes', 'recipes')

  if (!lists.data || !members.data) return <AppShell>{null}</AppShell>
  return <ListsView lists={lists.data} />
}

function ListsView({ lists }: { lists: ShoppingList[] }) {
  const { requirePin } = useNav()
  const settings = useHouseholdSettings()
  const addItem = useAddListItem()
  const toggleItem = useToggleListItem()
  const clearChecked = useClearChecked()
  const clearList = useClearList()
  const deleteList = useDeleteList()
  const shareLink = useListShareLink()
  const addIngredients = useAddWeekIngredients()
  const { data: recipes = [] } = useRecipes()

  const weekStart = useMemo(() => startOfWeek(new Date()), [])
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => localDate(addDays(weekStart, i))),
    [weekStart],
  )
  const { data: planRows = [] } = useMealPlan(weekDates[0]!, weekDates[6]!)

  const dinners = useMemo(() => {
    const byDate = new Map(
      planRows
        .filter((r) => r.slot === 'dinner' && r.recipeId)
        .map((r) => [r.date, r.recipeId!]),
    )
    return weekDates.flatMap((date, day) => {
      const recipeId = byDate.get(date)
      if (!recipeId) return []
      const recipe = recipes.find((r) => r.id === recipeId)
      if (!recipe) return []
      return [{ day, title: recipe.title }]
    })
  }, [planRows, recipes, weekDates])

  const [activeId, setActiveId] = useState(lists[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [mealsStatus, setMealsStatus] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const active = lists.find((l) => l.id === activeId) ?? lists[0]

  useEffect(() => {
    if (!lists.some((l) => l.id === activeId) && lists[0]) setActiveId(lists[0].id)
  }, [lists, activeId])

  if (!active) {
    return (
      <AppShell>
        <PageHeader title="Lists" />
        <Panel className={s.main}><p className={s.summary}>No lists yet.</p></Panel>
      </AppShell>
    )
  }

  const toggle = (id: string) => {
    const item = active.items.find((i) => i.id === id)
    if (item) toggleItem.mutate({ listId: active.id, id, checked: !item.checked })
  }
  const clearDone = () => clearChecked.mutate(active.id)
  const add = () => {
    const text = draft.trim()
    if (!text) return
    addItem.mutate({ listId: active.id, text })
    setDraft('')
  }

  const openShop = () => {
    setShowQr(true)
    setShareError(null)
    setShareToken(null)
    shareLink.mutate(active.id, {
      onSuccess: (token) => setShareToken(token),
      onError: (err) => setShareError(err instanceof Error ? err.message : 'Couldn’t create a share link'),
    })
  }

  const pushGroceries = async () => {
    if (addIngredients.isPending) return
    try {
      const result = await addIngredients.mutateAsync({ entries: planRows, recipes })
      const changed = result.added + (result.updated ?? 0)
      if (result.added && result.updated) setMealsStatus(`Added ${result.added}, updated ${result.updated}`)
      else if (result.added) setMealsStatus(`Added ${result.added} to Groceries`)
      else if (result.updated) setMealsStatus(`Updated ${result.updated} amounts`)
      else setMealsStatus('Groceries already up to date')
      if (changed > 0) {
        const groceries = lists.find((l) => l.name.toLowerCase() === 'groceries')
        if (groceries) setActiveId(groceries.id)
      }
    } catch (err) {
      setMealsStatus(err instanceof Error ? err.message : 'Couldn’t add ingredients')
    }
  }

  const canDelete = lists.length > 1
  const performDelete = () => {
    const id = active.id
    const name = active.name
    const next = lists.find((l) => l.id !== id)
    const apply = () => {
      setConfirmDelete(false)
      if (next) setActiveId(next.id)
      deleteList.mutate(id)
    }
    if (!(settings.data?.pinProtectDeletes ?? false)) {
      apply()
      return
    }
    requirePin({
      title: `To delete “${name}”`,
      detail: 'This removes the list and every item on it.',
      onSuccess: apply,
    })
  }
  const requestDelete = () => {
    if (!canDelete) return
    setConfirmDelete(true)
  }

  const hasItems = active.items.length > 0
  const performClear = () => {
    const id = active.id
    const name = active.name
    const apply = () => {
      setConfirmClear(false)
      clearList.mutate(id)
    }
    if (!(settings.data?.pinProtectDeletes ?? false)) {
      apply()
      return
    }
    requirePin({
      title: `To clear “${name}”`,
      detail: 'This removes every item on the list.',
      onSuccess: apply,
    })
  }
  const requestClear = () => {
    if (!hasItems) return
    setConfirmClear(true)
  }

  const open = active.items.filter((i) => !i.checked)
  const checked = active.items.filter((i) => i.checked)
  const groups = Object.entries(
    open.reduce<Record<string, ListItem[]>>((acc, i) => ((acc[i.category] ??= []).push(i), acc), {}),
  ).sort(([a], [b]) => aisleSortKey(a) - aisleSortKey(b) || a.localeCompare(b))

  const addUrl = shareToken ? shopUrl(shareToken) : null
  const qrSrc = addUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(addUrl)}`
    : null

  return (
    <AppShell>
      <PageHeader
        title="Lists"
        actions={
          <>
            <Button variant="rail" size="lg" pill icon="cart" onClick={openShop}>Shop on phone</Button>
            <StatusPill>Live with everyone’s phones</StatusPill>
          </>
        }
      />
      <div className={s.layout}>
        <nav className={s.lists} aria-label="All lists">
          {lists.map((l) => {
            const count = l.items.filter((i) => !i.checked).length
            const on = l.id === activeId
            return (
              <button key={l.id} type="button" aria-current={on ? 'true' : undefined} className={on ? `${s.listBtn} ${s.listOn}` : s.listBtn} onClick={() => setActiveId(l.id)}>
                <IconTile icon={l.icon} color={l.color} size={60} />
                <span className={s.listName}>{l.name}</span>
                <span className={s.count}>{count}</span>
              </button>
            )
          })}
          <button type="button" className={s.newList}><Icon name="plus" size={22} />New list</button>
        </nav>

        <Panel className={s.main} aria-label={active.name}>
          <div className={s.mainHead}>
            <h2 className={s.h2}>{active.name}</h2>
            <div className={s.mainHeadRight}>
              <span className={s.summary}>{open.length} to get · {checked.length} in the cart</span>
              <Button
                variant="secondary"
                pill
                disabled={!hasItems || clearList.isPending}
                onClick={requestClear}
              >
                Clear list
              </Button>
              <IconButton
                variant="secondary"
                icon="trash"
                label={canDelete ? `Delete ${active.name}` : 'Keep at least one list'}
                disabled={!canDelete || deleteList.isPending}
                onClick={requestDelete}
              />
            </div>
          </div>
          <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); add() }}>
            <label className="sr-only" htmlFor="add-item">Add an item</label>
            <input id="add-item" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an item…" autoComplete="off" />
            <Button type="submit">Add</Button>
          </form>
          <div className={`${s.groups} scroll-y`}>
            {groups.map(([cat, items]) => (
              <div key={cat} className={s.group}>
                <Label className={s.groupLabel}>{cat}</Label>
                {items.map((i) => {
                  const a = i.assignee ? who(i.assignee) : null
                  return (
                    <button key={i.id} type="button" aria-pressed={false} aria-label={`Check off ${i.text}`} className={s.item} onClick={() => toggle(i.id)}>
                      <CheckMark checked={false} size={52} />
                      <span className={s.itemText}>{i.text}</span>
                      {i.qty && <span className={s.qty}>{i.qty}</span>}
                      {a && <Avatar initial={a.initial} color={a.color} size="sm" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {checked.length > 0 && (
            <div className={s.done}>
              <div className={s.doneHead}>
                <Label>In the cart · {checked.length}</Label>
                <Button variant="secondary" pill onClick={clearDone}>Clear completed</Button>
              </div>
              <div className={s.doneItems}>
                {checked.map((i) => (
                  <button key={i.id} type="button" aria-pressed={true} aria-label={`Put back ${i.text}`} className={`${s.doneItem} anim-pop`} onClick={() => toggle(i.id)}>
                    <span data-color="moss"><CheckMark checked size={40} /></span>
                    <span className={s.strike}>{i.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <aside className={s.side}>
          <Panel className={s.card} aria-label="From this week's meals">
            <Label>From this week’s meals</Label>
            {dinners.length === 0 ? (
              <p className={s.sideEmpty}>No dinners planned this week yet.</p>
            ) : (
              dinners.map((d) => (
                <div key={`${d.day}-${d.title}`} className={s.meal}>
                  <span className={s.mealDay}>{shortDay(d.day)}</span>
                  {d.title}
                </div>
              ))
            )}
            {mealsStatus
              ? <div className={`${s.mealsAdded} anim-pop`} role="status"><Icon name="tick" size={22} stroke={3} />{mealsStatus}</div>
              : (
                <Button
                  size="lg"
                  disabled={dinners.length === 0 || addIngredients.isPending}
                  onClick={() => void pushGroceries()}
                >
                  {addIngredients.isPending ? 'Adding ingredients…' : 'Add ingredients to Groceries'}
                </Button>
              )}
          </Panel>
        </aside>
      </div>

      {showQr && (
        <div className={s.qrScrim} role="dialog" aria-modal="true" aria-label="Shop on phone" onClick={() => setShowQr(false)}>
          <div className={s.qrCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.qrHead}>
              <span className={s.qrTitle}>Shop {active.name} on your phone</span>
              <IconButton variant="secondary" icon="close" label="Close" onClick={() => setShowQr(false)} />
            </div>
            {qrSrc ? (
              <>
                <img className={s.qrImg} src={qrSrc} alt="" width={360} height={360} />
                <p className={s.qrHint}>Scan to open the checklist. Checks sync back here live.</p>
              </>
            ) : shareError ? (
              <p className={s.qrHint}>{shareError}</p>
            ) : (
              <p className={s.qrHint}>Getting a link ready…</p>
            )}
          </div>
        </div>
      )}

      {confirmClear && (
        <div className={s.qrScrim} role="dialog" aria-modal="true" aria-label={`Clear ${active.name}`} onClick={() => setConfirmClear(false)}>
          <div className={s.confirmCard} onClick={(e) => e.stopPropagation()}>
            <span className={s.qrTitle}>Clear “{active.name}”?</span>
            <p className={s.qrHint}>This removes every item on the list. The list itself stays.</p>
            <div className={s.confirmActions}>
              <Button variant="secondary" size="lg" onClick={() => setConfirmClear(false)}>Keep items</Button>
              <Button size="lg" disabled={clearList.isPending} onClick={performClear}>Clear list</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className={s.qrScrim} role="dialog" aria-modal="true" aria-label={`Delete ${active.name}`} onClick={() => setConfirmDelete(false)}>
          <div className={s.confirmCard} onClick={(e) => e.stopPropagation()}>
            <span className={s.qrTitle}>Delete “{active.name}”?</span>
            <p className={s.qrHint}>This removes the list and every item on it. You can’t undo it.</p>
            <div className={s.confirmActions}>
              <Button variant="secondary" size="lg" onClick={() => setConfirmDelete(false)}>Keep list</Button>
              <Button size="lg" icon="trash" disabled={deleteList.isPending} onClick={performDelete}>Delete list</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
