import { createContext, useContext } from 'react'
import type { ScreenId } from '@hub/shared'

export interface PinRequest {
  title: string
  detail?: string
  /** Called after a correct PIN (or after captureOnly accepts four digits). */
  onSuccess: (pin?: string) => void
  /** Skip verify — collect four digits and pass them to onSuccess (used to set a new PIN). */
  captureOnly?: boolean
}

export interface Nav {
  screen: ScreenId
  go: (screen: ScreenId) => void
  /** Full-screen cooking mode for a recipe. */
  cook: (recipeId: string) => void
  /** Ask for the parent PIN, then run onSuccess. */
  requirePin: (req: PinRequest) => void
  /** Settings stay unlocked until this timestamp (ms). */
  settingsUnlockedUntil: number
  markSettingsUnlocked: (until: number) => void
  sleep: () => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav() {
  const nav = useContext(NavContext)
  if (!nav) throw new Error('useNav must be used inside <NavContext.Provider>')
  return nav
}
