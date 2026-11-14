import { QueryClient } from '@tanstack/react-query'

// Realtime invalidates queries when rows change, so cached data can stay fresh for a while.
// The kiosk never closes and its data is small, so nothing is garbage-collected: going back to a
// tab shows the cached rows right away and a stale query refetches in the background instead
// of showing a loading state.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60_000, gcTime: Infinity, retry: 2 },
  },
})
