import { useEffect, useState } from 'react'

/**
 * Current time, re-rendering once per minute on the minute.
 * One shared timer would be even cheaper; this is fine for a handful of users.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let interval: number | undefined
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    const timeout = window.setTimeout(() => {
      setNow(new Date())
      interval = window.setInterval(() => setNow(new Date()), 60_000)
    }, msToNextMinute)
    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [])
  return now
}
