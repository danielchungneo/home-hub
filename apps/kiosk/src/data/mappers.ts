// Turn Supabase rows into the shapes the screens use.
import {
  coerceMemberColor,
  isMemberColorPreset,
  normalizePersonColor,
  normalizeRecipeTags,
  type Activity, type ActivityKind, type AthleteProfile, type CalendarEvent, type CalendarSource, type CardioKind, type CoachDirection, type CoachPlan, type Course, type Database, type Feel, type FoodPhoto, type Ingredient, type JukeboxFavorite, type JukeboxState, type Json, type LedgerEntry, type ListItem, type Member, type MemberColor, type NowPlaying, type QueueItem, type RecipeStep, type Redemption, type RewardAisle, type RewardDeal, type Speaker,
} from '@hub/shared'
import type { IconName } from '../components/Icon'
import { weekday } from '../lib/format'
import type { Bounty, Recipe as KioskRecipe, Reward, ShoppingList, Task, TaskTemplate } from '../lib/types'

type Tables = Database['public']['Tables']
type Row<T extends keyof Tables> = Tables[T]['Row']

/** Tasks with no member belong to the shared Home column. */
export const HOME_ID = 'home'

// Icon names are free text in the database; unknown names render as an empty tile.
const icon = (name: string | null) => (name ?? 'check') as IconName

export const toMember = (r: Row<'members'>): Member => ({
  id: r.id,
  name: r.name,
  initial: r.name.charAt(0).toUpperCase(),
  role: r.role,
  roleLabel: r.role_label ?? (r.role === 'parent' ? 'Parent' : 'Child'),
  color: normalizePersonColor(r.color, 'plum'),
  avatar: r.avatar?.trim() || 'pebble',
  earnsPoints: r.earns_points,
  active: r.active,
})

/** Map a v2 tasks row (template_id + schedule columns) into the UI Task shape. */
export const toTask = (r: Row<'tasks'>): Task => {
  const frequency = (r.frequency ?? 'daily') as Task['frequency']
  let schedule: Task['schedule']
  if (frequency === 'daily') {
    schedule = r.once_on
      ? { kind: 'once', date: r.once_on }
      : { kind: 'days', days: r.days ?? [0, 1, 2, 3, 4, 5, 6] }
  } else if (r.week_of != null || r.bounty_id != null) {
    schedule = { kind: 'thisWeek', dueDay: r.due_day ?? 6 }
  } else {
    schedule = { kind: 'weekly', every: (r.every_weeks === 2 ? 2 : 1), dueDay: r.due_day ?? 6 }
  }
  return {
    id: r.id,
    templateId: r.template_id!,
    memberId: r.member_id ?? HOME_ID,
    frequency,
    schedule,
    points: r.points,
    bountyId: r.bounty_id ?? undefined,
  }
}

export const toTaskTemplate = (r: Row<'task_templates'>): TaskTemplate => ({
  id: r.id,
  title: r.title,
  icon: icon(r.icon),
  points: r.points,
  frequency: r.frequency,
  uses: r.uses,
})

export const toBounty = (r: Row<'bounties'>): Bounty => ({
  id: r.id,
  templateId: r.template_id,
  points: r.points,
  dueDay: r.due_day,
  claimedBy: r.claimed_by,
})

export const toReward = (r: Row<'rewards'>): Reward => ({
  id: r.id,
  title: r.title,
  cost: r.cost,
  icon: icon(r.icon),
  color: coerceMemberColor(r.color),
  aisle: r.aisle as RewardAisle,
  blurb: r.blurb,
})

export const toRedemption = (r: Row<'reward_redemptions'>): Redemption => ({
  id: r.id,
  memberId: r.member_id,
  rewardId: r.reward_id,
  cost: r.cost,
})

export const toRewardDeal = (r: Row<'reward_deals'>, now = new Date()): RewardDeal => ({
  rewardId: r.reward_id,
  cost: r.cost,
  ends: weekdayName(r.ends_on, now),
})

/** "Sunday" etc. for deal copy; falls back to the ISO date. */
function weekdayName(isoDate: string, now = new Date()): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return isoDate
  // Keep "ends Sunday" stable relative to local kiosk time.
  void now
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export const toLedgerEntry = (r: Row<'points_ledger'>, now = new Date()): LedgerEntry => ({
  id: r.id,
  memberId: r.member_id,
  delta: r.delta,
  reason: r.reason,
  when: relativeDay(new Date(r.created_at), now),
})

export const toListItem = (r: Row<'list_items'>): ListItem => ({
  id: r.id,
  text: r.text,
  qty: r.quantity ?? undefined,
  category: r.category ?? 'Other',
  assignee: r.assignee_id ?? undefined,
  checked: r.checked_at !== null,
})

export const toList = (r: Row<'lists'> & { list_items: Row<'list_items'>[] }): ShoppingList => ({
  id: r.id,
  name: r.name,
  icon: icon(r.icon),
  color: coerceMemberColor(r.color),
  items: r.list_items.map(toListItem),
})

export const toSpeaker = (r: Row<'speakers'>): Speaker => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  available: r.available,
  isGroup: r.is_group,
  provider: r.provider,
})

export const toFavorite = (r: Row<'jukebox_favorites'>): JukeboxFavorite => ({
  id: r.id,
  spotifyUri: r.uri,
  kind: r.kind,
  title: r.title,
  subtitle: r.subtitle ?? '',
  albumTitle: r.album_title ?? undefined,
  imageUrl: r.image_url ?? undefined,
  durationMs: r.duration_ms ?? undefined,
  trackCount: r.track_count ?? undefined,
  isOwned: r.is_owned ?? undefined,
  sortOrder: r.sort_order,
  addedBy: r.added_by ?? undefined,
  addedAt: r.created_at,
})

export const toQueueItem = (r: Row<'jukebox_queue'>): QueueItem => ({
  id: r.id,
  position: r.position,
  spotifyUri: r.spotify_uri,
  title: r.title,
  subtitle: r.subtitle ?? '',
  imageUrl: r.image_url ?? undefined,
  durationMs: r.duration_ms ?? undefined,
})

function toRecent(raw: unknown): JukeboxState['recent'] {
  if (!Array.isArray(raw)) return []
  const out: JukeboxState['recent'] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.uri !== 'string' || typeof o.title !== 'string') continue
    if (o.kind !== 'album' && o.kind !== 'playlist') continue
    out.push({
      uri: o.uri,
      kind: o.kind,
      title: o.title,
      subtitle: typeof o.subtitle === 'string' ? o.subtitle : undefined,
      imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : undefined,
    })
  }
  return out
}

export const toJukeboxState = (r: Row<'jukebox_state'> | null): JukeboxState => {
  if (!r) {
    return {
      speakerId: null,
      isPlaying: false,
      volume: 40,
      progressMs: 0,
      durationMs: 0,
      nowPlaying: null,
      shuffle: false,
      repeat: 'off',
      recent: [],
    }
  }
  const np = r.now_playing as Partial<NowPlaying> | null
  const nowPlaying =
    np && typeof np === 'object' && typeof np.title === 'string'
      ? {
          title: np.title,
          artist: typeof np.artist === 'string' ? np.artist : '',
          album: typeof np.album === 'string' ? np.album : undefined,
          imageUrl: typeof np.imageUrl === 'string' ? np.imageUrl : undefined,
          uri: typeof np.uri === 'string' ? np.uri : undefined,
          contextUri: typeof np.contextUri === 'string' ? np.contextUri : undefined,
          contextName: typeof np.contextName === 'string' ? np.contextName : undefined,
        }
      : null
  const repeat = r.repeat === 'track' || r.repeat === 'context' || r.repeat === 'off' ? r.repeat : 'off'
  return {
    speakerId: r.speaker_id,
    isPlaying: r.is_playing,
    volume: r.volume,
    progressMs: r.progress_ms,
    durationMs: r.duration_ms,
    nowPlaying,
    shuffle: r.shuffle,
    repeat,
    recent: toRecent(r.recent),
  }
}

/** "Today", a weekday name within the last six days, otherwise "Last week" (the Rewards screen keys off it). */
export function relativeDay(d: Date, now: Date) {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff < 7) return weekday(d)
  return 'Last week'
}

/** Local calendar date as YYYY-MM-DD, matching task_completions.for_date. */
export function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const FAMILY_WHO = 'family'

function decimalHour(d: Date) {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
}

/** Local calendar date as YYYY-MM-DD. */
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole local days between two YYYY-MM-DD keys (noon anchors avoid DST slips). */
function daysBetweenKeys(fromKey: string, toKey: string) {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const from = new Date(fy!, fm! - 1, fd!, 12, 0, 0)
  const to = new Date(ty!, tm! - 1, td!, 12, 0, 0)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Map a cached Google event into the UI shape (day is offset from rangeStart). */
export function toCalendarEvent(r: Row<'events'>, rangeStart: Date, rangeEnd?: Date): CalendarEvent | null {
  const start = new Date(r.starts_at)
  const end = new Date(r.ends_at)
  const endBound = rangeEnd ? new Date(rangeEnd) : new Date(rangeStart)
  if (!rangeEnd) endBound.setDate(endBound.getDate() + 7)

  // Optional columns the sync job can add later (location → where, description → note, travel_min).
  const extra = r as Row<'events'> & {
    location?: string | null
    description?: string | null
    travel_min?: number | null
  }
  const where = extra.location?.trim() || undefined
  const note = extra.description?.trim().split(/\r?\n/)[0]?.trim() || undefined
  const travelMin = typeof extra.travel_min === 'number' && extra.travel_min > 0 ? extra.travel_min : undefined

  // All-day events are stored as UTC calendar-date bounds (…T00:00:00.000Z). Interpreting
  // those as local Date instants shifts them a day earlier in US timezones — use the date
  // keys Google meant, not the local wall clock.
  if (r.all_day) {
    const startKey = r.starts_at.slice(0, 10)
    const endKey = r.ends_at.slice(0, 10)
    const rangeStartKey = localDateKey(rangeStart)
    const rangeEndKey = localDateKey(endBound) // exclusive
    if (endKey < rangeStartKey || startKey >= rangeEndKey) return null

    const firstVisibleKey = startKey < rangeStartKey ? rangeStartKey : startKey
    const day = Math.max(0, daysBetweenKeys(rangeStartKey, firstVisibleKey))

    return {
      id: r.id,
      title: r.title,
      day,
      start: 0,
      end: 0,
      who: r.member_id ?? FAMILY_WHO,
      allDay: true,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      where,
      note,
      travelMin,
    }
  }

  // Timed events: include anything that intersects the requested range.
  if (end <= rangeStart || start >= endBound) return null

  const dayAnchor = start < rangeStart ? rangeStart : start
  const day = Math.max(0, Math.floor((dayAnchor.getTime() - rangeStart.getTime()) / 86_400_000))

  return {
    id: r.id,
    title: r.title,
    day,
    start: decimalHour(start),
    end: Math.max(decimalHour(start) + 0.25, decimalHour(end)),
    who: r.member_id ?? FAMILY_WHO,
    allDay: false,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    where,
    note,
    travelMin,
  }
}

export const toCalendarSource = (r: Row<'calendar_sources'>): CalendarSource => ({
  id: r.id,
  name: r.name,
  externalId: r.external_id,
  memberId: r.member_id,
  color: r.color ? coerceMemberColor(r.color) : undefined,
  enabled: r.enabled,
  accountKey: r.account_email ?? undefined,
  lastSyncedAt: r.last_synced_at ?? undefined,
})

function asIngredients(value: Row<'recipes'>['ingredients']): Ingredient[] {
  if (!Array.isArray(value)) return []
  return value.map((raw) => {
    const i = (raw ?? {}) as Partial<Ingredient>
    return {
      qty: typeof i.qty === 'number' ? i.qty : Number(i.qty) || 0,
      unit: String(i.unit ?? ''),
      name: String(i.name ?? '').trim(),
    }
  }).filter((i) => i.name)
}

function asSteps(value: Row<'recipes'>['steps']): RecipeStep[] {
  if (!Array.isArray(value)) return []
  return value.map((raw) => {
    const s = (raw ?? {}) as Partial<RecipeStep>
    return {
      text: String(s.text ?? '').trim(),
      tip: s.tip ? String(s.tip) : undefined,
      timerMin: typeof s.timerMin === 'number' ? s.timerMin : undefined,
      uses: Array.isArray(s.uses) ? s.uses.map(String) : undefined,
    }
  }).filter((s) => s.text)
}

/** Placeholder plate colors until a real photo lands — content hex like album art swatches. */
const PHOTO_PALETTE: Record<MemberColor, FoodPhoto['palette']> = {
  clay: ['#F3E7DF', '#C27A4E', '#E9A27E', '#55623F'],
  honey: ['#F4ECDA', '#E9B566', '#C29A55', '#F6E6BE'],
  moss: ['#E9EDE1', '#F4D58D', '#6B7A55', '#F6E6BE'],
  fjord: ['#E4EAEE', '#7D513C', '#E9A27E', '#C29A55'],
  plum: ['#EDE6F0', '#C29A55', '#5A4128', '#E9B566'],
  pine: ['#E2EBE5', '#3F5E4A', '#F4D58D', '#6B7A55'],
  berry: ['#F0E4E8', '#7A4555', '#E9A27E', '#C29A55'],
  sand: ['#F2EBE0', '#8A6F4B', '#E9B566', '#F6E6BE'],
  ocean: ['#E2ECEB', '#3E6B6A', '#7D513C', '#C29A55'],
  rose: ['#F1E6E6', '#8B5E5E', '#E9A27E', '#F4D58D'],
}

/** Derive course until `recipes.course` exists; map meal tags onto Breakfast / Dinner / Sweets. */
export function courseFromTags(tags: string[]): Course {
  if (tags.includes('Dessert') || tags.includes('Sweets')) return 'Sweets'
  if (tags.includes('Breakfast')) return 'Breakfast'
  return 'Dinner'
}

export const toRecipe = (r: Row<'recipes'>, imageUrl?: string | null): KioskRecipe => {
  const tags = normalizeRecipeTags(r.tags, { prepMin: r.prep_min, cookMin: r.cook_min })
  const row = r as Row<'recipes'> & { course?: Course | null; source?: string | null }
  const course = row.course && ['Breakfast', 'Dinner', 'Sweets'].includes(row.course)
    ? row.course
    : courseFromTags(tags)
  const photo: FoodPhoto = {
    url: imageUrl ?? undefined,
    palette: (isMemberColorPreset(r.color) ? PHOTO_PALETTE[r.color] : undefined) ?? PHOTO_PALETTE.fjord,
  }
  return {
    id: r.id,
    title: r.title,
    icon: icon(r.icon),
    color: coerceMemberColor(r.color),
    course,
    photo,
    favorite: r.favorite,
    from: row.source ?? undefined,
    prepMin: r.prep_min,
    cookMin: r.cook_min,
    servings: r.servings,
    tags,
    ingredients: asIngredients(r.ingredients),
    steps: asSteps(r.steps),
    imagePath: r.image_path,
    imageUrl: imageUrl ?? undefined,
    sourceUrl: r.source_url,
  }
}

export type MealPlanRow = {
  id: string
  date: string
  slot: Database['public']['Enums']['meal_slot']
  recipeId: string | null
  title: string | null
}

export const toMealPlanRow = (r: Row<'meal_plan'>): MealPlanRow => ({
  id: r.id,
  date: r.date,
  slot: r.slot,
  recipeId: r.recipe_id,
  title: r.title,
})

const asCardioKind = (v: unknown): CardioKind =>
  v === 'run' || v === 'walk' || v === 'bike' || v === 'swim' ? v : 'walk'

export const toAthleteProfile = (r: Row<'athlete_profiles'>): AthleteProfile => ({
  memberId: r.member_id,
  coachEnabled: r.coach_enabled,
  goals: r.goals ?? undefined,
  daysPerWeek: r.days_per_week ?? 4,
  preferredCardio: (r.preferred_cardio ?? ['run', 'walk']).map(asCardioKind),
  equipment: r.equipment ?? [],
  limitations: r.limitations ?? undefined,
  easyPace: r.easy_pace ?? undefined,
})

export const toActivity = (r: Row<'activities'>): Activity => ({
  id: r.id,
  memberId: r.member_id,
  date: r.date,
  kind: r.kind as ActivityKind,
  title: r.title,
  minutes: r.minutes,
  distanceMi: r.distance_mi == null ? undefined : Number(r.distance_mi),
  source: r.source as Activity['source'],
  feel: (r.feel as Feel | null) ?? undefined,
  planPart: (r.plan_part as Activity['planPart'] | null) ?? undefined,
})

export const toCoachPlan = (memberId: string, date: string, plan: Json, direction?: string | null): CoachPlan => {
  const p = (plan && typeof plan === 'object' && !Array.isArray(plan) ? plan : {}) as Record<string, unknown>
  const cardio = (p.cardio ?? {}) as Record<string, unknown>
  const strength = (p.strength ?? {}) as Record<string, unknown>
  const exercises = Array.isArray(strength.exercises) ? strength.exercises : []
  return {
    memberId,
    date,
    note: String(p.note ?? ''),
    readiness: p.readiness === 'fresh' || p.readiness === 'tired' ? p.readiness : 'steady',
    direction: (direction ?? p.direction) as CoachDirection | undefined,
    basedOn: String(p.basedOn ?? ''),
    restDay: Boolean(p.restDay),
    cardio: {
      kind: asCardioKind(cardio.kind),
      title: String(cardio.title ?? 'Cardio'),
      minutes: Number(cardio.minutes) || 20,
      distanceMi: cardio.distanceMi == null ? undefined : Number(cardio.distanceMi),
      effort: String(cardio.effort ?? 'Easy'),
      target: cardio.target == null ? undefined : String(cardio.target),
      why: String(cardio.why ?? ''),
      points: Number(cardio.points) || 15,
    },
    strength: {
      title: String(strength.title ?? 'Strength'),
      focus: String(strength.focus ?? 'Full body'),
      minutes: Number(strength.minutes) || 20,
      rounds: Number(strength.rounds) || 2,
      why: String(strength.why ?? ''),
      points: Number(strength.points) || 20,
      exercises: exercises.map((e) => {
        const ex = (e ?? {}) as Record<string, unknown>
        return {
          name: String(ex.name ?? 'Move'),
          sets: Number(ex.sets) || 1,
          reps: ex.reps == null ? undefined : Number(ex.reps),
          seconds: ex.seconds == null ? undefined : Number(ex.seconds),
          restSec: Number(ex.restSec) || 45,
          cue: String(ex.cue ?? ''),
        }
      }),
    },
  }
}
