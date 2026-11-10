// Turn Supabase rows into the shapes the screens were built against (see data/mock.ts).
import type {
  CalendarEvent, CalendarSource, Database, JukeboxFavorite, JukeboxState, LedgerEntry, ListItem, Member, NowPlaying, QueueItem, Redemption, Speaker,
} from '@hub/shared'
import type { IconName } from '../components/Icon'
import { weekday } from '../lib/format'
import type { Reward, ShoppingList, Task } from '../lib/types'

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
  color: r.color,
  earnsPoints: r.earns_points,
  routines: r.routine_filters,
})

export const toTask = (r: Row<'tasks'>): Task => ({
  id: r.id,
  memberId: r.member_id ?? HOME_ID,
  title: r.title,
  icon: icon(r.icon),
  routine: r.routine,
  points: r.points,
})

export const toReward = (r: Row<'rewards'>): Reward => ({
  id: r.id,
  title: r.title,
  cost: r.cost,
  icon: icon(r.icon),
  color: r.color,
})

export const toRedemption = (r: Row<'reward_redemptions'>): Redemption => ({
  id: r.id,
  memberId: r.member_id,
  rewardId: r.reward_id,
})

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
  color: r.color,
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

/** Map a cached Google event into the UI shape (day is offset from rangeStart). */
export function toCalendarEvent(r: Row<'events'>, rangeStart: Date, rangeEnd?: Date): CalendarEvent | null {
  const start = new Date(r.starts_at)
  const end = new Date(r.ends_at)
  const endBound = rangeEnd ? new Date(rangeEnd) : new Date(rangeStart)
  if (!rangeEnd) endBound.setDate(endBound.getDate() + 7)

  // Include events that intersect the requested range.
  if (end <= rangeStart || start >= endBound) return null

  const dayAnchor = start < rangeStart ? rangeStart : start
  const day = Math.max(0, Math.floor((dayAnchor.getTime() - rangeStart.getTime()) / 86_400_000))

  return {
    id: r.id,
    title: r.title,
    day,
    start: r.all_day ? 0 : decimalHour(start),
    end: r.all_day ? 0 : Math.max(decimalHour(start) + 0.25, decimalHour(end)),
    who: r.member_id ?? FAMILY_WHO,
    allDay: r.all_day,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  }
}

export const toCalendarSource = (r: Row<'calendar_sources'>): CalendarSource => ({
  id: r.id,
  name: r.name,
  externalId: r.external_id,
  memberId: r.member_id,
  color: r.color ?? undefined,
  enabled: r.enabled,
  accountKey: r.account_email ?? undefined,
  lastSyncedAt: r.last_synced_at ?? undefined,
})
