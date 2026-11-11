/** Normalize for dedupe / blocklist matching. */
export function normalizeIngredientName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, "'")
}

/**
 * Recipe lines that aren't useful on a grocery run (process liquids, prep byproducts, etc.).
 * Keep salt/pepper/oil — those are real shoppable staples.
 */
const BLOCKED_EXACT = new Set([
  'water',
  'hot water',
  'cold water',
  'warm water',
  'boiling water',
  'ice water',
  'tap water',
  'filtered water',
  'ice',
  'ice cubes',
  'ice cube',
  'pasta water',
  'reserved pasta water',
  'potato water',
  'cooking water',
  'cooking liquid',
  'reserved cooking liquid',
  'air',
  'steam',
])

const BLOCKED_PATTERNS: RegExp[] = [
  /^(hot |cold |warm |boiling |ice |filtered |tap )?water$/,
  /\bpasta water\b/,
  /\bcooking (water|liquid)\b/,
  /\breserved\b.*\b(water|liquid|drippings|fat)\b/,
  /\bdrippings\b/,
  /^ice cubes?$/,
]

/** True when the ingredient should appear on a grocery list. */
export function isShoppableIngredient(name: string): boolean {
  const key = normalizeIngredientName(name)
  if (!key) return false
  // Strip trailing prep notes in parentheses for matching: "garlic (minced)" → still shoppable
  const core = key.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  if (!core) return false
  if (BLOCKED_EXACT.has(core) || BLOCKED_EXACT.has(key)) return false
  if (BLOCKED_PATTERNS.some((re) => re.test(core) || re.test(key))) return false
  return true
}

/** Rough store-walk order when Kroger aisle data isn't available yet. */
export const GROCERY_AISLE_ORDER = [
  'Produce',
  'Meat & seafood',
  'Dairy & eggs',
  'Bakery',
  'Deli',
  'Frozen',
  'Pantry',
  'Beverages',
  'Household',
  'Baby',
  'Other',
] as const

export type GroceryAisle = (typeof GROCERY_AISLE_ORDER)[number]

type Rule = { aisle: GroceryAisle; words: string[] }

const AISLE_RULES: Rule[] = [
  {
    aisle: 'Produce',
    words: [
      'lettuce', 'spinach', 'kale', 'arugula', 'cabbage', 'broccoli', 'cauliflower', 'carrot',
      'celery', 'cucumber', 'tomato', 'onion', 'garlic', 'ginger', 'potato', 'sweet potato',
      'bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'jalapeño', 'jalapeno',
      'avocado', 'banana', 'apple', 'lemon', 'lime', 'orange', 'berry', 'berries', 'mushroom',
      'herb', 'cilantro', 'parsley', 'basil', 'scallion', 'green onion', 'shallot', 'zucchini',
      'squash', 'corn', 'asparagus', 'fruit',
    ],
  },
  {
    aisle: 'Meat & seafood',
    words: [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham', 'steak', 'ground',
      'mince', 'shrimp', 'prawn', 'salmon', 'tuna', 'fish', 'cod', 'thigh', 'breast',
      'wing', 'rib', 'lamb', 'meatball',
    ],
  },
  {
    aisle: 'Dairy & eggs',
    words: [
      'milk', 'cream', 'butter', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'yogurt',
      'egg', 'sour cream', 'half-and-half', 'half and half', 'ricotta', 'feta',
    ],
  },
  {
    aisle: 'Bakery',
    words: ['bread', 'bun', 'roll', 'tortilla', 'bagel', 'pita', 'croissant', 'bakery'],
  },
  {
    aisle: 'Deli',
    words: ['deli', 'sliced turkey', 'sliced ham', 'hummus'],
  },
  {
    aisle: 'Frozen',
    words: ['frozen', 'ice cream', 'popsicle'],
  },
  {
    aisle: 'Beverages',
    words: ['juice', 'soda', 'coffee', 'tea', 'wine', 'beer'],
  },
  {
    aisle: 'Baby',
    words: ['diaper', 'wipe', 'formula', 'baby'],
  },
  {
    aisle: 'Household',
    words: ['foil', 'parchment', 'paper towel', 'trash bag', 'soap', 'detergent', 'sponge'],
  },
  {
    aisle: 'Pantry',
    words: [
      'oil', 'vinegar', 'soy sauce', 'salt', 'pepper', 'sugar', 'flour', 'rice', 'pasta',
      'noodle', 'bean', 'lentil', 'spice', 'seasoning', 'ketchup', 'mustard', 'mayo',
      'mayonnaise', 'honey', 'maple', 'sauce', 'paste', 'canned', 'broth', 'stock',
      'wrapper', 'wonton', 'tortilla chip', 'breadcrumb', 'oat', 'cereal', 'nut',
    ],
  },
]

/** Heuristic aisle bucket for grouping before/without Kroger aisle IDs. */
export function guessGroceryAisle(name: string): GroceryAisle {
  const key = normalizeIngredientName(name)
  for (const rule of AISLE_RULES) {
    if (rule.words.some((w) => key.includes(w))) return rule.aisle
  }
  return 'Other'
}

/** Prefer numbered Kroger aisles, then store departments, then heuristic buckets. */
export function aisleSortKey(aisle: string): number {
  const numbered = aisle.match(/aisle\s+(\d+)/i)
  if (numbered) return Number(numbered[1])

  const upper = aisle.trim().toUpperCase()
  if (upper.includes('PRODUCE') || upper.includes('VEGETABLE') || upper.includes('FRUIT')) return 200
  if (upper.includes('MEAT') || upper.includes('SEAFOOD') || upper.includes('BUTCHER')) return 220
  if (upper.includes('DAIRY') || upper.includes('EGG')) return 240
  if (upper.includes('BAKERY') || upper.includes('BREAD')) return 260
  if (upper.includes('DELI')) return 280
  if (upper.includes('FROZEN')) return 300
  if (upper.includes('BEVERAGE') || upper.includes('DRINK')) return 320

  const idx = GROCERY_AISLE_ORDER.indexOf(aisle as GroceryAisle)
  return 1000 + (idx === -1 ? GROCERY_AISLE_ORDER.length : idx)
}

/** Shorten a recipe ingredient into a Kroger product search term. */
export function krogerSearchTerm(name: string): string {
  let term = normalizeIngredientName(name)
  term = term.split(',')[0] ?? term
  term = term.replace(/\s*\([^)]*\)\s*/g, ' ')
  term = term
    .replace(
      /\b(fresh|dried|minced|chopped|diced|sliced|peeled|deveined|grated|shredded|crushed|ground|whole|large|small|medium|optional|to taste|finely|roughly|thinly)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  const words = term.split(' ').filter(Boolean).slice(0, 4)
  return words.join(' ')
}

export type GroceryQty = { amount: number; unit: string }

const UNIT_ALIASES: Record<string, string> = {
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  't.': 'tsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  'tbs.': 'tbsp',
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  'fl oz': 'fl oz',
  floz: 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  clove: 'clove',
  cloves: 'clove',
  slice: 'slice',
  slices: 'slice',
  piece: 'piece',
  pieces: 'piece',
  can: 'can',
  cans: 'can',
  bunch: 'bunch',
  bunches: 'bunch',
  package: 'package',
  packages: 'package',
  pkg: 'package',
}

/** Convert common cooking units into a shared base for summing. */
const TO_BASE: Record<string, { family: 'volume' | 'weight' | 'count'; factor: number }> = {
  tsp: { family: 'volume', factor: 1 },
  tbsp: { family: 'volume', factor: 3 },
  'fl oz': { family: 'volume', factor: 6 },
  cup: { family: 'volume', factor: 48 },
  ml: { family: 'volume', factor: 0.202884 },
  l: { family: 'volume', factor: 202.884 },
  g: { family: 'weight', factor: 1 },
  kg: { family: 'weight', factor: 1000 },
  oz: { family: 'weight', factor: 28.3495 },
  lb: { family: 'weight', factor: 453.592 },
  clove: { family: 'count', factor: 1 },
  slice: { family: 'count', factor: 1 },
  piece: { family: 'count', factor: 1 },
  can: { family: 'count', factor: 1 },
  bunch: { family: 'count', factor: 1 },
  package: { family: 'count', factor: 1 },
}

export function normalizeUnit(unit: string): string {
  const key = unit.trim().toLowerCase().replace(/\./g, '')
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[unit.trim().toLowerCase()] ?? key
}

function roundQty(n: number) {
  const rounded = Math.round(n * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatGroceryQty(amount: number, unit: string): string {
  const n = roundQty(amount)
  if (!n) return ''
  const u = unit.trim()
  return u ? `${n} ${u}` : String(n)
}

/** Prefer a readable volume/weight unit after summing in base units. */
function preferDisplayUnit(family: 'volume' | 'weight' | 'count', baseAmount: number, preferredUnit: string): GroceryQty {
  if (family === 'volume') {
    if (baseAmount >= 48 && baseAmount % 48 === 0) return { amount: baseAmount / 48, unit: 'cup' }
    if (baseAmount >= 48) return { amount: roundQty(baseAmount / 48), unit: 'cup' }
    if (baseAmount >= 3 && baseAmount % 3 === 0) return { amount: baseAmount / 3, unit: 'tbsp' }
    if (preferredUnit === 'tbsp' || preferredUnit === 'cup') {
      if (baseAmount >= 3) return { amount: roundQty(baseAmount / 3), unit: 'tbsp' }
    }
    return { amount: roundQty(baseAmount), unit: preferredUnit === 'cup' || preferredUnit === 'tbsp' ? preferredUnit : 'tsp' }
  }
  if (family === 'weight') {
    if (baseAmount >= 453.592) return { amount: roundQty(baseAmount / 453.592), unit: 'lb' }
    if (preferredUnit === 'oz' || preferredUnit === 'lb') {
      if (baseAmount >= 28.3495) return { amount: roundQty(baseAmount / 28.3495), unit: 'oz' }
    }
    return { amount: roundQty(baseAmount), unit: preferredUnit || 'g' }
  }
  return { amount: roundQty(baseAmount), unit: preferredUnit }
}

export function parseGroceryQty(raw: string | null | undefined): GroceryQty | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null
  const amount = Number(m[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  return { amount, unit: normalizeUnit(m[2] ?? '') }
}

/**
 * Combine two quantities for the same ingredient.
 * Compatible units are converted and summed; incompatible ones stay as "a + b".
 */
export function mergeGroceryQty(
  a: GroceryQty | null | undefined,
  b: GroceryQty | null | undefined,
): GroceryQty | { display: string } | null {
  if (!a && !b) return null
  if (!a) return b ?? null
  if (!b) return a

  const unitA = normalizeUnit(a.unit)
  const unitB = normalizeUnit(b.unit)
  const baseA = TO_BASE[unitA]
  const baseB = TO_BASE[unitB]

  // Same unit (1 tsp + 2 tsp → 3 tsp) — don't auto-promote to tbsp/cups.
  if (unitA === unitB) {
    return { amount: roundQty(a.amount + b.amount), unit: unitA }
  }

  if (baseA && baseB && baseA.family === baseB.family) {
    const total = a.amount * baseA.factor + b.amount * baseB.factor
    const preferred = unitA || unitB
    return preferDisplayUnit(baseA.family, total, preferred)
  }

  const left = formatGroceryQty(a.amount, unitA)
  const right = formatGroceryQty(b.amount, unitB)
  if (!left) return b
  if (!right) return a
  return { display: `${left} + ${right}` }
}

export function groceryQtyToString(qty: GroceryQty | { display: string } | null | undefined): string | undefined {
  if (!qty) return undefined
  if ('display' in qty) return qty.display || undefined
  return formatGroceryQty(qty.amount, qty.unit) || undefined
}

export function ingredientToGroceryQty(ing: { qty: number; unit: string }): GroceryQty | null {
  if (!ing.qty) return null
  return { amount: ing.qty, unit: normalizeUnit(ing.unit || '') }
}
