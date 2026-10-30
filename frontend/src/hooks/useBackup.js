// frontend/src/hooks/useBackup.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupService } from '../services/backupService';

export const SAFETY_KEY = ['backup', 'safety'];

/**
 * PF-135 — fetch the backup. A mutation, not a query: it sends the password,
 * runs only when asked, and nothing is cached — the file is the copy.
 */
export const useDownloadBackup = () =>
  useMutation({ mutationFn: backupService.download });

/** The restore preview — checks the chosen file on the server, changes nothing. */
export const useCheckRestore = () =>
  useMutation({ mutationFn: backupService.checkRestore });

/**
 * Restore. Afterwards EVERY query is stale — the content behind every panel,
 * the dashboard counts, the safety list — so all of them are refetched.
 *
 * ⚠️ Cancel first, then invalidate (refreshDashboard's rule, widened to every
 * query): an invalidation issued while a query's first fetch is in flight is
 * deduped INTO that fetch, whose answer predates the restore.
 */
export const useRestoreBackup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: backupService.restore,
    onSuccess: () => qc.cancelQueries().then(() => qc.invalidateQueries()),
  });
};

/** The safety copies. No `data = []` default: a failed load must reach LoadError. */
export const useSafetyCopies = () =>
  useQuery({ queryKey: SAFETY_KEY, queryFn: backupService.listSafetyCopies });

/** Download one safety copy (password). */
export const useDownloadSafetyCopy = () =>
  useMutation({ mutationFn: backupService.downloadSafetyCopy });
