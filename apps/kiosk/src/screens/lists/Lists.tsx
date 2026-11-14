import { useEffect, useMemo, useRef, useState } from 'react'
import { MEMBER_COLOR_PRESETS, type ListItem, type MemberColor } from '@hub/shared'
import { useNav } from '../../app/nav'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { SoftKeyboard } from '../../components/SoftKeyboard'
import { Label } from '../../components/primitives'
import { useAddWeekIngredients, useHouseholdSettings, useListShareLink, useMealPlan, useRecipes } from '../../data/hooks'
import { useLive } from '../../data/live'
import { localDate } from '../../data/mappers'
import { memberColorProps } from '../../lib/colors'
import { addDays, shortDay, startOfWeek } from '../../lib/format'
import { category, categoryOrder, guessCategory, mealIngredientsFromRecipes } from '../../lib/lists'
import { who } from '../../lib/members'
import { isGroceriesList, useLists } from './useLists'
import s from './Lists.module.css'

const CHECK_MS = 420
const LIST_ICONS: IconName[] = ['list', 'cart', 'bag', 'broom', 'key', 'sparkle']
const LIST_COLORS: MemberColor[] = [...MEMBER_COLOR_PRESETS]

function shopUrl(token: string) {
  const base = (import.meta.env.VITE_LIST_SHOP_URL as string | undefined)?.replace(/\/$/, '')
    || 'https://chung-smart-home.vercel.app/shop'
  return `${base}/?token=${encodeURIComponent(token)}`
}

export default function Lists() {
  const { lists, fresh, add, setChecked, clearChecked, clearAll, removeItem, createList, deleteList, ready, parents } = useLists()
  const { requirePin } = useNav()
  const { data: settings } = useHouseholdSettings()
  const shareLink = useListShareLink()
  useLive('meal_plan', 'mealPlan')
  useLive('recipes', 'recipes')

  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState('')
  const [keyboard, setKeyboard] = useState<'item' | 'list' | null>(null)
  const [checking, setChecking] = useState<Record<string, true>>({})
  const [popping, setPopping] = useState<string | null>(null)
  const [mealsAdded, setMealsAdded] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState<IconName>('list')
  const [newColor, setNewColor] = useState<MemberColor>('fjord')
  const [creatingBusy, setCreatingBusy] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!lists.length) return
    if (!lists.some((l) => l.id === activeId)) setActiveId(lists[0]!.id)
  }, [lists, activeId])

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
      return [{ day, recipe }]
    })
  }, [planRows, recipes, weekDates])

  const ingredients = useMemo(() => mealIngredientsFromRecipes(dinners), [dinners])

  if (!ready) return <AppShell>{null}</AppShell>

  const active = lists.find((l) => l.id === activeId) ?? lists[0]
  const openCount = active?.items.filter((i) => !i.checked).length ?? 0
  const doneCount = (active?.items.length ?? 0) - openCount
  const groups = Object.entries(
    (active?.items ?? []).reduce<Record<string, ListItem[]>>((acc, i) => {
      ;(acc[i.category] ??= []).push(i)
      return acc
    }, {}),
  )
    .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
    .map(([cat, items]) => [
      cat,
      [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || a.text.localeCompare(b.text)),
    ] as const)
  const have = new Set((active?.items ?? []).map((i) => i.text.toLowerCase()))
  const suggestions = (active?.usual ?? []).filter((u) => !have.has(u.text.toLowerCase()) || popping === u.text).slice(0, 6)
  const guess = draft.trim() && active ? guessCategory(draft, active.name) : null
  const toGet = lists.reduce((n, l) => n + l.items.filter((i) => !i.checked).length, 0)
  const liveNames = parents.map((p) => `${p.name}’s`).join(' and ') || 'everyone’s'

  const openCreate = () => {
    setNewName('')
    setNewIcon(LIST_ICONS[lists.length % LIST_ICONS.length]!)
    setNewColor(LIST_COLORS[lists.length % LIST_COLORS.length]!)
    setCreating(true)
    setKeyboard('list')
  }

  const toggle = (item: ListItem) => {
    if (!active || checking[item.id]) return
    if (item.checked) {
      setChecked(active.id, item.id, false)
      return
    }
    setChecking((c) => ({ ...c, [item.id]: true }))
    later(CHECK_MS, () => {
      setChecked(active.id, item.id, true)
      setChecking((c) => {
        const next = { ...c }
        delete next[item.id]
        return next
      })
    })
  }
  const addSuggestion = (text: string, cat: string) => {
    if (!active || popping) return
    setPopping(text)
    later(220, () => { setPopping(null); add(active.id, [{ text, category: cat }]) })
  }
  const addTyped = () => {
    if (!active) return
    const text = draft.trim().replace(/^./, (c) => c.toUpperCase())
    if (!text || !guess) return
    add(active.id, [{ text, category: guess }])
    setDraft('')
    setKeyboard(null)
    setToast(`Added ${text} to ${guess}`)
  }
  const clearDone = () => {
    if (!active || !doneCount) return
    clearChecked(active.id)
    setToast('Cleared checked items')
  }
  const confirmClearAll = () => {
    if (!active?.items.length) return
    clearAll(active.id)
    setConfirmClear(false)
    setToast(`${active.name} cleared`)
  }

  const canDeleteActive = !!active && !isGroceriesList(active.name)

  const askDeleteList = () => {
    if (!canDeleteActive) return
    const proceed = () => setConfirmDelete(true)
    if (settings?.pinProtectDeletes) {
      requirePin({
        title: `To remove ${active.name}`,
        detail: 'This deletes the list and everything on it.',
        onSuccess: proceed,
      })
      return
    }
    proceed()
  }

  const confirmDeleteList = async () => {
    if (!active || !canDeleteActive || deleting) return
    const name = active.name
    const id = active.id
    setDeleting(true)
    try {
      await deleteList(id)
      setConfirmDelete(false)
      setToast(`Removed “${name}”`)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Couldn’t remove that list')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }
  const submitCreate = async () => {
    const name = newName.trim().replace(/^./, (c) => c.toUpperCase())
    if (!name || creatingBusy) return
    setCreatingBusy(true)
    try {
      const id = await createList({ name, icon: newIcon, color: newColor })
      setActiveId(id)
      setCreating(false)
      setKeyboard(null)
      setNewName('')
      setToast(`${name} ready`)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Couldn’t create list')
    } finally {
      setCreatingBusy(false)
    }
  }
  const addMeals = async () => {
    if (mealsAdded || addIngredients.isPending) return
    setMealsAdded(true)
    const groceries = lists.find((l) => l.name.toLowerCase() === 'groceries')
    if (groceries) setActiveId(groceries.id)
    try {
      const result = await addIngredients.mutateAsync({ entries: planRows, recipes })
      const n = result.added + (result.updated ?? 0)
      setToast(n ? `Added ${result.added || n} ingredients from this week’s meals` : 'Groceries already up to date')
    } catch (err) {
      setMealsAdded(false)
      setToast(err instanceof Error ? err.message : 'Couldn’t add ingredients')
    }
  }

  const openPhoneQr = async () => {
    if (!active || shareLink.isPending) return
    setShowQr(true)
    setQrSrc(null)
    try {
      const token = await shareLink.mutateAsync(active.id)
      const url = shopUrl(token)
      setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(url)}`)
    } catch (err) {
      setShowQr(false)
      setToast(err instanceof Error ? err.message : 'Couldn’t make a phone link')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Lists · ${toGet} things to get across ${lists.length} lists`}
        title={<span key={active?.id ?? 'none'} className={s.title}>{active?.name ?? 'Lists'}</span>}
        actions={<>
          <span className={s.live}>
            <span className={s.liveFaces}>
              {parents.slice(0, 2).map((p) => (
                <span key={p.id} {...memberColorProps(p.color)} className={s.liveFace}>
                  <MemberBlobAvatar memberId={p.id} size={30} showBackground={false} decorative />
                </span>
              ))}
            </span>
            <span className={s.liveDot} />
            Live with {liveNames} phones
          </span>
          {active && (
            <Button
              variant="rail"
              size="lg"
              pill
              icon="bag"
              disabled={shareLink.isPending}
              onClick={() => void openPhoneQr()}
            >
              Open on phone
            </Button>
          )}
        </>}
      />

      <div className={s.layout}>
        <div className={s.left}>
          <nav className={`${s.rail} scroll-y`} aria-label="All lists">
            {lists.map((l, i) => {
              const left = l.items.filter((x) => !x.checked).length
              const got = l.items.length - left
              return (
                <button key={l.id} type="button" data-color={l.color} aria-current={l.id === active?.id ? 'true' : undefined}
                  className={s.listBtn} style={{ ['--n' as string]: i }} onClick={() => setActiveId(l.id)}>
                  <span className={s.listTile}><Icon name={l.icon} size={38} stroke={2.2} /></span>
                  <span className={s.listText}>
                    <span className={s.listTop}>
                      <span className={s.listName}>{l.name}</span>
                      <span key={left} className={`${s.listLeft} anim-pop`}>{left}</span>
                    </span>
                    <span className={s.listTrack}><span className={s.listFill} style={{ transform: `scaleX(${l.items.length ? got / l.items.length : 0})` }} /></span>
                    <span className={s.listSub}>{left} to get{got ? ` · ${got} done` : ''}</span>
                  </span>
                </button>
              )
            })}
            <button type="button" className={s.newList} onClick={openCreate}>
              <Icon name="plus" size={20} />New list
            </button>
          </nav>
        </div>

        {active ? (
          <section className={s.main} aria-label={active.name}>
            <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); addTyped() }}>
              <label className={s.addField}>
                <Icon name="plus" size={24} stroke={2.6} />
                <span className="sr-only">Add to {active.name}</span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={() => setKeyboard('item')}
                  placeholder={`Add to ${active.name}…`}
                  autoComplete="off"
                  inputMode="none"
                />
                {guess && (
                  <span data-color={category(guess).color} className={s.guess}>
                    <Icon name={category(guess).icon} size={20} stroke={2.2} />→ {guess}
                  </span>
                )}
              </label>
              <button type="submit" className={s.addBtn} disabled={!draft.trim()}>Add</button>
            </form>

            {suggestions.length > 0 && (
              <div className={s.usual}>
                <Label>Usually on it</Label>
                {suggestions.map((u) => (
                  <button key={u.text} type="button" data-color={category(u.category).color}
                    className={popping === u.text ? `${s.chip} ${s.chipPop}` : s.chip} onClick={() => addSuggestion(u.text, u.category)}>
                    <span className={s.chipIcon}><Icon name={category(u.category).icon} size={22} stroke={2.2} /></span>
                    {u.text}
                  </button>
                ))}
              </div>
            )}

            {(active.items.length > 0 || canDeleteActive) && (
              <div className={s.listTools}>
                <span className={s.listToolsHint}>
                  {active.items.length
                    ? (doneCount > 0 ? `${doneCount} checked · ${openCount} left` : `${active.items.length} on the list`)
                    : 'Empty list'}
                </span>
                <span className={s.listToolsActions}>
                  {doneCount > 0 && (
                    <button type="button" className={s.clear} onClick={clearDone}>Clear checked</button>
                  )}
                  {active.items.length > 0 && (
                    <button type="button" className={s.clear} onClick={() => setConfirmClear(true)}>Clear list</button>
                  )}
                  {canDeleteActive && (
                    <button type="button" className={s.clear} onClick={askDeleteList}>
                      {settings?.pinProtectDeletes ? 'Delete list…' : 'Delete list'}
                    </button>
                  )}
                </span>
              </div>
            )}

            <div key={active.id} className={`${s.groups} scroll-y`}>
              <div className={s.columns}>
                {groups.map(([cat, items], gi) => {
                  const c = category(cat)
                  const openInGroup = items.filter((i) => !i.checked).length
                  return (
                    <div key={cat} data-color={c.color} className={s.group} style={{ ['--n' as string]: gi }}>
                      <div className={s.groupHead}>
                        <span className={s.groupIcon}><Icon name={c.icon} size={26} stroke={2.2} /></span>
                        <span className={s.groupName}>{cat}</span>
                        <span className={s.groupCount}>{openInGroup}/{items.length}</span>
                      </div>
                      {items.map((i) => {
                        const animating = !!checking[i.id]
                        const done = i.checked || animating
                        const by = fresh[i.id]
                        const adder = by && by !== 'hub' ? who(by) : null
                        const assignee = i.assignee ? who(i.assignee) : null
                        return (
                          <div
                            key={i.id}
                            className={[s.item, animating && s.itemChecking, i.checked && s.itemChecked, by && s.itemFresh].filter(Boolean).join(' ')}
                          >
                            <button
                              type="button"
                              className={s.checkBtn}
                              aria-pressed={done}
                              aria-label={done ? `Uncheck ${i.text}` : `Check off ${i.text}`}
                              onClick={() => toggle(i)}
                            >
                              <span className={s.check}>{done && <Icon name="tick" size={24} stroke={3.2} />}</span>
                            </button>
                            <span className={s.itemText}>{i.text}<span className={s.strike} aria-hidden="true" /></span>
                            {adder && !i.checked && <span {...memberColorProps(adder.color)} className={s.newBadge}>New · {adder.name}</span>}
                            {i.qty && <span className={s.qty}>{i.qty}</span>}
                            {assignee && (
                              <span {...memberColorProps(assignee.color)} className={s.assignee}>
                                <MemberBlobAvatar memberId={assignee.id} size={28} showBackground={false} decorative />
                              </span>
                            )}
                            <button
                              type="button"
                              className={s.remove}
                              aria-label={`Remove ${i.text}`}
                              onClick={() => removeItem(active.id, i.id)}
                            >
                              <Icon name="close" size={22} stroke={2.6} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              {!active.items.length && (
                <div className={s.allGot}>
                  <span className={s.allGotTitle}>Nothing here yet</span>
                  <span className={s.allGotText}>Add the next thing above, or tap a usual chip.</span>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className={s.main}>
            <div className={s.allGot}>
              <span className={s.allGotTitle}>No lists yet</span>
              <span className={s.allGotText}>Start one for groceries, Costco, or gift ideas.</span>
              <Button size="lg" onClick={openCreate}>New list</Button>
            </div>
          </section>
        )}

        <div className={s.right}>
          <section className={s.meals} aria-label="From this week’s meals">
            <Label>From this week’s meals</Label>
            <div className={s.dinners}>
              {dinners.map((d) => (
                <span key={`${d.day}-${d.recipe.id}`} data-color={d.recipe.color} className={s.dinner}>
                  <span className={s.dinnerDay}>{shortDay(d.day)}</span>{d.recipe.title}
                </span>
              ))}
              {!dinners.length && <span className={s.emptyHint}>No dinners planned this week yet.</span>}
            </div>
            <button
              type="button"
              className={mealsAdded ? `${s.mealsBtn} ${s.mealsDone}` : s.mealsBtn}
              disabled={!dinners.length || addIngredients.isPending}
              onClick={() => void addMeals()}
            >
              <span className={mealsAdded ? s.iconWiggle : undefined}><Icon name="bag" size={22} stroke={3} /></span>
              {mealsAdded
                ? `Added ${ingredients.length || ''} ingredients`.trim()
                : addIngredients.isPending
                  ? 'Adding ingredients…'
                  : `Add ${ingredients.length || ''} ingredients to Groceries`}
            </button>
          </section>
        </div>
      </div>

      {keyboard === 'item' && (
        <SoftKeyboard
          value={draft}
          onChange={setDraft}
          onDone={() => { if (draft.trim()) addTyped(); else setKeyboard(null) }}
        />
      )}

      {keyboard === 'list' && creating && (
        <SoftKeyboard
          value={newName}
          onChange={setNewName}
          onDone={() => { if (newName.trim()) void submitCreate(); else setKeyboard(null) }}
        />
      )}

      {creating && (
        <div className={s.confirmScrim} onClick={() => { if (!creatingBusy) { setCreating(false); setKeyboard(null) } }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-list-title"
            className={s.confirm}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.confirmText}>
              <h2 id="new-list-title" className={s.confirmTitle}>New list</h2>
              <p className={s.confirmDetail}>Name it, pick a color, and start adding things.</p>
            </div>
            <label className={s.addField}>
              <Icon name="list" size={24} stroke={2.6} />
              <span className="sr-only">List name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onFocus={() => setKeyboard('list')}
                placeholder="Costco, gifts…"
                autoComplete="off"
                inputMode="none"
              />
            </label>
            <div className={s.pickerRow} role="group" aria-label="List icon">
              {LIST_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  data-color={newColor}
                  aria-pressed={newIcon === icon}
                  aria-label={icon}
                  className={newIcon === icon ? `${s.pickerIcon} ${s.pickerOn}` : s.pickerIcon}
                  onClick={() => setNewIcon(icon)}
                >
                  <Icon name={icon} size={28} stroke={2.2} />
                </button>
              ))}
            </div>
            <div className={s.pickerRow} role="group" aria-label="List color">
              {LIST_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  data-color={color}
                  aria-pressed={newColor === color}
                  aria-label={color}
                  className={newColor === color ? `${s.pickerSwatch} ${s.pickerOn}` : s.pickerSwatch}
                  onClick={() => setNewColor(color)}
                >
                  <span />
                </button>
              ))}
            </div>
            <div className={s.confirmActions}>
              <Button variant="secondary" size="lg" block disabled={creatingBusy} onClick={() => { setCreating(false); setKeyboard(null) }}>Cancel</Button>
              <Button variant="primary" size="lg" block disabled={!newName.trim() || creatingBusy} onClick={() => void submitCreate()}>
                {creatingBusy ? 'Creating…' : 'Create list'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmClear && active && (
        <div className={s.confirmScrim} onClick={() => setConfirmClear(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-list-title"
            className={s.confirm}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.confirmText}>
              <h2 id="clear-list-title" className={s.confirmTitle}>Clear {active.name}?</h2>
              <p className={s.confirmDetail}>
                This removes all {active.items.length} {active.items.length === 1 ? 'item' : 'items'}. You can’t undo it.
              </p>
            </div>
            <div className={s.confirmActions}>
              <Button variant="secondary" size="lg" block onClick={() => setConfirmClear(false)}>Keep items</Button>
              <Button variant="primary" size="lg" block onClick={confirmClearAll}>Clear list</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && active && canDeleteActive && (
        <div className={s.confirmScrim} onClick={() => !deleting && setConfirmDelete(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-list-title"
            className={s.confirm}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.confirmText}>
              <h2 id="delete-list-title" className={s.confirmTitle}>Delete {active.name}?</h2>
              <p className={s.confirmDetail}>
                {active.items.length
                  ? `This removes the list and all ${active.items.length} ${active.items.length === 1 ? 'item' : 'items'} on it. Groceries stays.`
                  : 'This removes the list. Groceries stays.'}
              </p>
            </div>
            <div className={s.confirmActions}>
              <Button variant="secondary" size="lg" block disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Keep {active.name}
              </Button>
              <Button variant="primary" size="lg" block icon="trash" disabled={deleting} onClick={() => void confirmDeleteList()}>
                {deleting ? 'Removing…' : 'Delete forever'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showQr && active && (
        <div
          className={s.qrScrim}
          role="dialog"
          aria-modal="true"
          aria-label={`Open ${active.name} on your phone`}
          onClick={() => setShowQr(false)}
        >
          <div className={s.qrCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.qrHead}>
              <span className={s.qrTitle}>Open {active.name} on your phone</span>
              <IconButton variant="secondary" icon="close" label="Close" onClick={() => setShowQr(false)} />
            </div>
            {qrSrc ? (
              <>
                <img className={s.qrImg} src={qrSrc} alt="" width={360} height={360} />
                <p className={s.qrHint}>Scan to check items off and add things. Changes show up here live.</p>
              </>
            ) : (
              <p className={s.qrHint}>Making a link…</p>
            )}
          </div>
        </div>
      )}

      {toast && <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
    </AppShell>
  )
}
