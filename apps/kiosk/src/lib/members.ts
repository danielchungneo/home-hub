import { SYSTEM_COLOR } from '@hub/shared'
import type { Member } from '@hub/shared'
import { queryClient } from '../data/queryClient'

export interface Who {
  id: string
  name: string
  initial: string
  /** Named token (incl. system `slate`) or custom `#RRGGBB`. */
  color: string
  /** Blob character id; defaults to pebble for Home/Family and unknowns. */
  avatar: string
}

/** Shared Home column (tasks with no member_id). */
export const HOME_COLUMN: Member = {
  id: 'home',
  name: 'Home',
  initial: 'H',
  role: 'parent',
  roleLabel: 'Everyone',
  color: SYSTEM_COLOR,
  avatar: 'pebble',
  earnsPoints: false,
  active: true,
}

/** Calendar "who" when a source isn't assigned to a person. */
export const FAMILY: Who = {
  id: 'family',
  name: 'Family',
  initial: 'F',
  color: SYSTEM_COLOR,
  avatar: 'pebble',
}

const STATIC: Who[] = [HOME_COLUMN, FAMILY]

/** Look up a member, the Home column, or Family by id. Live members come from the cached members query. */
export function who(id: string): Who {
  const live = queryClient.getQueryData<Member[]>(['members']) ?? []
  const hit = live.find((m) => m.id === id) ?? STATIC.find((m) => m.id === id)
  if (hit) {
    return {
      id: hit.id,
      name: hit.name,
      initial: hit.initial,
      color: hit.color,
      avatar: hit.avatar || 'pebble',
    }
  }
  return { id, name: id, initial: id[0]?.toUpperCase() ?? '?', color: SYSTEM_COLOR, avatar: 'pebble' }
}
