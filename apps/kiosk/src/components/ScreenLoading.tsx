import { AppShell } from './AppShell'
import s from './ScreenLoading.module.css'

/** Suspense fallback for tab screens: the real sidebar plus an empty panel where the page will be. */
export function ScreenLoading() {
  return (
    <AppShell>
      <div role="status" aria-label="Loading" className={s.panel} />
    </AppShell>
  )
}
