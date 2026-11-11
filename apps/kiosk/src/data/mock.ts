// Mock data for building the UI before Supabase is wired up.
// Every export here maps to a table in the design doc (§8). Replace one export
// at a time with a TanStack Query hook; screens shouldn't need to change shape.
import type {
  CalendarEvent, LedgerEntry, MealEntry, MealSlot, Member, Photo,
  Redemption,
} from '@hub/shared'
import type { Recipe, Reward, ShoppingList, Task } from '../lib/types'

export const MEMBERS: Member[] = [
  { id: 'daniel', name: 'Daniel', initial: 'D', role: 'parent', roleLabel: 'Dad', color: 'moss', earnsPoints: true, routines: ['morning', 'afternoon', 'evening', 'chores'] },
  { id: 'shelby', name: 'Shelby', initial: 'S', role: 'parent', roleLabel: 'Mom', color: 'clay', earnsPoints: true, routines: ['morning', 'afternoon', 'evening', 'chores'] },
  { id: 'noah', name: 'Noah', initial: 'N', role: 'child', roleLabel: 'Baby care', color: 'honey', earnsPoints: false, routines: ['morning', 'afternoon', 'evening', 'chores'] },
]

/** Shared household column on the Tasks screen. */
export const HOME_COLUMN: Member = {
  id: 'home', name: 'Home', initial: 'H', role: 'parent', roleLabel: 'Everyone', color: 'fjord', earnsPoints: false, routines: ['morning', 'afternoon', 'evening', 'chores'],
}

/** Calendar "who" values that aren't a member. */
export const FAMILY = { id: 'family', name: 'Family', initial: 'F', color: 'fjord' as const }

export const WEATHER = { temp: 52, condition: 'Partly sunny', high: 61, icon: 'sun' as const }

let n = 0
const t = (memberId: string, routine: Task['routine'], title: string, icon: Task['icon'], points = 0): Task =>
  ({ id: `t${++n}`, memberId, routine, title, icon, points })

export const TASKS: Task[] = [
  t('daniel', 'morning', 'Make coffee', 'mug'),
  t('daniel', 'morning', 'Workout', 'dumbbell', 10),
  t('daniel', 'morning', 'Make the bed', 'bed', 5),
  t('daniel', 'afternoon', 'Check the mail', 'mail'),
  t('daniel', 'afternoon', 'Start dinner', 'pot', 10),
  t('daniel', 'evening', 'Do the dishes', 'dish', 10),
  t('daniel', 'evening', 'Lock up', 'key'),
  t('daniel', 'chores', 'Take out trash', 'trash', 10),
  t('daniel', 'chores', 'Mow the lawn', 'leaf', 20),
  t('daniel', 'chores', 'Wash the car', 'car', 15),
  t('shelby', 'morning', 'Water plants', 'plant', 5),
  t('shelby', 'morning', 'Pack diaper bag', 'bag', 5),
  t('shelby', 'morning', 'Make the bed', 'bed', 5),
  t('shelby', 'afternoon', 'Grocery pickup', 'cart', 10),
  t('shelby', 'afternoon', 'Check the mail', 'mail'),
  t('shelby', 'evening', 'Fold laundry', 'shirt', 10),
  t('shelby', 'evening', 'Prep lunches', 'pot', 10),
  t('shelby', 'chores', 'Start laundry', 'shirt', 10),
  t('shelby', 'chores', 'Wipe counters', 'sparkle', 5),
  t('shelby', 'chores', 'Clean bathroom', 'droplet', 15),
  t('noah', 'morning', 'Morning bottle', 'bottle'),
  t('noah', 'morning', 'Tummy time', 'sun'),
  t('noah', 'morning', 'Get dressed', 'shirt'),
  t('noah', 'afternoon', 'Nap', 'moon'),
  t('noah', 'afternoon', 'Bottle', 'bottle'),
  t('noah', 'afternoon', 'Stroller walk', 'stroller'),
  t('noah', 'evening', 'Bath time', 'bath'),
  t('noah', 'evening', 'Story time', 'book'),
  t('noah', 'evening', 'Bedtime', 'moon'),
  t('noah', 'chores', 'Wash bottles', 'bottle'),
  t('noah', 'chores', 'Baby laundry', 'shirt'),
  t('home', 'morning', 'Open the blinds', 'sun'),
  t('home', 'morning', 'Unload dishwasher', 'dish'),
  t('home', 'afternoon', 'Tidy living room', 'sofa'),
  t('home', 'evening', 'Run dishwasher', 'dish'),
  t('home', 'evening', 'Lock the doors', 'key'),
  t('home', 'chores', 'Vacuum', 'broom'),
  t('home', 'chores', 'Change sheets', 'bed'),
  t('home', 'chores', 'Trash and recycling', 'trash'),
]

/** Task ids completed today (a set of task_completions rows for today). */
export const COMPLETED_TODAY = ['t1', 't2', 't11', 't21', 't22', 't37', 't8']

export const EVENTS: CalendarEvent[] = [
  { id: 'e1', day: 0, start: 10, end: 11.5, title: 'Church at GoodNaz', who: 'family' },
  { id: 'e2', day: 0, start: 16, end: 17, title: 'Meal prep', who: 'shelby' },
  { id: 'e3', day: 1, start: 9, end: 9.5, title: 'Null Squad standup', who: 'daniel' },
  { id: 'e4', day: 1, start: 17.5, end: 18.5, title: 'Gym', who: 'daniel' },
  { id: 'e5', day: 2, start: 9, end: 9.5, title: 'Null Squad standup', who: 'daniel' },
  { id: 'e6', day: 2, start: 10, end: 11.5, title: 'Mom & baby group', who: 'shelby' },
  { id: 'e7', day: 3, start: 9, end: 9.5, title: 'Null Squad standup', who: 'daniel' },
  { id: 'e8', day: 3, start: 14, end: 15, title: 'Safeguard status call', who: 'daniel' },
  { id: 'e9', day: 3, start: 18.5, end: 20, title: 'Small group', who: 'family' },
  { id: 'e10', day: 4, start: 9, end: 9.5, title: 'Null Squad standup', who: 'daniel' },
  { id: 'e11', day: 4, start: 13.5, end: 14.25, title: 'Noah checkup', who: 'noah' },
  { id: 'e12', day: 4, start: 17.5, end: 18.5, title: 'Gym', who: 'daniel' },
  { id: 'e13', day: 5, start: 9, end: 9.5, title: 'Null Squad standup', who: 'daniel' },
  { id: 'e14', day: 5, start: 18, end: 20, title: 'Date night', who: 'shelby' },
  { id: 'e15', day: 6, start: 9, end: 10.5, title: 'Farmers market', who: 'family' },
  { id: 'e16', day: 6, start: 12, end: 13, title: 'Noah nap', who: 'noah' },
  { id: 'e17', day: 6, start: 13, end: 15, title: 'Engraving orders', who: 'daniel' },
  { id: 'e18', day: 6, start: 15.5, end: 16.5, title: 'Coffee with friends', who: 'shelby' },
  { id: 'e19', day: 4, start: 0, end: 0, title: 'Trash pickup', who: 'family', allDay: true },
]

export const REWARDS: Reward[] = [
  { id: 'sleepin', title: 'Sleep in Saturday', cost: 100, icon: 'moon', color: 'fjord' },
  { id: 'nap', title: 'Uninterrupted nap', cost: 120, icon: 'bed', color: 'clay' },
  { id: 'takeout', title: 'Pick the takeout', cost: 60, icon: 'utensils', color: 'honey' },
  { id: 'coffee', title: 'Coffee shop run', cost: 50, icon: 'mug', color: 'clay' },
  { id: 'skip', title: 'Skip one chore', cost: 40, icon: 'broom', color: 'moss' },
  { id: 'movie', title: 'Pick movie night', cost: 30, icon: 'sofa', color: 'fjord' },
]

/** points_ledger rows; balance = sum(delta). Seeded so Daniel = 135, Shelby = 160. */
export const LEDGER: LedgerEntry[] = [
  { id: 'l1', memberId: 'daniel', delta: 10, reason: 'Workout', when: 'Today' },
  { id: 'l2', memberId: 'daniel', delta: -30, reason: 'Pick movie night', when: 'Thursday' },
  { id: 'l3', memberId: 'daniel', delta: 20, reason: 'Mow the lawn', when: 'Wednesday' },
  { id: 'l4', memberId: 'daniel', delta: 10, reason: 'Do the dishes', when: 'Tuesday' },
  { id: 'l5', memberId: 'daniel', delta: 125, reason: 'Carried over', when: 'Last week' },
  { id: 'l6', memberId: 'shelby', delta: 5, reason: 'Water plants', when: 'Today' },
  { id: 'l7', memberId: 'shelby', delta: 15, reason: 'Clean bathroom', when: 'Friday' },
  { id: 'l8', memberId: 'shelby', delta: -50, reason: 'Coffee shop run', when: 'Thursday' },
  { id: 'l9', memberId: 'shelby', delta: 10, reason: 'Fold laundry', when: 'Thursday' },
  { id: 'l10', memberId: 'shelby', delta: 180, reason: 'Carried over', when: 'Last week' },
]

export const PENDING_REDEMPTIONS: Redemption[] = [{ id: 'r1', memberId: 'shelby', rewardId: 'nap' }]

export const RECIPES: Recipe[] = [
  {
    id: 'sheetpan', title: 'Sheet-pan chicken & veggies', icon: 'dish', color: 'clay', prepMin: 15, cookMin: 25, servings: 4, tags: ['Dinner', 'Quick', 'American'],
    course: 'Dinner', photo: { palette: ['#F3E7DF', '#C27A4E', '#E9A27E', '#55623F'] }, favorite: true,
    ingredients: [
      { qty: 2, unit: 'lb', name: 'chicken thighs' }, { qty: 2, unit: '', name: 'sweet potatoes, cubed' },
      { qty: 1, unit: 'head', name: 'broccoli' }, { qty: 3, unit: 'tbsp', name: 'olive oil' },
      { qty: 1, unit: 'tsp', name: 'smoked paprika' }, { qty: 1, unit: 'tsp', name: 'garlic powder' },
      { qty: 0, unit: '', name: 'Salt and pepper' },
    ],
    steps: [
      { text: 'Heat the oven to 425°F and line a large sheet pan with parchment.', tip: 'Parchment makes cleanup a lot easier.' },
      { text: 'Cube the sweet potatoes and cut the broccoli into bite-size florets.', uses: ['sweet potatoes, cubed', 'broccoli'] },
      { text: 'Toss the chicken and vegetables with the oil and spices.', uses: ['chicken thighs', 'olive oil', 'smoked paprika', 'garlic powder', 'Salt and pepper'] },
      { text: 'Spread everything in one layer, with a little space between pieces.', tip: 'Crowded pans steam instead of roast. Use two pans if needed.' },
      { text: 'Roast until the chicken reaches 165°F and the potatoes are tender.', tip: 'Flip the vegetables halfway through.', timerMin: 25 },
      { text: 'Let it rest for 5 minutes, then serve.', timerMin: 5 },
    ],
  },
  {
    id: 'chili', title: 'Slow-cooker chili', icon: 'pot', color: 'honey', prepMin: 15, cookMin: 360, servings: 6, tags: ['Dinner', 'Long', 'American'],
    course: 'Dinner', photo: { palette: ['#F2DCCB', '#9A4E33', '#7D513C', '#F4D58D'] },
    ingredients: [
      { qty: 1, unit: 'lb', name: 'ground beef' }, { qty: 2, unit: 'cans', name: 'kidney beans' },
      { qty: 1, unit: 'can', name: 'diced tomatoes' }, { qty: 1, unit: '', name: 'onion, diced' },
      { qty: 2, unit: 'tbsp', name: 'chili powder' }, { qty: 1, unit: 'tsp', name: 'cumin' },
    ],
    steps: [
      { text: 'Brown the beef with the onion in a skillet.', uses: ['ground beef', 'onion, diced'] },
      { text: 'Add everything to the slow cooker and stir.', uses: ['kidney beans', 'diced tomatoes', 'chili powder', 'cumin'] },
      { text: 'Cook on low for 6 hours.', timerMin: 360 },
    ],
  },
  {
    id: 'pasta', title: 'Lemon parmesan pasta', icon: 'pot', color: 'moss', prepMin: 10, cookMin: 15, servings: 4, tags: ['Dinner', 'Quick', 'Italian'],
    course: 'Dinner', photo: { palette: ['#E6E9DA', '#F4D58D', '#E9D9C4', '#6B7A55'] },
    ingredients: [
      { qty: 1, unit: 'lb', name: 'spaghetti' }, { qty: 1, unit: '', name: 'lemon, zest and juice' },
      { qty: 1, unit: 'cup', name: 'grated parmesan' }, { qty: 3, unit: 'tbsp', name: 'butter' }, { qty: 2, unit: 'cloves', name: 'garlic' },
    ],
    steps: [
      { text: 'Boil the spaghetti in salted water until al dente.', timerMin: 10, uses: ['spaghetti'] },
      { text: 'Melt the butter with the garlic, then toss in the pasta, lemon and parmesan.', uses: ['butter', 'garlic', 'lemon, zest and juice', 'grated parmesan'] },
    ],
  },
  {
    id: 'pancakes', title: 'Banana pancakes', icon: 'dish', color: 'honey', prepMin: 10, cookMin: 15, servings: 4, tags: ['Breakfast', 'Quick', 'American'],
    course: 'Breakfast', photo: { palette: ['#F4ECDA', '#E9B566', '#C29A55', '#F6E6BE'] }, favorite: true, from: 'Shelby’s Saturday special',
    ingredients: [
      { qty: 2, unit: '', name: 'ripe bananas' }, { qty: 1.5, unit: 'cups', name: 'flour' },
      { qty: 1, unit: 'cup', name: 'milk' }, { qty: 1, unit: '', name: 'egg' }, { qty: 2, unit: 'tsp', name: 'baking powder' },
    ],
    steps: [
      { text: 'Mash the bananas, then whisk in the milk and egg.', uses: ['ripe bananas', 'milk', 'egg'] },
      { text: 'Fold in the flour and baking powder.', uses: ['flour', 'baking powder'] },
      { text: 'Cook ¼ cup at a time on a hot griddle, flipping once.' },
    ],
  },
  {
    id: 'oats', title: 'Overnight oats', icon: 'mug', color: 'fjord', prepMin: 5, cookMin: 0, servings: 2, tags: ['Breakfast', 'Quick', 'American'],
    course: 'Breakfast', photo: { palette: ['#D6E0E6', '#E9D9C4', '#C29A55', '#6E5A72'] },
    ingredients: [
      { qty: 1, unit: 'cup', name: 'rolled oats' }, { qty: 1, unit: 'cup', name: 'milk' },
      { qty: 0.5, unit: 'cup', name: 'Greek yogurt' }, { qty: 1, unit: 'tbsp', name: 'maple syrup' },
    ],
    steps: [{ text: 'Stir everything together in jars and refrigerate overnight.' }],
  },
  {
    id: 'tacos', title: 'Taco night', icon: 'utensils', color: 'clay', prepMin: 10, cookMin: 20, servings: 4, tags: ['Dinner', 'Quick', 'Mexican'],
    course: 'Dinner', photo: { palette: ['#F4ECDA', '#E9B566', '#9A4E33', '#55623F'] },
    ingredients: [
      { qty: 1, unit: 'lb', name: 'ground turkey' }, { qty: 8, unit: '', name: 'taco shells' },
      { qty: 2, unit: 'tbsp', name: 'taco seasoning' }, { qty: 1, unit: 'cup', name: 'shredded cheese' }, { qty: 1, unit: '', name: 'tomato, diced' },
    ],
    steps: [
      { text: 'Brown the turkey, then stir in the seasoning with a splash of water.', uses: ['ground turkey', 'taco seasoning'] },
      { text: 'Warm the shells and set out the toppings.', uses: ['taco shells', 'shredded cheese', 'tomato, diced'] },
    ],
  },
  {
    id: 'eggbites', title: 'Egg bites', icon: 'dish', color: 'moss', prepMin: 10, cookMin: 20, servings: 6, tags: ['Breakfast', 'Quick', 'American'],
    course: 'Breakfast', photo: { palette: ['#E9EDE1', '#F4D58D', '#6B7A55', '#F6E6BE'] },
    ingredients: [
      { qty: 6, unit: '', name: 'eggs' }, { qty: 0.5, unit: 'cup', name: 'cottage cheese' },
      { qty: 1, unit: 'cup', name: 'baby spinach' }, { qty: 0.5, unit: 'cup', name: 'shredded cheese' },
    ],
    steps: [
      { text: 'Heat the oven to 350°F and grease a muffin tin.' },
      { text: 'Blend the eggs and cottage cheese until smooth.', uses: ['eggs', 'cottage cheese'] },
      { text: 'Divide spinach and cheese into the cups, then pour in the eggs.', uses: ['baby spinach', 'shredded cheese'] },
      { text: 'Bake until just set.', timerMin: 20 },
    ],
  },
  {
    id: 'roast', title: 'Sunday pot roast', icon: 'pot', color: 'fjord', prepMin: 20, cookMin: 240, servings: 6, tags: ['Dinner', 'Long', 'American'],
    course: 'Dinner', photo: { palette: ['#E4EAEE', '#7D513C', '#E9A27E', '#C29A55'] }, favorite: true, from: 'From Grandma’s recipe box',
    ingredients: [
      { qty: 3, unit: 'lb', name: 'chuck roast' }, { qty: 4, unit: '', name: 'carrots' },
      { qty: 1.5, unit: 'lb', name: 'potatoes' }, { qty: 1, unit: '', name: 'onion' }, { qty: 2, unit: 'cups', name: 'beef broth' },
    ],
    steps: [
      { text: 'Sear the roast on all sides in a heavy pot.', uses: ['chuck roast'] },
      { text: 'Add the vegetables and broth around it.', uses: ['carrots', 'potatoes', 'onion', 'beef broth'] },
      { text: 'Cover and cook at 300°F.', timerMin: 240 },
      { text: 'Rest 10 minutes, then slice.', timerMin: 10 },
    ],
  },
  {
    id: 'crisp', title: 'Apple crisp', icon: 'leaf', color: 'clay', prepMin: 15, cookMin: 40, servings: 8, tags: ['Dessert', 'Medium', 'American'],
    course: 'Sweets', photo: { palette: ['#F3E7DF', '#C29A55', '#9A4E33', '#F6E6BE'] }, favorite: true, from: 'Fall favorite',
    ingredients: [
      { qty: 6, unit: '', name: 'apples' }, { qty: 1, unit: 'cup', name: 'rolled oats' },
      { qty: 0.5, unit: 'cup', name: 'brown sugar' }, { qty: 0.5, unit: 'cup', name: 'butter' }, { qty: 1, unit: 'tsp', name: 'cinnamon' },
    ],
    steps: [
      { text: 'Slice the apples into a baking dish.', uses: ['apples'] },
      { text: 'Mix the oats, sugar, butter and cinnamon.', uses: ['rolled oats', 'brown sugar', 'butter', 'cinnamon'] },
      { text: 'Crumble over the apples and bake at 350°F.', timerMin: 40 },
    ],
  },
  {
    id: 'cookies', title: 'Chocolate chip cookies', icon: 'sparkle', color: 'plum', prepMin: 15, cookMin: 12, servings: 24, tags: ['Dessert', 'Quick', 'American'],
    course: 'Sweets', photo: { palette: ['#EDE6F0', '#C29A55', '#5A4128', '#E9B566'] },
    ingredients: [
      { qty: 2.25, unit: 'cups', name: 'flour' }, { qty: 1, unit: 'cup', name: 'butter' },
      { qty: 0.75, unit: 'cup', name: 'brown sugar' }, { qty: 2, unit: '', name: 'eggs' }, { qty: 2, unit: 'cups', name: 'chocolate chips' },
    ],
    steps: [
      { text: 'Cream the butter and sugar.', uses: ['butter', 'brown sugar'] },
      { text: 'Beat in the eggs, then the flour.', uses: ['eggs', 'flour'] },
      { text: 'Fold in the chocolate chips.', uses: ['chocolate chips'] },
      { text: 'Bake at 375°F until golden at the edges.', timerMin: 11 },
    ],
  },
]

export const MEAL_SLOTS: { id: MealSlot; label: string; icon: 'sunrise' | 'sun' | 'utensils' | 'plant'; color: 'honey' | 'fjord' | 'clay' | 'moss' }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunrise', color: 'honey' },
  { id: 'lunch', label: 'Lunch', icon: 'sun', color: 'fjord' },
  { id: 'dinner', label: 'Dinner', icon: 'utensils', color: 'clay' },
  { id: 'snack', label: 'Snack', icon: 'plant', color: 'moss' },
]

/** meal_plan for the current week, indexed [slot][day 0–6]. */
export const MEAL_PLAN: Record<MealSlot, MealEntry[]> = {
  breakfast: [{ text: 'Muffins to go' }, { recipeId: 'oats' }, { recipeId: 'oats' }, { recipeId: 'eggbites' }, { recipeId: 'oats' }, { recipeId: 'eggbites' }, { recipeId: 'pancakes' }],
  lunch: [{ text: 'After-church lunch out' }, { text: 'Leftover chili' }, null, { text: 'Leftovers' }, null, { text: 'Leftovers' }, null],
  dinner: [{ recipeId: 'chili' }, { recipeId: 'pasta' }, { recipeId: 'sheetpan' }, { recipeId: 'tacos' }, { text: 'Leftovers' }, { text: 'Date night — eat out' }, { recipeId: 'roast' }],
  snack: [null, { text: 'Apples & PB' }, { text: 'Yogurt' }, null, { recipeId: 'cookies' }, null, { text: 'Popcorn' }],
}

let li = 0
const item = (text: string, category: string, qty?: string, assignee?: string, checked = false) =>
  ({ id: `i${++li}`, text, category, qty, assignee, checked })

export const LISTS: ShoppingList[] = [
  {
    id: 'groceries', name: 'Groceries', icon: 'cart', color: 'moss', items: [
      item('Bananas', 'Produce', '1 bunch'), item('Avocados', 'Produce', '3'), item('Baby spinach', 'Produce', undefined, 'shelby'),
      item('Sweet potatoes', 'Produce', '4'), item('Apples', 'Produce', '6', undefined, true),
      item('Whole milk', 'Dairy & eggs', '1 gal'), item('Eggs', 'Dairy & eggs', '2 dozen'), item('Greek yogurt', 'Dairy & eggs', undefined, 'shelby'),
      item('Butter', 'Dairy & eggs', undefined, undefined, true), item('Chicken thighs', 'Meat', '2 lb', 'daniel'),
      item('Coffee beans', 'Pantry', undefined, 'daniel'), item('Rice', 'Pantry'), item('Chicken broth', 'Pantry', '2'),
      item('Bread', 'Pantry', undefined, undefined, true), item('Diapers, size 1', 'Baby', '1 box', 'shelby'), item('Wipes', 'Baby', '2 packs'),
    ],
  },
  {
    id: 'costco', name: 'Costco', icon: 'bag', color: 'fjord', items: [
      item('Paper towels', 'Household'), item('Diapers, size 1', 'Baby', '1 case'), item('Olive oil', 'Pantry'), item('Frozen berries', 'Frozen', undefined, 'daniel'),
    ],
  },
  {
    id: 'hardware', name: 'Hardware store', icon: 'key', color: 'clay', items: [
      item('Air filter 20×25', 'Home', '2', 'daniel'), item('LED bulbs', 'Home', '4'), item('Outlet covers', 'Baby-proofing', '1 pack'),
    ],
  },
  {
    id: 'gifts', name: 'Gift ideas', icon: 'sparkle', color: 'honey', items: [
      item('Engraved cutting board', 'Christmas', undefined, 'daniel'), item('Board game night set', 'Christmas'),
      item('Photo book of Noah', 'Christmas', undefined, 'shelby'), item('Cozy slippers', 'Christmas'),
    ],
  },
]

export const LIST_ACTIVITY = [
  { who: 'shelby', text: 'Shelby added Diapers, size 1 and Greek yogurt from her phone', when: '3 min ago' },
  { who: 'daniel', text: 'Daniel added Coffee beans', when: 'This morning' },
  { who: 'shelby', text: 'Shelby checked off Bread, Butter and Apples', when: 'Yesterday' },
]

export const PHOTOS: Photo[] = [
  ['shelby', 'Nov 6', 1, 1, 1], ['daniel', 'Nov 5', 1, 1, 1], ['shelby', 'Nov 3', 0, 1, 1], ['shelby', 'Nov 1', 1, 1, 0],
  ['daniel', 'Oct 28', 0, 0, 1], ['shelby', 'Oct 26', 1, 0, 1], ['daniel', 'Oct 19', 0, 0, 0], ['shelby', 'Oct 14', 1, 0, 1],
  ['daniel', 'Oct 12', 0, 0, 1], ['shelby', 'Oct 4', 1, 0, 1], ['shelby', 'Sep 29', 0, 0, 0], ['daniel', 'Sep 21', 1, 0, 1],
].map(([who, when, noah, month, slide], i) => ({
  id: `p${i}`, who: who as string, when: when as string, ofNoah: !!noah, thisMonth: !!month, inSlideshow: !!slide, palette: i % 6,
}))

export const SETTINGS = {
  sleepStart: '10:00 PM',
  sleepEnd: '6:00 AM',
  idleMinutes: 5,
  slideSeconds: 20,
}
