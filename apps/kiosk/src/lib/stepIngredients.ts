import type { Ingredient, RecipeStep } from '@hub/shared'

const STOP = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with', 'into', 'on',
  'fresh', 'large', 'small', 'finely', 'chopped', 'minced', 'peeled', 'ground',
  'dried', 'white', 'part', 'optional', 'about',
])

function primaryName(name: string) {
  return name.toLowerCase().split(',')[0]!.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
}

function aliases(name: string) {
  const found = [...name.toLowerCase().matchAll(/\(([^)]+)\)/g)].flatMap((m) =>
    m[1]!.split(/\/|,| or /).map((p) => p.trim()).filter(Boolean),
  )
  return found
}

function tokens(phrase: string) {
  return phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
}

/** Prefer explicit step.uses; otherwise match ingredient names mentioned in the step text. */
export function ingredientsForStep(step: RecipeStep | undefined, ingredients: Ingredient[]): Ingredient[] {
  if (!step) return []
  if (step.uses?.length) {
    const linked = ingredients.filter((ing) => step.uses!.includes(ing.name))
    if (linked.length) return linked
  }

  const text = step.text.toLowerCase()
  return ingredients.filter((ing) => {
    const primary = primaryName(ing.name)
    if (primary.length >= 3 && text.includes(primary)) return true
    for (const alias of aliases(ing.name)) {
      if (alias.length >= 3 && text.includes(alias)) return true
    }
    const toks = tokens(primary)
    if (!toks.length) return false
    // Strong single token (pork, shrimp, wonton) or majority of shorter tokens.
    if (toks.some((t) => t.length >= 4 && text.includes(t))) return true
    const hits = toks.filter((t) => text.includes(t)).length
    return hits > 0 && hits >= Math.ceil(toks.length * 0.6)
  })
}
