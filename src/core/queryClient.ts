import { QueryClient } from '@tanstack/react-query';

/** 30s - data considered fresh, no refetch */
const STALE_TIME_MS = 30_000;
/** 5min - unused cache kept in memory (cacheTime equivalent) */
const GC_TIME_MS = 300_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      refetchOnWindowFocus: false,
      retry: 1,
      /** false: optional queries (sidebar, header) don't suspend; use useSuspenseQuery on route pages for suspend-if-needed. */
      suspense: false,
    },
  },
});
