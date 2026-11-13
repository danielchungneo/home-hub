import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorScreen'
import { queryClient } from './data/queryClient'
import './styles/base.css'

// Pi production build only — keep the cursor visible during local `pnpm dev`.
if (import.meta.env.PROD) document.documentElement.classList.add('hide-cursor')

// Visible through remote DevTools (chrome://inspect) on the Pi.
window.addEventListener('error', (e) => console.error('[hub] uncaught error', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => console.error('[hub] unhandled rejection', e.reason))

const root = createRoot(document.getElementById('root')!)

// Dev-only playground: isolated from ScreenId / sidebar / Supabase sign-in.
// Open http://localhost:5173/dev/blob-avatars while `pnpm dev:kiosk` is running.
const path = window.location.pathname.replace(/\/+$/, '') || '/'
if (path === '/dev/blob-avatars') {
  const BlobAvatars = lazy(() => import('./screens/dev/BlobAvatars'))
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <BlobAvatars />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
