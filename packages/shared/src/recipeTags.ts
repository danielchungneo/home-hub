/** Curated recipe tags: cuisine, meal slot, and total cook time. */

export const RECIPE_CUISINES = [
  'American',
  'Mexican',
  'Italian',
  'Chinese',
  'Japanese',
  'Korean',
  'Thai',
  'Indian',
  'Mediterranean',
  'Middle Eastern',
  'French',
  'Greek',
  'Vietnamese',
  'Caribbean',
  'British',
  'Other',
] as const

export const RECIPE_MEALS = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Side',
  'Dessert',
] as const

export const RECIPE_TIMES = ['Quick', 'Medium', 'Long'] as const

export type RecipeCuisine = (typeof RECIPE_CUISINES)[number]
export type RecipeMeal = (typeof RECIPE_MEALS)[number]
export type RecipeTime = (typeof RECIPE_TIMES)[number]
export type RecipeTag = RecipeCuisine | RecipeMeal | RecipeTime

export const RECIPE_TAG_GROUPS = [
  { id: 'meal', label: 'Meal', tags: RECIPE_MEALS },
  { id: 'time', label: 'Time', tags: RECIPE_TIMES },
  { id: 'cuisine', label: 'Cuisine', tags: RECIPE_CUISINES },
] as const

export const ALL_RECIPE_TAGS: readonly RecipeTag[] = [
  ...RECIPE_MEALS,
  ...RECIPE_TIMES,
  ...RECIPE_CUISINES,
]

const ALLOWED = new Set<string>(ALL_RECIPE_TAGS)

/** Map older free-form chips onto the curated set. */
const TAG_ALIASES: Record<string, RecipeTag> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  side: 'Side',
  dessert: 'Dessert',
  quick: 'Quick',
  'under 30': 'Quick',
  'under 30 min': 'Quick',
  '30 min': 'Quick',
  medium: 'Medium',
  weeknight: 'Medium',
  '30-60': 'Medium',
  '30–60 min': 'Medium',
  'about an hour': 'Medium',
  long: 'Long',
  longer: 'Long',
  'over 1 hour': 'Long',
  'slow cooker': 'Long',
  'slow-cooker': 'Long',
  american: 'American',
  mexican: 'Mexican',
  italian: 'Italian',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  indian: 'Indian',
  mediterranean: 'Mediterranean',
  'middle eastern': 'Middle Eastern',
  french: 'French',
  greek: 'Greek',
  vietnamese: 'Vietnamese',
  caribbean: 'Caribbean',
  british: 'British',
  english: 'British',
  other: 'Other',
}

export function timeTagForMinutes(totalMin: number): RecipeTime {
  const total = Math.max(0, Math.round(totalMin) || 0)
  if (total <= 30) return 'Quick'
  if (total <= 60) return 'Medium'
  return 'Long'
}

export function isRecipeTime(tag: string): tag is RecipeTime {
  return (RECIPE_TIMES as readonly string[]).includes(tag)
}

export function isRecipeMeal(tag: string): tag is RecipeMeal {
  return (RECIPE_MEALS as readonly string[]).includes(tag)
}

export function isRecipeCuisine(tag: string): tag is RecipeCuisine {
  return (RECIPE_CUISINES as readonly string[]).includes(tag)
}

function canonicalize(raw: string): RecipeTag | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (ALLOWED.has(trimmed)) return trimmed as RecipeTag
  return TAG_ALIASES[trimmed.toLowerCase()] ?? null
}

/** Keep only curated tags; at most one time tag. */
export function normalizeRecipeTags(
  tags: string[] | null | undefined,
  opts?: { prepMin?: number; cookMin?: number; ensureTime?: boolean },
): RecipeTag[] {
  const meals: RecipeMeal[] = []
  const cuisines: RecipeCuisine[] = []
  let time: RecipeTime | null = null

  for (const raw of tags ?? []) {
    const tag = canonicalize(raw)
    if (!tag) continue
    if (isRecipeMeal(tag)) {
      if (!meals.includes(tag)) meals.push(tag)
      continue
    }
    if (isRecipeCuisine(tag)) {
      if (!cuisines.includes(tag)) cuisines.push(tag)
      continue
    }
    if (isRecipeTime(tag) && !time) time = tag
  }

  if (!time && opts?.ensureTime !== false) {
    const prep = opts?.prepMin ?? 0
    const cook = opts?.cookMin ?? 0
    if (prep > 0 || cook > 0) time = timeTagForMinutes(prep + cook)
  }

  return [...meals, ...(time ? [time] : []), ...cuisines]
}

export function toggleRecipeTag(tags: string[], tag: RecipeTag): RecipeTag[] {
  const current = normalizeRecipeTags(tags, { ensureTime: false })
  if (isRecipeTime(tag)) {
    const withoutTime = current.filter((t) => !isRecipeTime(t))
    return current.includes(tag) ? withoutTime : [...withoutTime, tag]
  }
  if (current.includes(tag)) return current.filter((t) => t !== tag)
  return [...current, tag]
}

export function withSyncedTimeTag(
  tags: string[],
  prepMin: number,
  cookMin: number,
): RecipeTag[] {
  const base = normalizeRecipeTags(tags, { ensureTime: false })
  const withoutTime = base.filter((t) => !isRecipeTime(t))
  return [...withoutTime, timeTagForMinutes(prepMin + cookMin)]
}
