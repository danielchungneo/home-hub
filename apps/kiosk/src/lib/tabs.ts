import type { ScreenId, ThemeColorToken } from '@hub/shared'

/**
 * Each hub tab owns a palette color. Drives the side nav chip and the
 * page wash while that screen is open. Not offered in member pickers —
 * these are room/section colors, not people. Settings uses system slate.
 */
export const TAB_COLOR: Record<ScreenId, ThemeColorToken> = {
  calendar: 'fjord',
  tasks: 'moss',
  rewards: 'honey',
  workout: 'pine',
  meals: 'clay',
  recipes: 'plum',
  lists: 'ocean',
  jukebox: 'berry',
  profiles: 'rose',
  settings: 'slate',
}
