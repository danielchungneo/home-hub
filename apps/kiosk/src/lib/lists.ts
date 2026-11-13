import type { Ingredient, MemberColor, Recipe } from '@hub/shared'
import type { IconName } from '../components/Icon'
import { quantity } from './format'

/** Aisles, in walking order through the store. Color = data-color for the aisle tint. */
export const CATEGORIES: { name: string; icon: IconName; color?: MemberColor }[] = [
  { name: 'Produce', icon: 'leaf', color: 'moss' },
  { name: 'Dairy & eggs', icon: 'droplet', color: 'fjord' },
  { name: 'Meat', icon: 'pot', color: 'clay' },
  { name: 'Pantry', icon: 'bag', color: 'honey' },
  { name: 'Frozen', icon: 'sparkle', color: 'fjord' },
  { name: 'Baby', icon: 'stroller', color: 'plum' },
  { name: 'Household', icon: 'broom', color: 'moss' },
  { name: 'Home', icon: 'key', color: 'clay' },
  { name: 'Baby-proofing', icon: 'stroller', color: 'plum' },
  { name: 'Christmas', icon: 'sparkle', color: 'clay' },
  { name: 'Other', icon: 'list' },
]

export const category = (name: string) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1]!
export const categoryOrder = (name: string) => {
  const i = CATEGORIES.findIndex((c) => c.name === name)
  return i < 0 ? CATEGORIES.length : i
}

const GUESS: [RegExp, string][] = [
  [/muffin|bagel|bread|bun|cracker/i, 'Pantry'],
  [/berr|apple|banana|lettuce|spinach|tomato|onion|lemon|lime|potato|carrot|avocado|grape|garlic|pepper|herb/i, 'Produce'],
  [/milk|cheese|cheddar|parmesan|yogurt|egg|butter|cream/i, 'Dairy & eggs'],
  [/chicken|beef|turkey|pork|bacon|sausage|steak|roast/i, 'Meat'],
  [/rice|pasta|spaghetti|bread|flour|sugar|cereal|beans|broth|coffee|tortilla|shell|oil|oats|syrup|chips|tomatoes/i, 'Pantry'],
  [/frozen|ice cream|pizza/i, 'Frozen'],
  [/diaper|wipe|formula|bottle|pacifier/i, 'Baby'],
  [/towel|soap|detergent|trash bag|tissue|toilet/i, 'Household'],
]

/** Best guess at the aisle for something typed, falling back to the list's main category. */
export function guessCategory(text: string, listName?: string): string {
  for (const [re, cat] of GUESS) if (re.test(text)) return cat
  const key = (listName ?? '').toLowerCase()
  if (key.includes('hardware')) return 'Home'
  if (key.includes('gift')) return 'Christmas'
  return 'Other'
}

/** Ingredients for planned dinners, de-duplicated, ready to add to Groceries. */
export function mealIngredientsFromRecipes(
  dinners: { day: number; recipe: Recipe }[],
): { text: string; category: string; qty?: string }[] {
  const seen = new Set<string>()
  const out: { text: string; category: string; qty?: string }[] = []
  for (const d of dinners) {
    for (const i of d.recipe.ingredients as Ingredient[]) {
      const key = i.name.toLowerCase()
      if (!i.qty || seen.has(key) || /salt|pepper|oil|spice|powder|paprika|seasoning/.test(key)) continue
      seen.add(key)
      out.push({
        text: i.name.replace(/^./, (c) => c.toUpperCase()),
        category: guessCategory(i.name),
        qty: `${quantity(i.qty)}${i.unit ? ` ${i.unit}` : ''}`,
      })
    }
  }
  return out
}
