import { QueryClient } from '@tanstack/react-query';

/**
 * The app's ONE QueryClient (PF-108 — moved here from main.jsx, options
 * unchanged).
 *
 * It lives in its own module so that non-React code can reach it —
 * specifically `services/api.js`, whose response interceptor has to tell
 * the cache that the session is gone when a refresh fails. Importing it
 * from main.jsx would be circular: main → App → … → api → main.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 5,  // Data stays "fresh" for 5 minutes before refetching
      retry:                1,              // Retry failed requests once before showing error
      refetchOnWindowFocus: false,          // Don't refetch every time the user switches tabs
    },
  },
});
