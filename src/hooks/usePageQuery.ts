import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';

/**
 * Result of usePageQuery: useQuery result plus isPageLoading.
 * isPageLoading = true when we should show a full-page loading state
 * (no content yet): either the query is loading, or we're fetching and have no data yet.
 */
export interface UsePageQueryResult<TData = unknown>
  extends UseQueryResult<TData> {
  /** True when the page should show PageLoading (no content to show yet). */
  isPageLoading: boolean;
}

/**
 * Wraps useQuery and exposes isPageLoading for consistent loading UX.
 * isPageLoading = isLoading OR (isFetching AND no data yet).
 * Use this so we don't flash cached content before fresh data loads.
 */
export function usePageQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UsePageQueryResult<TData> {
  const result = useQuery(options) as UseQueryResult<TData>;
  const { isLoading, isFetching, data } = result;
  const isPageLoading = Boolean(
    isLoading || (isFetching && data === undefined)
  );
  return {
    ...result,
    isPageLoading,
  };
}
