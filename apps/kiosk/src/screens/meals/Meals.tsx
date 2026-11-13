import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { MealEntry, MealSlot } from '@hub/shared'
import { useNav } from '../../app/nav'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { FoodPhoto } from '../../components/FoodPhoto'
import { Icon } from '../../components/Icon'
import { Rail } from '../../components/primitives'
import { useAddWeekIngredients, useMealPlan, useRecipes, useUpsertMealPlan } from '../../data/hooks'
import { useLive } from '../../data/live'
import { localDate } from '../../data/mappers'
import { MEAL_SLOTS } from '../../lib/mealSlots'
import { useClock } from '../../hooks/useClock'
import { addDays, monthDay, shortDay, startOfWeek, time, weekday } from '../../lib/format'
import { entryRecipe, entryText, timeLabel, totalMin } from '../../lib/recipes'
import type { Recipe } from '../../lib/types'
import { Drawer, type Picked } from './Drawer'
import s from './Meals.module.css'

type Plan = Record<MealSlot, MealEntry[]>
export interface SlotRef { slot: MealSlot; day: number }

/** Board tilts so the cards look stuck on by hand. */
const TILTS = [-1.5, 1, -0.5, 1.8, -1.2, 0.6, -0.8]
const DINNER_AT = 18 // eat at 6:00 PM

interface Flight { picked: Picked; from: DOMRect; to: DOMRect; go: boolean }

function emptyPlan(): Plan {
  return {
    breakfast: Array.from({ length: 7 }, () => null),
    lunch: Array.from({ length: 7 }, () => null),
    dinner: Array.from({ length: 7 }, () => null),
    snack: Array.from({ length: 7 }, () => null),
  }
}

function planFromRows(
  rows: { date: string; slot: MealSlot; recipeId: string | null; title: string | null }[],
  weekDates: string[],
): Plan {
  const plan = emptyPlan()
  for (const row of rows) {
    const day = weekDates.indexOf(row.date)
    if (day < 0) continue
    if (row.recipeId) plan[row.slot][day] = { recipeId: row.recipeId }
    else if (row.title) plan[row.slot][day] = { text: row.title }
  }
  return plan
}

export default function Meals() {
  const now = useClock()
  const { go, cook } = useNav()
  const today = now.getDay()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDays(startOfWeek(now), weekOffset * 7), [now, weekOffset])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => localDate(addDays(weekStart, i))), [weekStart])
  const from = weekDates[0]!
  const to = weekDates[6]!

  const { data: recipes = [] } = useRecipes()
  const { data: planRows = [] } = useMealPlan(from, to)
  const upsertMeal = useUpsertMealPlan()
  const addIngredients = useAddWeekIngredients()
  useLive('recipes', 'recipes')
  useLive('meal_plan', 'mealPlan')

  const remotePlan = useMemo(() => planFromRows(planRows, weekDates), [planRows, weekDates])
  const [plan, setPlan] = useState<Plan>(remotePlan)
  const [picking, setPicking] = useState<SlotRef | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [landed, setLanded] = useState<string | null>(null)
  const [addedCount, setAddedCount] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const cells = useRef(new Map<string, HTMLElement>())
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!flight) setPlan(remotePlan)
  }, [remotePlan, flight])

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }

  /** Drawer → board: fly a copy of the picked card onto the slot, then drop the real one in. */
  const place = (picked: Picked, fromRect: DOMRect) => {
    if (!picking) return
    const key = `${picking.slot}:${picking.day}`
    const toRect = cells.current.get(key)!.getBoundingClientRect()
    const target = picking
    const date = weekDates[target.day]!
    setFlight({ picked, from: fromRect, to: toRect, go: false })
    later(30, () => setFlight((f) => f && { ...f, go: true }))
    later(640, () => {
      setPlan((p) => { const n = clone(p); n[target.slot][target.day] = picked.entry; return n })
      setFlight(null)
      setPicking(null)
      setLanded(key)
      if (picked.entry && 'recipeId' in picked.entry) {
        void upsertMeal.mutateAsync({ date, slot: target.slot, recipeId: picked.entry.recipeId, title: null })
      } else if (picked.entry && 'text' in picked.entry) {
        void upsertMeal.mutateAsync({ date, slot: target.slot, recipeId: null, title: picked.entry.text })
      }
    })
    later(1000, () => setLanded(null))
  }

  const clearSlot = () => {
    if (!picking) return
    const date = weekDates[picking.day]!
    setPlan((p) => { const n = clone(p); n[picking.slot][picking.day] = null; return n })
    void upsertMeal.mutateAsync({ date, slot: picking.slot, clear: true })
    setPicking(null)
  }

  const pushGroceries = async () => {
    if (addedCount != null || addIngredients.isPending) return
    try {
      const result = await addIngredients.mutateAsync({ entries: planRows, recipes })
      const changed = result.added + (result.updated ?? 0)
      setAddedCount(changed)
      setToast(
        result.added && result.updated
          ? `Added ${result.added}, updated ${result.updated} on Groceries`
          : result.added
            ? `Added ${result.added} ingredients to Groceries`
            : result.updated
              ? `Updated ${result.updated} amounts on Groceries`
              : 'Groceries already up to date',
      )
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Couldn’t add ingredients')
    }
  }

  const tonightEntry = plan.dinner[today]
  const tonight = entryRecipe(recipes, tonightEntry)
  const startBy = tonight ? new Date(new Date(now).setHours(DINNER_AT, 0, 0, 0) - totalMin(tonight) * 60_000) : null

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Meals · week of ${monthDay(weekStart)}`}
        title="What’s for dinner"
        actions={<>
          <Rail label="Week">
            <IconButton variant="ghost" icon="chevron-left" label="Previous week" onClick={() => { setWeekOffset((w) => w - 1); setAddedCount(null) }} />
            <Button variant="surface" pill onClick={() => { setWeekOffset(0); setAddedCount(null) }}>
              {weekOffset === 0 ? 'This week' : monthDay(weekStart)}
            </Button>
            <IconButton variant="ghost" icon="chevron-right" label="Next week" onClick={() => { setWeekOffset((w) => w + 1); setAddedCount(null) }} />
          </Rail>
          <span className={s.cartWrap}>
            <Button
              size="lg"
              pill
              variant={addedCount != null ? 'secondary' : 'primary'}
              className={addedCount != null ? `${s.cart} ${s.cartDone}` : s.cart}
              disabled={addIngredients.isPending}
              onClick={() => void pushGroceries()}
            >
              <span className={s.cartIcon}><Icon name="cart" size={24} /></span>
              {addIngredients.isPending
                ? 'Adding ingredients…'
                : addedCount != null
                  ? 'Ingredients added'
                  : 'Add this week’s ingredients'}
            </Button>
            {addedCount != null && addedCount > 0 && (
              <span className={s.cartChip} aria-hidden="true">+{addedCount} to Groceries</span>
            )}
          </span>
        </>}
      />

      {/* ---------- Tonight ---------- */}
      <section aria-label="Tonight" className={s.tonight} data-course="Dinner">
        <span className={s.pot} aria-hidden="true">
          <span className={s.steam}><i /><i /><i /></span>
          <Icon name={tonight?.icon ?? 'dish'} size={92} stroke={2.2} />
        </span>
        <div className={s.tonightText}>
          <span className={s.kicker}>Tonight · {weekday(now)}</span>
          <span className={s.tonightTitle}>{tonight?.title ?? entryText(tonightEntry) ?? 'Nothing planned yet'}</span>
          {tonight && startBy && (
            <span className={s.tonightChips}>
              <span className={s.chip}>{timeLabel(totalMin(tonight))}</span>
              <span className={`${s.chip} ${s.chipTint}`}>Start by {time(startBy)} to eat at 6:00</span>
            </span>
          )}
        </div>
        <Button variant="secondary" size="lg" pill onClick={() => setPicking({ slot: 'dinner', day: today })}>
          {tonightEntry ? 'Swap' : 'Plan dinner'}
        </Button>
        {tonight && <>
          <Button variant="secondary" size="lg" pill onClick={() => go('recipes')}>Recipe card</Button>
          <Button size="lg" pill icon="play" onClick={() => cook(tonight.id)}>Start cooking</Button>
        </>}
      </section>

      {/* ---------- Fridge board ---------- */}
      <section aria-label="Meal plan" className={s.board}>
        <div />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={i === today && weekOffset === 0 ? `${s.day} ${s.dayToday}` : s.day}>
            <span className={s.dayName}>{shortDay(i)}</span>
            <span className={s.dayNum}>{addDays(weekStart, i).getDate()}</span>
          </div>
        ))}

        {MEAL_SLOTS.map((slot, ri) => (
          <Fragment key={slot.id}>
            <div className={s.rowHead}>
              <Icon name={slot.icon} size={28} />
              <span>{slot.label}</span>
            </div>
            {plan[slot.id].map((entry, day) => {
              const key = `${slot.id}:${day}`
              const recipe = entryRecipe(recipes, entry)
              const text = entryText(entry)
              const label = recipe?.title ?? text
              const isToday = day === today && weekOffset === 0
              return (
                <div key={key} data-slot={slot.id} className={isToday ? `${s.cell} ${s.cellToday}` : s.cell}
                  style={{ ['--n' as string]: day * 4 + ri * 3 }}>
                  <button type="button"
                    ref={(el) => { if (el) cells.current.set(key, el); else cells.current.delete(key) }}
                    data-course={recipe?.course}
                    className={[s.item, recipe ? s.recipe : text ? s.note : s.empty, landed === key && s.landed].filter(Boolean).join(' ')}
                    style={label ? { ['--tilt' as string]: `${TILTS[(day + ri * 3) % TILTS.length]}deg` } : undefined}
                    aria-label={`${shortDay(day)} ${slot.label}: ${label ? `${label}. Tap to swap` : 'empty. Tap to add'}`}
                    onClick={() => setPicking({ slot: slot.id, day })}>
                    {recipe && <BoardRecipe recipe={recipe} />}
                    {text && <span className={s.noteText}>{text}</span>}
                    {!entry && <span className={s.add}><Icon name="plus" size={18} />Add</span>}
                  </button>
                </div>
              )
            })}
          </Fragment>
        ))}
      </section>

      <Drawer
        picking={picking}
        hidden={!picking || !!flight}
        filled={!!(picking && plan[picking.slot][picking.day])}
        recipes={recipes}
        onPick={place}
        onClear={clearSlot}
        onClose={() => setPicking(null)}
      />

      {flight && <FlyingCard flight={flight} />}

      {toast && <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
    </AppShell>
  )
}

function BoardRecipe({ recipe: r }: { recipe: Recipe }) {
  return <>
    <span className={s.magnet} aria-hidden="true" />
    <span className={s.band} />
    <span className={s.recipeBody}>
      <FoodPhoto photo={r.photo} className={s.thumb} variant={1} />
      <span className={s.recipeText}>
        <span className={s.recipeTitle}>{r.title}</span>
        <span className={s.recipeTime}>{timeLabel(totalMin(r))}</span>
      </span>
    </span>
  </>
}

/**
 * A copy of the picked card, drawn at its drawer size and moved with transform only:
 * it travels to the slot's centre and shrinks to fit, then the real board card lands.
 */
function FlyingCard({ flight: { picked, from, to, go } }: { flight: Flight }) {
  const k = Math.min(to.width / from.width, to.height / from.height)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  return (
    <div aria-hidden="true" data-slot={picked.slot} data-course={picked.recipe?.course}
      className={picked.recipe ? `${s.fly} ${s.flyRecipe}` : `${s.fly} ${s.flyNote}`}
      style={{
        left: from.left, top: from.top, width: from.width, height: from.height,
        transform: go ? `translate(${dx}px, ${dy}px) scale(${k}) rotate(-1deg)` : 'none',
        opacity: go ? 0.9 : 1,
      }}>
      {picked.recipe ? <>
        <span className={s.band} />
        <FoodPhoto photo={picked.recipe.photo} className={s.flyPhoto} />
        <span className={s.flyTitle}>{picked.recipe.title}</span>
      </> : <span className={s.noteText}>{picked.label}</span>}
    </div>
  )
}

function clone(p: Plan): Plan {
  return { breakfast: [...p.breakfast], lunch: [...p.lunch], dinner: [...p.dinner], snack: [...p.snack] }
}
