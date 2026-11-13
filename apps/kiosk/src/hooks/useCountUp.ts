import { useEffect, useRef, useState } from 'react'

/**
 * Counts a number toward `value` in 12 eased steps (~660ms) whenever it changes.
 * Starts from `from` on first mount. One setState per step; no rAF loop left running.
 */
export function useCountUp(value: number, from = 0, steps = 12, stepMs = 55) {
  const [shown, setShown] = useState(from)
  const shownRef = useRef(from)
  useEffect(() => {
    const start = shownRef.current
    if (start === value) return
    const timers: number[] = []
    for (let i = 1; i <= steps; i++) {
      timers.push(window.setTimeout(() => {
        const v = Math.round(start + (value - start) * (1 - Math.pow(1 - i / steps, 3)))
        shownRef.current = v
        setShown(v)
      }, i * stepMs))
    }
    return () => timers.forEach(window.clearTimeout)
  }, [value, steps, stepMs])
  return shown
}
