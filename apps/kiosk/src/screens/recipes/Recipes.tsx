import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/Button'
import { FoodPhoto } from '../../components/FoodPhoto'
import { Icon } from '../../components/Icon'
import { SoftKeyboard } from '../../components/SoftKeyboard'
import { Panel, Rail } from '../../components/primitives'
import { useDeleteRecipe, useHousehold, useHouseholdSettings, useMealPlan, useRecipes, useUpdateRecipe } from '../../data/hooks'
import { useLive } from '../../data/live'
import { localDate } from '../../data/mappers'
import { useClock } from '../../hooks/useClock'
import { addDays, startOfWeek } from '../../lib/format'
import { COURSES, amount, entryRecipe, isQuick, matches, recipeById, timeLabel, totalMin } from '../../lib/recipes'
import type { Recipe } from '../../lib/types'
import { PulledCard, type Pull } from './PulledCard'
import s from './Recipes.module.css'

type FilterId = 'all' | 'Breakfast' | 'Dinner' | 'Sweets' | 'quick' | 'fav'
type ViewId = 'box' | 'grid'
const VIEW_KEY = 'hub.recipes.view'

const FILTERS: { id: FilterId; label: string; test: (r: Recipe) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'Breakfast', label: 'Breakfast', test: (r) => r.course === 'Breakfast' },
  { id: 'Dinner', label: 'Dinner', test: (r) => r.course === 'Dinner' },
  { id: 'Sweets', label: 'Sweets', test: (r) => r.course === 'Sweets' },
  { id: 'quick', label: 'Under 30 min', test: isQuick },
  { id: 'fav', label: 'Favorites', test: (r) => !!r.favorite },
]

// Box geometry (px). Cards overlap like index cards: 340 wide, one every 310.
const START_X = 40, DIVIDER_STEP = 90, CARD_W = 340, CARD_STEP = 310, GROUP_GAP = 40
const TILTS = [-1, 0.7, -0.4, 1.1, -0.8, 0.5]
const RESTS = [0, 8, 3, 12, 5]
const TAB_X = [24, 110, 64]

type Item =
  | { kind: 'divider'; key: string; x: number; course: Recipe['course']; count: number; tabX: number; n: number }
  | { kind: 'card'; key: string; x: number; recipe: Recipe; tilt: number; rest: number; n: number; i: number }

function ingestUrl(token: string) {
  // Supabase Functions/Storage force text/plain + CSP sandbox for HTML on *.supabase.co.
  // Host the phone UI on the existing smart-home Vercel app instead.
  const base = (import.meta.env.VITE_RECIPE_INGEST_URL as string | undefined)?.replace(/\/$/, '')
    || 'https://chung-smart-home.vercel.app/recipe'
  return `${base}/?token=${encodeURIComponent(token)}`
}

function readView(): ViewId {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'grid' ? 'grid' : 'box'
  } catch {
    return 'box'
  }
}

export default function Recipes() {
  const now = useClock()
  const { data: recipes = [], isLoading } = useRecipes()
  const { data: household } = useHousehold()
  const { data: settings } = useHouseholdSettings()
  const updateRecipe = useUpdateRecipe()
  const deleteRecipe = useDeleteRecipe()
  useLive('recipes', 'recipes')

  const weekStart = startOfWeek(now)
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => localDate(addDays(weekStart, i))), [weekStart])
  const from = weekDates[0]!
  const to = weekDates[6]!
  const { data: planRows = [] } = useMealPlan(from, to)
  useLive('meal_plan', 'mealPlan')

  const [view, setView] = useState<ViewId>(readView)
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')
  const [keyboard, setKeyboard] = useState(false)
  const [pull, setPull] = useState<(Pull & { recipe: Recipe }) | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const boxRef = useRef<HTMLElement>(null)

  const dinnerEntry = useMemo(() => {
    const date = localDate(now)
    const row = planRows.find((r) => r.date === date && r.slot === 'dinner')
    if (!row?.recipeId) return null
    return { recipeId: row.recipeId } as const
  }, [planRows, now])
  const tonight = entryRecipe(recipes, dinnerEntry)

  const test = FILTERS.find((f) => f.id === filter)!.test
  const visible = useMemo(
    () => recipes.filter((r) => test(r) && matches(r, query)),
    [recipes, test, query],
  )

  const { items, width, shown } = useMemo(() => {
    const out: Item[] = []
    let x = START_X, n = 0, shown = 0
    COURSES.forEach((course, gi) => {
      const cards = visible.filter((r) => r.course === course)
      if (!cards.length) return
      out.push({ kind: 'divider', key: `d-${course}`, x, course, count: cards.length, tabX: TAB_X[gi % 3], n: n++ })
      x += DIVIDER_STEP
      cards.forEach((recipe, i) => {
        out.push({ kind: 'card', key: recipe.id, x, recipe, tilt: TILTS[(i + gi) % 6], rest: RESTS[(i + gi) % 5], n: n++, i })
        x += CARD_STEP
        shown++
      })
      x += CARD_W - CARD_STEP + GROUP_GAP
    })
    return { items: out, width: x + 360, shown }
  }, [visible])

  const flash = useCallback((msg: string) => setToast(msg), [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const changeView = (next: ViewId) => {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* ignore */ }
  }

  const toggleFavorite = (recipe: Recipe) => {
    const next = !recipe.favorite
    updateRecipe.mutate(
      { id: recipe.id, favorite: next },
      {
        onSuccess: () => flash(next ? `Saved “${recipe.title}” to favorites` : `Removed “${recipe.title}” from favorites`),
        onError: (err) => flash(err instanceof Error ? err.message : 'Couldn’t update favorite'),
      },
    )
  }

  const removeRecipe = (recipe: Recipe) => {
    deleteRecipe.mutate(recipe.id, {
      onSuccess: () => {
        setPull(null)
        flash(`Removed “${recipe.title}” from the box`)
      },
      onError: (err) => flash(err instanceof Error ? err.message : 'Couldn’t remove that recipe'),
    })
  }

  /** Pull a card out: remember where it sits so the overlay can grow out of it (FLIP). */
  const open = (id: string, el?: HTMLElement | null) => {
    const recipe = recipeById(recipes, id)
    if (!recipe) return
    const fromEl = el ?? cardRefs.current.get(id) ?? null
    const fromRect = fromEl?.getBoundingClientRect() ?? fallbackRect(boxRef.current)
    setPull({ id, from: fromRect, recipe })
  }

  const addUrl = household?.import_token ? ingestUrl(household.import_token) : null
  const qrSrc = addUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(addUrl)}`
    : null

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${view === 'box' ? 'Recipe box' : 'Recipe grid'} · ${recipes.length} recipes`}
        title="Recipes"
        actions={<>
          {tonight && (
            <button type="button" className={s.tonight} onClick={() => open(tonight.id)}>
              <FoodPhoto photo={tonight.photo} className={s.tonightPhoto} />
              <span className={s.tonightText}>
                <span className={s.tonightKicker}>Cooking tonight</span>
                <span className={s.tonightTitle}>{tonight.title}</span>
              </span>
            </button>
          )}
          <Rail label="View">
            <IconButton
              variant={view === 'box' ? 'surface' : 'ghost'}
              icon="box"
              label="Recipe box view"
              aria-pressed={view === 'box'}
              onClick={() => changeView('box')}
            />
            <IconButton
              variant={view === 'grid' ? 'surface' : 'ghost'}
              icon="grid"
              label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => changeView('grid')}
            />
          </Rail>
          <Button variant="rail" size="lg" pill icon="plus" onClick={() => setShowQr(true)}>Add recipe</Button>
        </>}
      />

      <div className={s.toolbar}>
        <div role="group" aria-label="Quick filters" className={s.filters}>
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={f.id === filter} data-filter={f.id} className={s.filter}
              onClick={() => setFilter(f.id)}>
              <span className={s.dot} aria-hidden="true" />
              {f.id === 'fav' && <Icon name={filter === 'fav' ? 'heart-solid' : 'heart'} size={18} />}
              {f.label}
              <span className={s.count}>{recipes.filter((r) => f.test(r) && matches(r, query)).length}</span>
            </button>
          ))}
        </div>
        <label className={s.search}>
          <Icon name="search" size={24} />
          <span className="sr-only">Search recipes</span>
          <input
            type="search"
            value={query}
            inputMode="none"
            onFocus={() => setKeyboard(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes or ingredients — try “chicken” or “oats”"
          />
          {query && <IconButton variant="secondary" round={false} icon="close" label="Clear search" onClick={() => setQuery('')} />}
        </label>
      </div>

      {view === 'box' ? (
        <section ref={boxRef} aria-label="Recipe box" className={s.box}>
          {shown > 0 && <span className={s.hint}>{shown} {shown === 1 ? 'card' : 'cards'} · tap a card to pull it out · ♥ to favorite</span>}
          <div className={`${s.boxScroll} scroll-x`}>
            <div key={filter} className={s.boxInner} style={{ width }}>
              {items.map((it) => it.kind === 'divider' ? (
                <div key={it.key} data-course={it.course} className={s.divider} style={{ left: it.x, ['--n' as string]: it.n }}>
                  <span className={s.tab} style={{ left: it.tabX }}>{it.course}<span className={s.tabCount}>{it.count}</span></span>
                </div>
              ) : (
                <div key={it.key} className={s.slot} style={{ left: it.x, ['--n' as string]: it.n }}>
                  <div
                    data-course={it.recipe.course}
                    className={pull?.id === it.recipe.id ? `${s.card} ${s.cardOut}` : s.card}
                    style={{ ['--tilt' as string]: `${it.tilt}deg`, ['--rest' as string]: `${it.rest}px` }}
                  >
                    <button
                      type="button"
                      className={s.cardOpen}
                      aria-label={`Pull out ${it.recipe.title}`}
                      ref={(el) => { if (el) cardRefs.current.set(it.recipe.id, el); else cardRefs.current.delete(it.recipe.id) }}
                      onClick={() => open(it.recipe.id)}
                    >
                      <RecipeCardFace recipe={it.recipe} variant={it.i} />
                    </button>
                    <IconButton
                      variant="secondary"
                      round
                      className={it.recipe.favorite ? `${s.cardFav} ${s.favOn}` : s.cardFav}
                      icon={it.recipe.favorite ? 'heart-solid' : 'heart'}
                      label={it.recipe.favorite ? `Remove ${it.recipe.title} from favorites` : `Save ${it.recipe.title} to favorites`}
                      aria-pressed={!!it.recipe.favorite}
                      onClick={() => toggleFavorite(it.recipe)}
                    />
                  </div>
                </div>
              ))}
              <div className={s.boxFront} aria-hidden="true">
                <span className={s.plate}>The Chung Family Recipes</span>
              </div>
            </div>
          </div>
          {isLoading && shown === 0 && (
            <div className={s.empty}>
              <span className={s.emptyTitle}>Loading recipes…</span>
            </div>
          )}
          {!isLoading && shown === 0 && (
            <div className={s.empty}>
              <span className={s.emptyTitle}>No recipe cards match</span>
              <span className={s.emptyText}>Try another word, or tap All to see every card.</span>
            </div>
          )}
        </section>
      ) : (
        <Panel pad="sm" className={s.gridPanel} aria-label="Recipe grid">
          <div className={`${s.grid} scroll-y`}>
            {isLoading && !visible.length && <p className={s.gridEmpty}>Loading recipes…</p>}
            {!isLoading && !visible.length && (
              <p className={s.gridEmpty}>No recipes match. Try another filter, or tap All.</p>
            )}
            {visible.map((recipe, i) => (
              <div key={recipe.id} data-course={recipe.course} className={s.gridCard}>
                <button
                  type="button"
                  className={s.gridOpen}
                  aria-label={`Open ${recipe.title}`}
                  ref={(el) => { if (el) cardRefs.current.set(recipe.id, el); else cardRefs.current.delete(recipe.id) }}
                  onClick={(e) => open(recipe.id, e.currentTarget)}
                >
                  <span className={s.band} />
                  <span className={s.gridPhotoWrap}>
                    <FoodPhoto photo={recipe.photo} variant={i} className={s.gridPhoto} />
                  </span>
                  <span className={s.gridBody}>
                    <span className={s.course}>{recipe.course}</span>
                    <span className={s.gridTitle}>{recipe.title}</span>
                    <span className={s.chips}>
                      <span className={s.chip}>{timeLabel(totalMin(recipe))}</span>
                      <span className={s.chip}>Serves {recipe.servings}</span>
                    </span>
                  </span>
                </button>
                <IconButton
                  variant="secondary"
                  round
                  className={recipe.favorite ? `${s.gridFav} ${s.favOn}` : s.gridFav}
                  icon={recipe.favorite ? 'heart-solid' : 'heart'}
                  label={recipe.favorite ? `Remove ${recipe.title} from favorites` : `Save ${recipe.title} to favorites`}
                  aria-pressed={!!recipe.favorite}
                  onClick={() => toggleFavorite(recipe)}
                />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {pull && (
        <PulledCard
          key={pull.id}
          pull={pull}
          recipe={recipeById(recipes, pull.id) ?? pull.recipe}
          planRows={planRows}
          weekDates={weekDates}
          onToggleFavorite={toggleFavorite}
          onAddToPlan={(r) => flash(`Added ${r.title} to the meal plan`)}
          onDelete={removeRecipe}
          deleting={deleteRecipe.isPending}
          pinProtectsDelete={!!settings?.pinProtectDeletes}
          onClosed={() => setPull(null)}
        />
      )}

      {showQr && (
        <div className={s.qrScrim} role="dialog" aria-modal="true" aria-label="Add a recipe with your phone" onClick={() => setShowQr(false)}>
          <div className={s.qrCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.qrHead}>
              <span className={s.qrTitle}>Add a recipe with your phone</span>
              <IconButton variant="secondary" icon="close" label="Close" onClick={() => setShowQr(false)} />
            </div>
            {qrSrc ? (
              <>
                <img className={s.qrImg} src={qrSrc} alt="" width={360} height={360} />
                <p className={s.qrHint}>Scan to open the recipe importer, then the new card shows up here.</p>
              </>
            ) : (
              <p className={s.qrHint}>Recipe import isn’t set up for this household yet.</p>
            )}
          </div>
        </div>
      )}

      {toast && <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
      {keyboard && <SoftKeyboard value={query} onChange={setQuery} onDone={() => setKeyboard(false)} />}
    </AppShell>
  )
}

/** Front of a recipe card in the box: course band, photo, title, chips, first ingredients on ruled lines. */
function RecipeCardFace({ recipe: r, variant }: { recipe: Recipe; variant: number }) {
  return <>
    <span className={s.band} />
    <span className={s.photoWrap}>
      <FoodPhoto photo={r.photo} variant={variant} className={s.photo} />
      {r.favorite && <span className={s.fav}>★ Family favorite</span>}
    </span>
    <span className={s.body}>
      <span className={s.course}>{r.course}</span>
      <span className={s.title}>{r.title}</span>
      <span className={s.chips}>
        <span className={s.chip}>{timeLabel(r.prepMin + r.cookMin)}</span>
        <span className={s.chip}>Serves {r.servings}</span>
      </span>
    </span>
    <span className={s.preview}>
      {r.ingredients.slice(0, 3).map((i) => <span key={i.name}>{amount(i.qty, i.unit)} {i.name}</span>)}
    </span>
  </>
}

/** A card that isn't in the box (filtered out) grows out of the bottom middle of the box instead. */
function fallbackRect(box: HTMLElement | null): DOMRect {
  const b = box?.getBoundingClientRect() ?? new DOMRect(120, 300, 1800, 780)
  return new DOMRect(b.left + b.width / 2 - CARD_W / 2, b.bottom - 640, CARD_W, 600)
}
