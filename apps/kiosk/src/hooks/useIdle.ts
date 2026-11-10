import { useEffect, useRef, useState } from 'react'

/**
 * True after `minutes` without any touch, mouse or key input.
 * Uses one passive listener per event type and a single timeout.
 */
export function useIdle(minutes: number) {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number>()

  useEffect(() => {
    const ms = minutes * 60_000
    const reset = () => {
      setIdle(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setIdle(true), ms)
    }
    const events = ['pointerdown', 'keydown', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      window.clearTimeout(timer.current)
    }
  }, [minutes])

  return [idle, () => setIdle(true)] as const
}
