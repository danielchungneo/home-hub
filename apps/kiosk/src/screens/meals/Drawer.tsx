import { useEffect, useState } from 'react'
import { IconButton } from '../../components/Button'
import { FoodPhoto } from '../../components/FoodPhoto'
import { Icon } from '../../components/Icon'
import { SoftKeyboard } from '../../components/SoftKeyboard'
import { MEAL_SLOTS } from '../../lib/mealSlots'
import { shortDay } from '../../lib/format'
import { isQuick, matches, timeLabel, totalMin } from '../../lib/recipes'
import type { MealEntry, MealSlot } from '@hub/shared'
import type { Recipe } from '../../lib/types'
import type { SlotRef } from './Meals'
import s from './Drawer.module.css'

export interface Picked { slot: MealSlot; entry: MealEntry; recipe?: Recipe; label: string }

type Filter = 'All' | 'Breakfast' | 'Dinner' | 'Sweets' | 'Quick'
const FILTERS: Filter[] = ['All', 'Breakfast', 'Dinner', 'Sweets', 'Quick']
/** Which filter the drawer opens on for each meal row. */
const DEFAULT_FILTER: Record<MealSlot, Filter> = { breakfast: 'Breakfast', lunch: 'All', dinner: 'Dinner', snack: 'Sweets' }
const QUICK_NOTES = ['Leftovers', 'Eat out']
const NOTE_TILTS = [-2, 1.5]
export const WRITE_IN_MAX = 40

/**
 * Bottom drawer for filling one slot: quick notes, a write-in sticky, then recipe cards
 * with search + filters. Stays mounted so it can slide in and out.
 */
export function Drawer({ picking, hidden, filled, recipes, onPick, onClear, onClose }: {
  picking: SlotRef | null
  hidden: boolean
  filled: boolean
  recipes: Recipe[]
  onPick: (p: Picked, from: DOMRect) => void
  onClear: () => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [keyboard, setKeyboard] = useState<'search' | 'write' | null>(null)

  // Reset every time a new slot is opened.
  const slotKey = picking ? `${picking.slot}:${picking.day}` : null
  useEffect(() => {
    if (!picking) return
    setFilter(DEFAULT_FILTER[picking.slot]); setQuery(''); setWriting(false); setText(''); setKeyboard(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey])

  const slot = picking?.slot ?? 'dinner'
  const row = MEAL_SLOTS.find((m) => m.id === slot)!
  const list = recipes.filter((r) => (filter === 'All' || (filter === 'Quick' ? isQuick(r) : r.course === filter)) && matches(r, query))

  const pickNote = (label: string, el: HTMLElement) => onPick({ slot, entry: { text: label }, label }, el.getBoundingClientRect())
  const saveWriteIn = (el: HTMLElement | null) => {
    const t = text.trim()
    if (!t || !el) return
    setWriting(false)
    setKeyboard(null)
    pickNote(t, el)
  }

  return <>
    <div className={s.scrim} data-open={!hidden} onClick={onClose} />
    <section aria-label="Pick a meal" aria-hidden={hidden} className={s.drawer} data-open={!hidden} data-slot={slot}
      {...(hidden ? { inert: '' } : {})}>
      <span className={s.handle} aria-hidden="true" />
      <div className={s.top}>
        <div className={s.heading}>
          <span className={s.kicker}>{picking ? `${shortDay(picking.day)} · ${row.label}` : ''}</span>
          <span className={s.title}>Pick a recipe</span>
        </div>
        <label className={s.search}>
          <Icon name="search" size={22} />
          <span className="sr-only">Search recipes</span>
          <input
            type="search"
            value={query}
            inputMode="none"
            onFocus={() => setKeyboard('search')}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes"
          />
        </label>
        <div role="group" aria-label="Filter recipes" className={s.filters}>
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={f === filter} className={s.filter} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        {filled && <button type="button" className={s.clear} onClick={onClear}>Clear slot</button>}
        <IconButton variant="secondary" icon="close" label="Close" onClick={onClose} />
      </div>

      <div className={`${s.strip} scroll-x`}>
        {QUICK_NOTES.map((label, i) => (
          <button key={label} type="button" className={s.note} style={{ ['--tilt' as string]: `${NOTE_TILTS[i]}deg` }}
            onClick={(e) => pickNote(label, e.currentTarget)}>{label}</button>
        ))}

        {/* Write-in: anything that isn't a recipe ("Pizza night", "Grandma's"). */}
        <div className={s.writeIn}>
          {!writing ? (
            <button type="button" className={s.writeStart} onClick={() => { setWriting(true); setText(''); setKeyboard('write') }}>
              <Icon name="pencil" size={26} />
              <span className={s.writeLabel}>Write your own…</span>
              <span className={s.writeHint}>Pizza night, Grandma’s, picnic</span>
            </button>
          ) : (
            <form className={s.writeForm} onSubmit={(e) => { e.preventDefault(); saveWriteIn(e.currentTarget.parentElement) }}>
              <label className={s.writeKicker} htmlFor="write-in">Write it in</label>
              <textarea
                id="write-in"
                autoFocus
                value={text}
                maxLength={WRITE_IN_MAX}
                placeholder="e.g. Pizza night"
                inputMode="none"
                onFocus={() => setKeyboard('write')}
                onChange={(e) => setText(e.target.value.replace(/\n/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
              />
              <div className={s.writeActions}>
                <button type="button" className={s.writeCancel} onClick={() => { setWriting(false); setKeyboard(null) }}>Cancel</button>
                <button type="submit" className={s.writeAdd} disabled={!text.trim()}>Add</button>
              </div>
            </form>
          )}
        </div>

        <span className={s.sep} aria-hidden="true" />

        {list.map((r) => (
          <button key={r.id} type="button" data-course={r.course} className={s.card} aria-label={`Put ${r.title} on the plan`}
            onClick={(e) => onPick({ slot, entry: { recipeId: r.id }, recipe: r, label: r.title }, e.currentTarget.getBoundingClientRect())}>
            <span className={s.band} />
            <FoodPhoto photo={r.photo} className={s.photo} />
            <span className={s.cardBody}>
              <span className={s.cardTitle}>{r.title}</span>
              <span className={s.cardMeta}>{r.course} · {timeLabel(totalMin(r))}</span>
            </span>
          </button>
        ))}
        {!list.length && <span className={s.none}>No recipes match{query ? ` “${query}”` : ''}.</span>}
      </div>
    </section>
    {!hidden && keyboard === 'search' && (
      <SoftKeyboard value={query} onChange={setQuery} onDone={() => setKeyboard(null)} />
    )}
    {!hidden && keyboard === 'write' && (
      <SoftKeyboard
        value={text}
        onChange={(next) => setText(next.slice(0, WRITE_IN_MAX).replace(/\n/g, ''))}
        onDone={() => setKeyboard(null)}
      />
    )}
  </>
}
