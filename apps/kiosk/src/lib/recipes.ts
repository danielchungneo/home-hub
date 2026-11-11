import type { Course, MealEntry } from '@hub/shared'
import { quantity } from './format'
import type { Recipe } from './types'

export const COURSES: Course[] = ['Breakfast', 'Dinner', 'Sweets']

export const totalMin = (r: Recipe) => r.prepMin + r.cookMin
export const isQuick = (r: Recipe) => totalMin(r) <= 30

export const recipeById = (recipes: Recipe[], id: string) => recipes.find((r) => r.id === id)
export const entryRecipe = (recipes: Recipe[], e: MealEntry) =>
  (e && 'recipeId' in e ? recipeById(recipes, e.recipeId) : undefined)
export const entryText = (e: MealEntry) => (e && 'text' in e ? e.text : undefined)

/** Title, course and ingredient names, lower-cased, for the search boxes. */
export function matches(r: Recipe, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${r.title} ${r.course} ${r.ingredients.map((i) => i.name).join(' ')}`.toLowerCase().includes(q)
}

/** "1½ cups", or "to taste" when qty is 0. */
export function amount(qty: number, unit: string) {
  return qty ? `${quantity(qty)}${unit ? ` ${unit}` : ''}` : 'to taste'
}

/** "25 min", "4 hr", "1 hr 15 min", "No cook". */
export function timeLabel(m: number) {
  if (!m) return 'No cook'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return `${h} hr${r ? ` ${r} min` : ''}`
}
