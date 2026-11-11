import { FAMILY, HOME_COLUMN, MEMBERS } from '../data/mock'
import { queryClient } from '../data/queryClient'
import type { Member, MemberColor } from '@hub/shared'

export interface Who {
  id: string
  name: string
  initial: string
  color: MemberColor
}

// Mock members stay in the lookup for screens that still read mock data (Calendar, …).
const STATIC: Who[] = [...MEMBERS, HOME_COLUMN, FAMILY]

/** Look up a member, the Home column, or Family by id. Real members come from the cached members query. */
export function who(id: string): Who {
  const live = queryClient.getQueryData<Member[]>(['members']) ?? []
  return (
    live.find((m) => m.id === id) ??
    STATIC.find((m) => m.id === id) ?? { id, name: id, initial: id[0]?.toUpperCase() ?? '?', color: 'fjord' }
  )
}
