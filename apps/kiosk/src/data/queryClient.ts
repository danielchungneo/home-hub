import { QueryClient } from '@tanstack/react-query'

// Realtime invalidates queries when rows change, so cached data can stay fresh for a while.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60_000, retry: 2 },
  },
})
