import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { SYSTEM_COLOR, type MealEntry, type MealSlot, type Member } from '@hub/shared'
import { useNav } from '../../app/nav'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { FoodPhoto } from '../../components/FoodPhoto'
import { Icon } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { HeroBand, Label, PersonPill, PersonRail, Rail } from '../../components/primitives'
import {
  useAddWeekIngredients,
  useCreateMealCalendar,
  useMealCalendars,
  useMealPlan,
  useMembers,
  useRecipes,
  useUpsertMealPlan,
  type MealCalendarRow,
  type MealPlanRow,
} from '../../data/hooks'
import { useLive } from '../../data/live'
import { localDate } from '../../data/mappers'
import { memberColorProps } from '../../lib/colors'
import { MEAL_SLOTS } from '../../lib/mealSlots'
import { FAMILY } from '../../lib/members'
import { useClock } from '../../hooks/useClock'
import { addDays, monthDay, shortDay, startOfWeek, time, weekday } from '../../lib/format'
import { entryRecipe, entryText, timeLabel, totalMin } from '../../lib/recipes'
import type { Recipe } from '../../lib/types'
import { Drawer, type Picked } from './Drawer'
import s from './Meals.module.css'

type Plan = Record<MealSlot, MealEntry[]>
export interface SlotRef { slot: MealSlot; day: number }

type Ghost = {
  calendarId: string
  ownerId: string | null
  ownerName: string
  ownerColor: string
  entry: MealEntry
}

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
  rows: MealPlanRow[],
  weekDates: string[],
  calendarId: string,
): Plan {
  const plan = emptyPlan()
  for (const row of rows) {
    if (row.calendarId !== calendarId) continue
    const day = weekDates.indexOf(row.date)
    if (day < 0) continue
    if (row.recipeId) plan[row.slot][day] = { recipeId: row.recipeId }
    else if (row.title) plan[row.slot][day] = { text: row.title }
  }
  return plan
}

function ghostsFromRows(
  rows: MealPlanRow[],
  weekDates: string[],
  activeCalendarId: string,
  calendars: MealCalendarRow[],
  members: Member[],
): Record<string, Ghost> {
  const byId = new Map(calendars.map((c) => [c.id, c]))
  const out: Record<string, Ghost> = {}
  for (const row of rows) {
    if (row.calendarId === activeCalendarId) continue
    const day = weekDates.indexOf(row.date)
    if (day < 0) continue
    const cal = byId.get(row.calendarId)
    if (!cal) continue
    const member = cal.memberId ? members.find((m) => m.id === cal.memberId) : null
    const entry: MealEntry = row.recipeId
      ? { recipeId: row.recipeId }
      : row.title
        ? { text: row.title }
        : null
    if (!entry) continue
    out[`${row.slot}:${day}`] = {
      calendarId: row.calendarId,
      ownerId: cal.memberId,
      ownerName: member?.name ?? FAMILY.name,
      ownerColor: member?.color ?? SYSTEM_COLOR,
      entry,
    }
  }
  return out
}

export default function Meals() {
  const now = useClock()
  const { go, cook } = useNav()
  const today = now.getDay()
  const [weekOffset, setWeekOffset] = useState(0)
  // Keyed on the date, not the minute clock, so the board isn't rebuilt every minute.
  const todayKey = localDate(now)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekStart = useMemo(() => addDays(startOfWeek(now), weekOffset * 7), [todayKey, weekOffset])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => localDate(addDays(weekStart, i))), [weekStart])
  const from = weekDates[0]!
  const to = weekDates[6]!

  const { data: recipes = [] } = useRecipes()
  const { data: members = [] } = useMembers()
  const { data: calendars = [] } = useMealCalendars()
  const { data: planRows = [] } = useMealPlan(from, to)
  const upsertMeal = useUpsertMealPlan()
  const createCalendar = useCreateMealCalendar()
  const addIngredients = useAddWeekIngredients()
  useLive('recipes', 'recipes')
  useLive('meal_plan', 'mealPlan')
  useLive('meal_calendars', 'mealCalendars')
  useLive('members', 'members')

  const familyCalendar = useMemo(
    () => calendars.find((c) => c.memberId == null) ?? null,
    [calendars],
  )
  const memberCalendars = useMemo(
    () => calendars.filter((c) => c.memberId != null),
    [calendars],
  )
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null)
  const activeCalendar = useMemo(() => {
    if (activeCalendarId) {
      const hit = calendars.find((c) => c.id === activeCalendarId)
      if (hit) return hit
    }
    return familyCalendar
  }, [activeCalendarId, calendars, familyCalendar])

  useEffect(() => {
    if (!activeCalendarId && familyCalendar) setActiveCalendarId(familyCalendar.id)
  }, [activeCalendarId, familyCalendar])

  const remotePlan = useMemo(
    () => (activeCalendar ? planFromRows(planRows, weekDates, activeCalendar.id) : emptyPlan()),
    [planRows, weekDates, activeCalendar],
  )
  const ghosts = useMemo(
    () => (activeCalendar
      ? ghostsFromRows(planRows, weekDates, activeCalendar.id, calendars, members)
      : {}),
    [planRows, weekDates, activeCalendar, calendars, members],
  )
  const familyDinnerPlan = useMemo(
    () => (familyCalendar ? planFromRows(planRows, weekDates, familyCalendar.id) : emptyPlan()),
    [planRows, weekDates, familyCalendar],
  )

  const [plan, setPlan] = useState<Plan>(remotePlan)
  const [picking, setPicking] = useState<SlotRef | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [landed, setLanded] = useState<string | null>(null)
  const [addedCount, setAddedCount] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [addingPlan, setAddingPlan] = useState(false)
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

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members])
  const availableForPlan = useMemo(() => {
    const taken = new Set(memberCalendars.map((c) => c.memberId))
    return activeMembers.filter((m) => !taken.has(m.id))
  }, [activeMembers, memberCalendars])

  const activeListName = activeCalendar?.listName ?? 'Groceries'
  const activeEntries = useMemo(
    () => (activeCalendar ? planRows.filter((r) => r.calendarId === activeCalendar.id) : []),
    [planRows, activeCalendar],
  )

  /** Drawer → board: fly a copy of the picked card onto the slot, then drop the real one in. */
  const place = (picked: Picked, fromRect: DOMRect) => {
    if (!picking || !activeCalendar) return
    const key = `${picking.slot}:${picking.day}`
    if (ghosts[key]) return
    const toRect = cells.current.get(key)!.getBoundingClientRect()
    const target = picking
    const date = weekDates[target.day]!
    const calendarId = activeCalendar.id
    setFlight({ picked, from: fromRect, to: toRect, go: false })
    later(30, () => setFlight((f) => f && { ...f, go: true }))
    later(640, () => {
      setPlan((p) => { const n = clone(p); n[target.slot][target.day] = picked.entry; return n })
      setFlight(null)
      setPicking(null)
      setLanded(key)
      if (picked.entry && 'recipeId' in picked.entry) {
        void upsertMeal.mutateAsync({
          calendarId,
          date,
          slot: target.slot,
          recipeId: picked.entry.recipeId,
          title: null,
        }).catch((err) => setToast(err instanceof Error ? err.message : 'Couldn’t save that meal'))
      } else if (picked.entry && 'text' in picked.entry) {
        void upsertMeal.mutateAsync({
          calendarId,
          date,
          slot: target.slot,
          recipeId: null,
          title: picked.entry.text,
        }).catch((err) => setToast(err instanceof Error ? err.message : 'Couldn’t save that meal'))
      }
    })
    later(1000, () => setLanded(null))
  }

  const clearSlot = () => {
    if (!picking || !activeCalendar) return
    const key = `${picking.slot}:${picking.day}`
    if (ghosts[key]) return
    const date = weekDates[picking.day]!
    setPlan((p) => { const n = clone(p); n[picking.slot][picking.day] = null; return n })
    void upsertMeal.mutateAsync({ calendarId: activeCalendar.id, date, slot: picking.slot, clear: true })
    setPicking(null)
  }

  const pushGroceries = async () => {
    if (!activeCalendar || addedCount != null || addIngredients.isPending) return
    try {
      const result = await addIngredients.mutateAsync({
        entries: activeEntries,
        recipes,
        listId: activeCalendar.listId,
      })
      const changed = result.added + (result.updated ?? 0)
      setAddedCount(changed)
      const listLabel = result.listName || activeListName
      setToast(
        result.added && result.updated
          ? `Added ${result.added}, updated ${result.updated} on ${listLabel}`
          : result.added
            ? `Added ${result.added} ingredients to ${listLabel}`
            : result.updated
              ? `Updated ${result.updated} amounts on ${listLabel}`
              : `${listLabel} already up to date`,
      )
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Couldn’t add ingredients')
    }
  }

  const addMemberPlan = async (member: Member) => {
    if (createCalendar.isPending) return
    try {
      const created = await createCalendar.mutateAsync({
        memberId: member.id,
        memberName: member.name,
        memberColor: member.color,
      })
      setActiveCalendarId(created.id)
      setAddingPlan(false)
      setAddedCount(null)
      setToast(`${member.name}’s meal plan ready`)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Couldn’t add that meal plan')
    }
  }

  const switchCalendar = (id: string) => {
    setActiveCalendarId(id)
    setPicking(null)
    setAddedCount(null)
  }

  const tonightEntry = familyDinnerPlan.dinner[today]
  const tonight = entryRecipe(recipes, tonightEntry)
  const startBy = tonight ? new Date(new Date(now).setHours(DINNER_AT, 0, 0, 0) - totalMin(tonight) * 60_000) : null
  const planLabel = activeCalendar?.memberId
    ? (members.find((m) => m.id === activeCalendar.memberId)?.name ?? 'Personal')
    : 'Family'

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
              disabled={!activeCalendar || addIngredients.isPending}
              onClick={() => void pushGroceries()}
            >
              <span className={`${s.cartIcon}${addedCount != null ? ' anim-wiggle' : ''}`}><Icon name="cart" size={24} /></span>
              {addIngredients.isPending
                ? 'Adding ingredients…'
                : addedCount != null
                  ? 'Ingredients added'
                  : 'Add this week’s ingredients'}
            </Button>
            {addedCount != null && addedCount > 0 && (
              <span className={s.cartChip} aria-hidden="true">+{addedCount} to {activeListName}</span>
            )}
          </span>
        </>}
      />

      {/* ---------- Tonight (always Family dinner) ---------- */}
      <HeroBand
        xl
        surface
        aria-label="Tonight"
        className={s.tonight}
        data-course="Dinner"
        leading={
          <span className={s.pot} aria-hidden="true">
            <span className={s.steam}><i /><i /><i /></span>
            <Icon name={tonight?.icon ?? 'dish'} size={92} stroke={2.2} />
          </span>
        }
        main={
          <>
            <Label member>Tonight · {weekday(now)}</Label>
            <span className={s.tonightTitle}>{tonight?.title ?? entryText(tonightEntry) ?? 'Nothing planned yet'}</span>
            {tonight && startBy && (
              <span className={s.tonightChips}>
                <span className={s.chip}>{timeLabel(totalMin(tonight))}</span>
                <span className={`${s.chip} ${s.chipTint}`}>Start by {time(startBy)} to eat at 6:00</span>
              </span>
            )}
          </>
        }
        trailing={
          <>
            <Button
              variant="secondary"
              size="lg"
              pill
              onClick={() => {
                if (familyCalendar) switchCalendar(familyCalendar.id)
                setPicking({ slot: 'dinner', day: today })
              }}
            >
              {tonightEntry ? 'Swap' : 'Plan dinner'}
            </Button>
            {tonight && <>
              <Button variant="secondary" size="lg" pill onClick={() => go('recipes')}>Recipe card</Button>
              <Button size="lg" pill icon="play" onClick={() => cook(tonight.id)}>Start cooking</Button>
            </>}
          </>
        }
      />

      <div className={s.planBar}>
        <PersonRail label="Whose meal plan" className={s.planRail}>
          {familyCalendar && (
            <PersonPill
              colorProps={memberColorProps(SYSTEM_COLOR)}
              pressed={activeCalendar?.id === familyCalendar.id}
              onClick={() => switchCalendar(familyCalendar.id)}
              avatar={<span className={s.familyAvatar} aria-hidden="true"><Icon name="people" size={28} /></span>}
              name="Family"
              sub={familyCalendar.listName}
            />
          )}
          {memberCalendars.map((cal) => {
            const member = members.find((m) => m.id === cal.memberId)
            if (!member) return null
            return (
              <PersonPill
                key={cal.id}
                colorProps={memberColorProps(member.color)}
                pressed={activeCalendar?.id === cal.id}
                onClick={() => switchCalendar(cal.id)}
                avatar={<MemberBlobAvatar memberId={member.id} size={48} showBackground={false} decorative />}
                name={member.name}
                sub={cal.listName}
              />
            )
          })}
        </PersonRail>
        {availableForPlan.length > 0 && (
          <Button size="lg" pill variant="secondary" icon="plus" onClick={() => setAddingPlan(true)}>
            Add plan
          </Button>
        )}
      </div>

      {/* ---------- Fridge board ---------- */}
      <section aria-label={`${planLabel} meal plan`} className={s.board}>
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
              const ghost = ghosts[key]
              const recipe = entryRecipe(recipes, ghost ? ghost.entry : entry)
              const text = entryText(ghost ? ghost.entry : entry)
              const label = recipe?.title ?? text
              const isToday = day === today && weekOffset === 0
              const taken = !!ghost
              return (
                <div key={key} data-slot={slot.id} className={isToday ? `${s.cell} ${s.cellToday}` : s.cell}
                  style={{ ['--n' as string]: day * 4 + ri * 3 }}>
                  <button type="button"
                    ref={(el) => { if (el) cells.current.set(key, el); else cells.current.delete(key) }}
                    data-course={recipe?.course}
                    disabled={taken}
                    className={[
                      s.item,
                      recipe ? s.recipe : text ? s.note : s.empty,
                      taken && s.ghost,
                      landed === key && s.landed,
                    ].filter(Boolean).join(' ')}
                    style={label ? { ['--tilt' as string]: `${TILTS[(day + ri * 3) % TILTS.length]}deg` } : undefined}
                    {...(taken ? memberColorProps(ghost.ownerColor) : {})}
                    aria-label={
                      taken
                        ? `${shortDay(day)} ${slot.label}: ${label ?? 'meal'} on ${ghost.ownerName}’s plan`
                        : `${shortDay(day)} ${slot.label}: ${label ? `${label}. Tap to swap` : 'empty. Tap to add'}`
                    }
                    onClick={() => {
                      if (taken) return
                      setPicking({ slot: slot.id, day })
                    }}>
                    {taken && (
                      <span className={s.ghostOwner}>
                        {ghost.ownerId
                          ? <MemberBlobAvatar memberId={ghost.ownerId} size={28} showBackground={false} decorative />
                          : <Icon name="people" size={18} />}
                        <span>{ghost.ownerName}</span>
                      </span>
                    )}
                    {recipe && <BoardRecipe recipe={recipe} />}
                    {text && !recipe && <span className={s.noteText}>{text}</span>}
                    {!entry && !taken && <span className={s.add}><Icon name="plus" size={18} />Add</span>}
                  </button>
                </div>
              )
            })}
          </Fragment>
        ))}
      </section>

      <Drawer
        picking={picking}
        hidden={!picking || !!flight || !!(picking && ghosts[`${picking.slot}:${picking.day}`])}
        filled={!!(picking && plan[picking.slot][picking.day])}
        recipes={recipes}
        onPick={place}
        onClear={clearSlot}
        onClose={() => setPicking(null)}
      />

      {flight && <FlyingCard flight={flight} />}

      {addingPlan && (
        <div className={`${s.confirmScrim} anim-confirm-scrim`} onClick={() => !createCalendar.isPending && setAddingPlan(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-meal-plan-title"
            className={`${s.confirm} anim-confirm-rise`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.confirmText}>
              <h2 id="add-meal-plan-title" className={s.confirmTitle}>Add a meal plan</h2>
              <p className={s.confirmDetail}>
                Pick someone to get their own fridge board and grocery list. Family stays as it is.
              </p>
            </div>
            <div className={s.memberPick}>
              {availableForPlan.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={s.memberPickBtn}
                  disabled={createCalendar.isPending}
                  {...memberColorProps(m.color)}
                  onClick={() => void addMemberPlan(m)}
                >
                  <MemberBlobAvatar memberId={m.id} size={56} decorative />
                  <span className={s.memberPickName}>{m.name}</span>
                  <span className={s.memberPickSub}>{m.name}’s groceries</span>
                </button>
              ))}
            </div>
            <Button variant="secondary" size="lg" pill disabled={createCalendar.isPending} onClick={() => setAddingPlan(false)}>
              Not now
            </Button>
          </div>
        </div>
      )}

      {toast && <div role="status" className={`${s.toast} anim-toast`}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
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
