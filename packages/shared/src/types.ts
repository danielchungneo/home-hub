// Shapes the UI works with. They mirror the Supabase tables in the design doc (§8)
// so mock data can be swapped for real queries without touching screens.
// Icon-bearing types take the app's icon-name union as `I`; it defaults to string
// so this package stays independent of any one app's icon set.

import type { MemberColor } from './colors'

export type ScreenId =
  | 'calendar' | 'tasks' | 'rewards' | 'meals' | 'recipes'
  | 'lists' | 'jukebox' | 'profiles' | 'settings'

/**
 * Blob character id stored on `members.avatar`. Validated in the kiosk against
 * the BlobAvatar registry; unknown values fall back to pebble at render time.
 */
export type MemberAvatarId = string

export interface Member {
  id: string
  name: string
  initial: string
  role: 'parent' | 'child'
  roleLabel: string
  /**
   * Named preset (see `MemberColor`) or custom `#RRGGBB`.
   * Never `slate` — that token is reserved for Family / Home / Up for grabs.
   */
  color: string
  /** Blob character id, e.g. "pebble". Defaults to pebble when unset in the DB. */
  avatar: MemberAvatarId
  earnsPoints: boolean
  /** False hides them from rails and pickers; history stays. */
  active: boolean
}

// ---------- Tasks (see docs/TASKS.md) ----------

export type Frequency = 'daily' | 'weekly'

/** task_templates: the reusable library the Add sheet picks from. */
export interface TaskTemplate<I extends string = string> {
  id: string
  title: string
  icon: I
  /** Default points; a task can override. */
  points: number
  /** Whether it's usually a daily or a weekly task. */
  frequency: Frequency
  /** How many times it's been picked; sorts the library. */
  uses: number
}

/** When a task shows up. Days are 0 = Sunday … 6 = Saturday. */
export type Schedule =
  | { kind: 'days'; days: number[] }                 // daily, on these weekdays
  | { kind: 'once'; date: string }                   // daily, one day only (yyyy-mm-dd)
  | { kind: 'weekly'; every: 1 | 2; dueDay: number } // weekly, due by dueDay
  | { kind: 'thisWeek'; dueDay: number }             // weekly, this week only

/** tasks: one template assigned to one person on a schedule. */
export interface Task {
  id: string
  templateId: string
  memberId: string
  frequency: Frequency
  schedule: Schedule
  points: number
  /** Set when the task came from claiming a bounty. */
  bountyId?: string
}

/** bounties: up-for-grabs tasks. Whoever claims it does it and gets the points. */
export interface Bounty {
  id: string
  templateId: string
  points: number
  /** Due by this weekday; null = any time this week. */
  dueDay: number | null
  claimedBy: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  /** 0 = Sunday of the current week */
  day: number
  /** decimal hours, e.g. 13.5 = 1:30 PM */
  start: number
  end: number
  who: string // member id or 'family'
  allDay?: boolean
  /** Absolute start (ISO); used by Idle / range filters. */
  startsAt?: string
  endsAt?: string
  /** Shown in event details and the Up next card (from Google location). */
  where?: string
  /** Minutes of travel; shows "Leave by …" (from sync-job cache). */
  travelMin?: number
  /** One-line note (from Google description). */
  note?: string
  /** Repeats every week (mock only: real recurring events arrive expanded). */
  weekly?: boolean
}

/** A big day the family is counting down to ("Thanksgiving · 16 days"). */
export interface Countdown { id: string; title: string; date: string; color: MemberColor }

export type WeatherKind = 'sunny' | 'cloudy' | 'rainy'
export interface DayWeather { kind: WeatherKind; high: number }

/** One Google calendar linked for the household. */
export interface CalendarSource {
  id: string
  name: string
  externalId: string
  memberId: string | null
  color?: MemberColor
  enabled: boolean
  accountKey?: string
  lastSyncedAt?: string
}

export type RewardAisle = 'Treats' | 'Time off' | 'Family fun'

export interface Reward<I extends string = string> {
  id: string
  title: string
  /** Price in stars. */
  cost: number
  icon: I
  color: MemberColor
  aisle: RewardAisle
  /** One line for the product sheet. */
  blurb: string
}

/** A weekly discount on one reward. */
export interface RewardDeal {
  rewardId: string
  cost: number
  ends: string
}

export interface LedgerEntry {
  id: string
  memberId: string
  delta: number
  reason: string
  when: string
}

/** A purchase waiting for the other parent. Stars are held (already in the ledger) until approved or denied. */
export interface Redemption {
  id: string
  memberId: string
  rewardId: string
  /** What was paid, so a deal price is refunded correctly. */
  cost: number
}

export interface Ingredient {
  qty: number // 0 = to taste
  unit: string
  name: string
}

export interface RecipeStep {
  text: string
  tip?: string
  timerMin?: number
  uses?: string[]
}

export type Course = 'Breakfast' | 'Dinner' | 'Sweets'

/** Recipe photo. `url` is the resized image in Supabase Storage; `palette` draws a placeholder plate until then. */
export interface FoodPhoto {
  url?: string
  /** [table, food 1, food 2, food 3] */
  palette: [string, string, string, string]
}

export interface Recipe<I extends string = string> {
  id: string
  title: string
  icon: I
  color: MemberColor
  course: Course
  photo: FoodPhoto
  favorite?: boolean
  /** Where the recipe came from, shown in italics on the card ("From Grandma's recipe box"). */
  from?: string
  prepMin: number
  cookMin: number
  servings: number
  tags: string[]
  ingredients: Ingredient[]
  steps: RecipeStep[]
  imageUrl?: string
  imagePath?: string | null
  sourceUrl?: string | null
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealEntry = { recipeId: string } | { text: string } | null

/** Kiosk sleep / PIN / weather preferences (one row per household). */
export interface HouseholdSettings {
  householdId: string
  sleepStart: string
  sleepEnd: string
  idleMinutes: number
  slideSeconds: number
  weatherUnits: 'f' | 'c'
  locationLabel: string | null
  locationZip: string | null
  pinProtectRewards: boolean
  pinProtectSettings: boolean
  pinProtectDeletes: boolean
  pinLockMinutes: number
}

export interface ListItem {
  id: string
  text: string
  qty?: string
  category: string
  assignee?: string
  checked: boolean
}

export interface ShoppingList<I extends string = string> {
  id: string
  name: string
  icon: I
  color: MemberColor
  items: ListItem[]
  /** One-tap "Usually on it" chips: things that often end up on this list. */
  usual?: { text: string; category: string }[]
}

export interface Speaker {
  id: string
  name: string
  kind: string
  available: boolean
  isGroup?: boolean
  provider?: 'spotify_connect' | 'cast' | 'alexa'
}

export interface NowPlaying {
  title: string
  artist: string
  album?: string
  imageUrl?: string
  uri?: string
  contextUri?: string
  contextName?: string
}

/** Recently played album/playlist for Jump back in. */
export interface RecentCollection {
  uri: string
  kind: 'album' | 'playlist'
  title: string
  subtitle?: string
  imageUrl?: string
}

export type RepeatMode = 'off' | 'track' | 'context'

export interface JukeboxState {
  speakerId: string | null
  isPlaying: boolean
  volume: number
  progressMs: number
  durationMs: number
  nowPlaying: NowPlaying | null
  shuffle: boolean
  repeat: RepeatMode
  recent: RecentCollection[]
}

// ---------- Jukebox v2 (Spotify favorites; see docs/JUKEBOX.md) ----------

export type MediaKind = 'track' | 'album' | 'playlist'

/** Placeholder artwork drawn until a real Spotify image URL is available. */
export interface ArtSwatch { bg: string; fg: string; cx: number; cy: number; r: number; band: number }

export interface Artwork {
  /** Spotify image URL (i.scdn.co), saved on the favorite row when it was favorited. */
  url?: string
  /** Fallback colors; also used to tint the Now playing screen. */
  swatch: ArtSwatch
}

export interface Track {
  uri: string // spotify:track:…
  title: string
  artist: string
  album: string
  durationMs: number
  art: Artwork
}

export interface Collection {
  uri: string // spotify:album:… or spotify:playlist:…
  kind: 'album' | 'playlist'
  title: string
  /** Album artist, or playlist owner / description. */
  subtitle: string
  art: Artwork
  /** Empty when Spotify only returns metadata (playlists you don't own). */
  trackUris: string[]
  trackCount?: number
  speakerId?: string
}

/** One row of jukebox_favorites. Songs / Playlists / Albums tabs only show these. */
export interface JukeboxFavorite {
  id: string
  spotifyUri: string
  kind: MediaKind
  title: string
  subtitle: string
  albumTitle?: string
  imageUrl?: string
  durationMs?: number
  trackCount?: number
  isOwned?: boolean
  sortOrder: number
  addedBy?: string
  addedAt: string
}

/** One row of jukebox_queue (app-owned Up next). */
export interface QueueItem {
  id: string
  position: number
  spotifyUri: string
  title: string
  subtitle: string
  imageUrl?: string
  durationMs?: number
}

/** Spotify search hit from the music-agent (metadata enough to favorite without another call). */
export interface SearchHit {
  kind: MediaKind
  uri: string
  title: string
  subtitle: string
  album?: string
  imageUrl?: string
  durationMs?: number
  trackCount?: number
  owned?: boolean
}

export interface Photo {
  id: string
  who: string
  when: string
  ofNoah: boolean
  thisMonth: boolean
  inSlideshow: boolean
  palette: number
}
