// Shapes the UI works with. They mirror the Supabase tables in the design doc (§8)
// so mock data can be swapped for real queries without touching screens.
// Icon-bearing types take the app's icon-name union as `I`; it defaults to string
// so this package stays independent of any one app's icon set.

export type MemberColor = 'moss' | 'clay' | 'honey' | 'fjord' | 'plum'
export type Routine = 'morning' | 'afternoon' | 'evening' | 'chores'
export type ScreenId =
  | 'calendar' | 'tasks' | 'rewards' | 'meals' | 'recipes'
  | 'photos' | 'lists' | 'jukebox' | 'settings'

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

export interface Recipe<I extends string = string> {
  id: string
  title: string
  icon: I
  color: MemberColor
  prepMin: number
  cookMin: number
  servings: number
  tags: string[]
  ingredients: Ingredient[]
  steps: { text: string; tip?: string; timerMin?: number; uses?: string[] }[]
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealEntry = { recipeId: string } | { text: string } | null

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

export interface JukeboxState {
  speakerId: string | null
  isPlaying: boolean
  volume: number
  progressMs: number
  durationMs: number
  nowPlaying: NowPlaying | null
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
