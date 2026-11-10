import { createContext, useContext } from 'react'
import type { ScreenId } from '@hub/shared'

export interface PinRequest {
  title: string
  detail?: string
  onSuccess: () => void
}

export interface Nav {
  screen: ScreenId
  go: (screen: ScreenId) => void
  /** Full-screen cooking mode for a recipe. */
  cook: (recipeId: string) => void
  /** Ask for the parent PIN, then run onSuccess. */
  requirePin: (req: PinRequest) => void
  sleep: () => void
  showSlideshow: () => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav() {
  const nav = useContext(NavContext)
  if (!nav) throw new Error('useNav must be used inside <NavContext.Provider>')
  return nav
}
