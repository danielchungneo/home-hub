import { useEffect, useRef, useState } from 'react'
import { useNav } from '../../app/nav'
import { Button, IconButton } from '../../components/Button'
import { FoodPhoto } from '../../components/FoodPhoto'
import { MEAL_SLOTS } from '../../lib/mealSlots'
import type { MealPlanRow } from '../../data/mappers'
import { shortDay } from '../../lib/format'
import { amount, timeLabel } from '../../lib/recipes'
import type { Recipe } from '../../lib/types'
import s from './PulledCard.module.css'

export interface Pull {
  id: string
  /** Where the card sat in the box, in viewport px. */
  from: DOMRect
}

/**
 * The pulled-out recipe card.
 * Open:  start (sits on the box card) → lift (rises out of the box) → center (flies to the middle) → open (flips to the recipe side)
 * Close: center (flips back) → return (drops back into its slot) → onClosed
 */
type Phase = 'start' | 'lift' | 'center' | 'open' | 'return'
const OPEN: [Phase, number][] = [['lift', 30], ['center', 340], ['open', 900]]
const CLOSE: [Phase | null, number][] = [['center', 0], ['return', 560], [null, 1000]]
const W = 1040, H = 700

export function PulledCard({
  pull,
  recipe: r,
  planRows,
  weekDates,
  onToggleFavorite,
  onAddToPlan,
  onDelete,
  deleting = false,
  pinProtectsDelete = false,
  onClosed,
}: {
  pull: Pull
  recipe: Recipe
  planRows: MealPlanRow[]
  weekDates: string[]
  onToggleFavorite: (r: Recipe) => void
  onAddToPlan: (r: Recipe) => void
  onDelete: (r: Recipe) => void
  deleting?: boolean
  pinProtectsDelete?: boolean
  onClosed: () => void
}) {
  const { cook, requirePin } = useNav()
  const [phase, setPhase] = useState<Phase>('start')
  const [serv, setServ] = useState(r.servings)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timers = useRef<number[]>([])
  const stage = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState<{ dx: number; dy: number; k: number } | null>(null)

  const schedule = (steps: [Phase | null, number][]) => {
    timers.current.forEach(window.clearTimeout)
    timers.current = steps.map(([p, ms]) => window.setTimeout(() => (p ? setPhase(p) : onClosed()), ms))
  }

  // FLIP: measure the centred stage once, then express the box card's rect as a transform of it.
  useEffect(() => {
    const t = stage.current!.getBoundingClientRect()
    const f = pull.from
    setOrigin({ dx: f.left + f.width / 2 - (t.left + W / 2), dy: f.top + f.height / 2 - (t.top + H / 2), k: f.width / W })
    schedule(OPEN)
    return () => timers.current.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    if (deleting) return
    setConfirmDelete(false)
    schedule(CLOSE)
  }
  const o = origin ?? { dx: 0, dy: 0, k: 0.33 }
  const wrap =
    phase === 'start' || phase === 'return' ? `translate(${o.dx}px, ${o.dy}px) scale(${o.k})`
      : phase === 'lift' ? `translate(${o.dx}px, ${o.dy - 170}px) scale(${o.k * 1.06})`
        : 'translate(0, 0) scale(1) rotate(-1deg)'
  const scale = serv / r.servings
  const flipped = phase === 'open'

  const planned = MEAL_SLOTS.flatMap((slot) =>
    planRows
      .filter((row) => row.slot === slot.id && row.recipeId === r.id)
      .map((row) => {
        const day = weekDates.indexOf(row.date)
        return `${shortDay(day >= 0 ? day : 0)} ${slot.label.toLowerCase()}`
      }),
  )

  const askDelete = () => {
    const proceed = () => setConfirmDelete(true)
    if (pinProtectsDelete) {
      requirePin({
        title: `To remove ${r.title}`,
        detail: planned.length
          ? 'This deletes the recipe and clears it from the meal plan.'
          : 'This permanently deletes the recipe from the box.',
        onSuccess: proceed,
      })
      return
    }
    proceed()
  }

  return (
    <div className={s.layer} data-phase={phase} data-course={r.course}>
      <div className={s.scrim} onClick={close} />
      <div ref={stage} className={s.stage}>
        <div className={s.wrap} style={{ transform: wrap, visibility: origin ? 'visible' : 'hidden' }}>
          <div className={s.flipper} style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}>

            <div className={s.front} aria-hidden="true">
              <span className={s.frontBand} />
              <div className={s.frontBody}>
                <FoodPhoto photo={r.photo} className={s.frontPhoto} />
                <div className={s.frontText}>
                  <span className={s.kicker}>{r.course} · {timeLabel(r.prepMin + r.cookMin)}</span>
                  <span className={s.frontTitle}>{r.title}</span>
                </div>
              </div>
            </div>

            <div className={s.back} role="dialog" aria-modal="true" aria-label={`${r.title} recipe card`} aria-hidden={!flipped}>
              <span className={s.backBand} />
              <div className={s.head}>
                <FoodPhoto photo={r.photo} className={s.thumb} />
                <div className={s.headText}>
                  <span className={s.kickerSm}>{r.course} · prep {timeLabel(r.prepMin)} · cook {timeLabel(r.cookMin)}</span>
                  <span className={s.title}>{r.title}</span>
                  {r.from && <span className={s.from}>{r.from}</span>}
                </div>
                <IconButton
                  variant="secondary"
                  size="lg"
                  round
                  className={r.favorite ? s.favOn : undefined}
                  icon={r.favorite ? 'heart-solid' : 'heart'}
                  label={r.favorite ? `Remove ${r.title} from favorites` : `Save ${r.title} to favorites`}
                  aria-pressed={!!r.favorite}
                  disabled={deleting || confirmDelete}
                  onClick={() => onToggleFavorite(r)}
                />
                {r.favorite && <span className={s.stamp}>Family favorite</span>}
                <IconButton
                  variant="secondary"
                  size="lg"
                  round
                  icon="trash"
                  label={pinProtectsDelete ? `Remove ${r.title} (needs PIN)` : `Remove ${r.title}`}
                  disabled={deleting}
                  onClick={askDelete}
                />
                <IconButton variant="secondary" size="lg" icon="close" label="Put the card back" disabled={deleting} onClick={close} />
              </div>

              <div className={s.ruled}>
                <div className={s.ingredients}>
                  <div className={s.colHead}>
                    <span className={s.colLabel}>Ingredients</span>
                    <span className={s.stepper}>
                      <IconButton variant="surface" icon="minus" label="Fewer servings" onClick={() => setServ(Math.max(1, serv - 1))} />
                      <span className={s.serv} aria-live="polite">Serves {serv}</span>
                      <IconButton variant="surface" icon="plus" label="More servings" onClick={() => setServ(Math.min(24, serv + 1))} />
                    </span>
                  </div>
                  <div className="scroll-y">
                    {r.ingredients.map((i) => (
                      <div key={i.name} className={s.ing}>
                        <span className={s.amt}>{amount(i.qty * scale, i.unit)}</span>
                        <span className={s.ingName}>{i.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={s.steps}>
                  <div className={s.colHead}><span className={s.colLabel}>Steps</span></div>
                  <ol className="scroll-y">
                    {r.steps.map((st, n) => (
                      <li key={n} className={s.step}>
                        <span className={s.stepNum}>{n + 1}</span>
                        <span className={s.stepText}>{st.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className={s.foot}>
                {confirmDelete ? (
                  <>
                    <span className={s.planLine}>
                      {planned.length
                        ? `Remove “${r.title}” and clear it from ${planned.length === 1 ? '1 meal plan slot' : `${planned.length} meal plan slots`}?`
                        : `Remove “${r.title}” from the recipe box forever?`}
                    </span>
                    <Button variant="secondary" size="lg" pill disabled={deleting} onClick={() => setConfirmDelete(false)}>
                      Keep recipe
                    </Button>
                    <Button size="lg" pill icon="trash" disabled={deleting} onClick={() => onDelete(r)}>
                      {deleting ? 'Removing…' : 'Remove forever'}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={s.planLine}>{planned.length ? `On the meal plan: ${planned.join(', ')}` : 'Not on this week’s meal plan yet'}</span>
                    <Button variant="secondary" size="lg" pill onClick={() => onAddToPlan(r)}>Add to meal plan</Button>
                    <Button size="lg" pill icon="play" onClick={() => { onClosed(); cook(r.id) }}>Start cooking</Button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
