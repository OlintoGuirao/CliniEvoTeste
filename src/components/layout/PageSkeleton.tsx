import { Skeleton } from '@/components/ui/skeleton';

/**
 * Persistent layout skeleton used as Suspense fallback.
 * Keeps header + sidebar visible and shows a stable content-area skeleton
 * to eliminate layout jumps and blank flashes during route/data load.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200" aria-hidden>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 max-w-md w-3/4" />
        <Skeleton className="h-4 max-w-2xl w-full" />
        <Skeleton className="h-4 max-w-xl w-4/5" />
        <Skeleton className="h-4 max-w-lg w-2/3" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
