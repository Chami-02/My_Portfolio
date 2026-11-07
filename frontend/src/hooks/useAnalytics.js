// frontend/src/hooks/useAnalytics.js
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';

/**
 * PF-149. 30 s, and only this query polls: the whole panel shares
 * `globalLimiter`'s 100 requests per 15 minutes, this spends 30 of them and the
 * shell's counts 15. TanStack pauses it while the tab is hidden.
 */
export const LIVE_POLL_MS = 30_000;

/** Keeps the last answer on screen while a new range loads, so nothing blanks. */
export const useAnalytics = (range) =>
  useQuery({
    queryKey:        ['analytics', 'report', range],
    queryFn:         () => dashboardService.getAnalytics(range),
    placeholderData: keepPreviousData,
  });

export const useGrowth = () =>
  useQuery({ queryKey: ['analytics', 'growth'], queryFn: dashboardService.getGrowth });

/**
 * `ms` is measured here, because only the browser knows the whole round trip.
 * No retry: a failed check must say PAUSED now, not after three more attempts.
 */
export const useLiveAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'live'],
    queryFn:  async () => {
      const started = performance.now();
      const live = await dashboardService.getLive();
      return { ...live, ms: Math.round(performance.now() - started) };
    },
    refetchInterval:      LIVE_POLL_MS,
    refetchOnWindowFocus: 'always', // `true` refetches only stale data (useDashboardStats)
    retry:                false,
  });

/** A mutation, not a query: it runs only when asked, and the file is the copy. */
export const useExportAnalytics = () =>
  useMutation({ mutationFn: dashboardService.exportCsv });
