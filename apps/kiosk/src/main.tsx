import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
