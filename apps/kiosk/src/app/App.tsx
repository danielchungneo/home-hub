import { useQueryClient } from '@tanstack/react-query'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary, ErrorScreen } from '../components/ErrorScreen'
import { ScreenLoading } from '../components/ScreenLoading'
import { SETTINGS } from '../data/mock'
import { useIdle } from '../hooks/useIdle'
import type { ScreenId } from '@hub/shared'
import { NavContext, type Nav, type PinRequest } from './nav'

// One chunk per screen: the Pi only parses what's on screen at first, then preloads the rest in the background.
const screenLoaders = {
  calendar: () => import('../screens/Calendar'),
  tasks: () => import('../screens/Tasks'),
  rewards: () => import('../screens/Rewards'),
  meals: () => import('../screens/Meals'),
  recipes: () => import('../screens/Recipes'),
  photos: () => import('../screens/Photos'),
  lists: () => import('../screens/Lists'),
  jukebox: () => import('../screens/jukebox/Jukebox'),
  settings: () => import('../screens/Settings'),
} satisfies Record<ScreenId, () => Promise<{ default: () => JSX.Element }>>

const loaders = {
  ...screenLoaders,
  cooking: () => import('../screens/Cooking'),
  idle: () => import('../screens/Idle'),
  sleep: () => import('../screens/Sleep'),
  pinDialog: () => import('../screens/PinDialog'),
}

/** Loaders that already ran (by navigation or preload), so the preloader skips them. */
const started = new Set<string>()
const track = <T,>(id: keyof typeof loaders, load: () => Promise<T>) => () => {
  started.add(id)
  return load()
}

const screens = Object.fromEntries(
  Object.entries(screenLoaders).map(([id, load]) => [id, lazy(track(id as ScreenId, load))]),
) as Record<ScreenId, React.LazyExoticComponent<() => JSX.Element>>
const Cooking = lazy(track('cooking', loaders.cooking))
const Idle = lazy(track('idle', loaders.idle))
const Sleep = lazy(track('sleep', loaders.sleep))
const PinDialog = lazy(track('pinDialog', loaders.pinDialog))

const PRELOAD_DELAY_MS = 2000
const PRELOAD_GAP_MS = 200

function whenIdle(fn: () => void) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout: 2000 })
  else window.setTimeout(fn, 0)
}

/** Dev helper: open http://localhost:5173/#rewards, #idle, #sleep, #cooking or #pin. */
function fromHash() {
  const h = window.location.hash.replace('#', '')
  return {
    screen: (h in screens ? h : h.startsWith('jukebox') ? 'jukebox' : 'tasks') as ScreenId,
    idle: h === 'idle',
    sleep: h === 'sleep',
    cooking: h === 'cooking' ? 'sheetpan' : null,
    pin: h === 'pin',
  }
}

export function App() {
  const queryClient = useQueryClient()
  const initial = useMemo(fromHash, [])
  const [screen, setScreen] = useState<ScreenId>(initial.screen)
  const [cooking, setCooking] = useState<string | null>(initial.cooking)
  const [pin, setPin] = useState<PinRequest | null>(
    initial.pin ? { title: 'To approve Shelby’s reward', detail: 'Uninterrupted nap · 120 points', onSuccess: () => {} } : null,
  )
  const [sleeping, setSleeping] = useState(initial.sleep)
  const [idle, forceIdle] = useIdle(SETTINGS.idleMinutes)
  const [slideshow, setSlideshow] = useState(initial.idle)
  const [signInError, setSignInError] = useState<Error | null>(null)
  const [signInAttempt, setSignInAttempt] = useState(0)

  // Any interaction ends a manually started slideshow too.
  useEffect(() => {
    if (!slideshow) return
    const end = () => setSlideshow(false)
    const t = window.setTimeout(() => window.addEventListener('pointerdown', end, { once: true }), 300)
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', end) }
  }, [slideshow])

  // Sign in, then once the first screen is up, warm the cache for Tasks, Rewards and Lists.
  // Supabase is imported dynamically so a missing env var shows the sign-in error instead of a white page.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { ensureSession } = await import('../lib/supabase')
        await ensureSession()
      } catch (err) {
        console.error('[hub] sign-in failed', err)
        if (!cancelled) setSignInError(err instanceof Error ? err : new Error(String(err)))
        return
      }
      await loaders[initial.screen]().catch(() => {})
      const { prefetchLiveScreens } = await import('../data/hooks')
      whenIdle(() => { if (!cancelled) void prefetchLiveScreens(queryClient) })
    })()
    return () => { cancelled = true }
  }, [queryClient, initial.screen, signInAttempt])

  // Preload every other chunk one at a time while the Pi is idle, so later taps don't wait on parsing.
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const queue = Object.entries(loaders) as [keyof typeof loaders, () => Promise<unknown>][]
    const step = () => {
      if (cancelled) return
      const next = queue.find(([id]) => !started.has(id))
      if (!next) return
      const [id, load] = next
      started.add(id)
      // Preload errors are ignored: the real navigation calls the loader again and surfaces them.
      void load().catch(() => {}).then(() => {
        if (!cancelled) timer = window.setTimeout(() => whenIdle(step), PRELOAD_GAP_MS)
      })
    }
    timer = window.setTimeout(() => whenIdle(step), PRELOAD_DELAY_MS)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  const nav: Nav = useMemo(() => ({
    screen,
    go: (s) => { setCooking(null); setScreen(s) },
    cook: (id) => setCooking(id),
    requirePin: (req) => setPin(req),
    sleep: () => setSleeping(true),
    showSlideshow: () => { forceIdle(); setSlideshow(true) },
  }), [screen, forceIdle])

  if (signInError) {
    return (
      <ErrorScreen
        title="Can't sign in to the hub"
        message="Check the internet connection."
        detail={signInError.message}
        actionLabel="Retry"
        onAction={() => { setSignInError(null); setSignInAttempt((n) => n + 1) }}
      />
    )
  }

  const Screen = screens[screen]

  return (
    <NavContext.Provider value={nav}>
      <ErrorBoundary>
        <Suspense fallback={<ScreenLoading />}>
          {cooking ? <Cooking recipeId={cooking} onExit={() => setCooking(null)} /> : <Screen />}
        </Suspense>
        <Suspense fallback={null}>
          {(idle || slideshow) && !sleeping && !cooking && <Idle />}
          {sleeping && <Sleep onWake={() => setSleeping(false)} />}
          {pin && <PinDialog request={pin} onClose={() => setPin(null)} />}
        </Suspense>
      </ErrorBoundary>
    </NavContext.Provider>
  )
}
