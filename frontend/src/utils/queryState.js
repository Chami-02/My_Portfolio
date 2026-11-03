// PF-144 — "did this section's data fail to load?", for SectionLoadError.
//
// ⚠️ `isError` alone is NOT the answer, found in the live demo (2026-11-03):
// pressing TRY AGAIN refetches a failed query that has no data, and TanStack
// reports it as LOADING for that moment (isError false). The section then
// UNMOUNTED its error line and, when the retry failed, mounted a fresh one
// that had forgotten the retry — so it never said "still didn't load".
// A query that has failed before (`errorUpdateCount > 0`) and is fetching
// again with no data is still in its failed state, retrying.

/** True while a query has no data and has failed, or is retrying after failing. */
export const loadFailed = (query) =>
  query?.data === undefined
  && Boolean(query?.isError || (query?.isFetching && query?.errorUpdateCount > 0));
