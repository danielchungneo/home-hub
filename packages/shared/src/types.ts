// Shapes the UI works with. They mirror the Supabase tables in the design doc (§8)
// so mock data can be swapped for real queries without touching screens.
// Icon-bearing types take the app's icon-name union as `I`; it defaults to string
// so this package stays independent of any one app's icon set.

export type MemberColor = 'moss' | 'clay' | 'honey' | 'fjord' | 'plum'
export type Routine = 'morning' | 'afternoon' | 'evening' | 'chores'
export type ScreenId =
  | 'calendar' | 'tasks' | 'rewards' | 'meals' | 'recipes'
  | 'lists' | 'jukebox' | 'settings'

export interface Member {
  id: string
  name: string
  initial: string
  role: 'parent' | 'child'
  roleLabel: string
  color: MemberColor
  earnsPoints: boolean
  routines: Routine[]
}

export interface Task<I extends string = string> {
  id: string
  memberId: string // a member id, or 'home' for shared chores
  title: string
  icon: I
  routine: Routine
  points: number
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
}

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

export interface Reward<I extends string = string> {
  id: string
  title: string
  cost: number
  icon: I
  color: MemberColor
}

export interface LedgerEntry {
  id: string
  memberId: string
  delta: number
  reason: string
  when: string
}

export interface Redemption {
  id: string
  memberId: string
  rewardId: string
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
