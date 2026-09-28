import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ReactNode } from 'react';
import { queryClient } from '@/core/queryClient';

export { queryClient } from '@/core/queryClient';

const CACHE_KEY = 'clienievo_react_query_cache';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

const persister =
  typeof window !== 'undefined'
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: CACHE_KEY,
        throttleTime: 1000,
      })
    : null;

export function QueryProvider({ children }: { children: ReactNode }) {
  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: MAX_AGE_MS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
