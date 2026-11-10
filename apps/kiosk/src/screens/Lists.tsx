import { useState } from 'react'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Avatar, CheckMark, IconTile, Label, Panel, StatusPill } from '../components/primitives'
import { useAddListItem, useClearChecked, useLists, useMembers, useToggleListItem } from '../data/hooks'
import { useLive } from '../data/live'
import { LIST_ACTIVITY, MEAL_PLAN, RECIPES } from '../data/mock'
import { shortDay } from '../lib/format'
import { who } from '../lib/members'
import type { ListItem } from '@hub/shared'
import type { ShoppingList } from '../lib/types'
import s from './Lists.module.css'

export default function Lists() {
  const lists = useLists()
  // Assignee avatars resolve through who(), which reads the cached members.
  const members = useMembers()
  useLive('list_items', 'lists')

  if (!lists.data || !members.data) return <AppShell>{null}</AppShell>
  return <ListsView lists={lists.data} />
}

function ListsView({ lists }: { lists: ShoppingList[] }) {
  const addItem = useAddListItem()
  const toggleItem = useToggleListItem()
  const clearChecked = useClearChecked()
  const [activeId, setActiveId] = useState(lists[0].id)
  const [draft, setDraft] = useState('')
  const [mealsAdded, setMealsAdded] = useState(false)
  const active = lists.find((l) => l.id === activeId)!

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

  const open = active.items.filter((i) => !i.checked)
  const checked = active.items.filter((i) => i.checked)
  const groups = open.reduce<Record<string, ListItem[]>>((acc, i) => ((acc[i.category] ??= []).push(i), acc), {})
  const dinners = MEAL_PLAN.dinner
    .map((e, day) => ({ day, recipe: e && 'recipeId' in e ? RECIPES.find((r) => r.id === e.recipeId) : undefined }))
    .filter((d) => d.recipe)
    .slice(0, 4)

  return (
    <AppShell>
      <PageHeader title="Lists" actions={<StatusPill>Live with everyone’s phones</StatusPill>} />
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
            <span className={s.summary}>{open.length} to get · {checked.length} in the cart</span>
          </div>
          <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); add() }}>
            <label className="sr-only" htmlFor="add-item">Add an item</label>
            <input id="add-item" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an item…" autoComplete="off" />
            <Button type="submit">Add</Button>
          </form>
          <div className={`${s.groups} scroll-y`}>
            {Object.entries(groups).map(([cat, items]) => (
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
            {dinners.map((d) => (
              <div key={d.day} className={s.meal}><span className={s.mealDay}>{shortDay(d.day)}</span>{d.recipe!.title}</div>
            ))}
            {mealsAdded
              ? <div className={`${s.mealsAdded} anim-pop`} role="status"><Icon name="tick" size={22} stroke={3} />Added to Groceries</div>
              : <Button size="lg" onClick={() => setMealsAdded(true)}>Add ingredients to Groceries</Button>}
          </Panel>
          <Panel className={`${s.card} ${s.activity}`} aria-label="Recent activity">
            <Label>Recent activity</Label>
            {LIST_ACTIVITY.map((a, k) => {
              const w = who(a.who)
              return (
                <div key={k} className={s.act}>
                  <Avatar initial={w.initial} color={w.color} size="sm" />
                  <span className={s.actText}><span>{a.text}</span><span className={s.actWhen}>{a.when}</span></span>
                </div>
              )
            })}
          </Panel>
        </aside>
      </div>
    </AppShell>
  )
}
