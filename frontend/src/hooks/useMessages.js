// frontend/src/hooks/useMessages.js
import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '../services/contactService';
import { refreshDashboard, useDashboardStats } from './useDashboardStats';

/**
 * PF-107. Extracted from AdminMessagesPanel, which declared this query
 * inline, when the shell's sidebar badge became a second consumer.
 * PF-110 moved the shell onto useDashboardStats, so the panel is the only
 * consumer again; the extraction stays — the mutations below belong
 * beside the query they invalidate, and the key is still the literal
 * ['messages'] the panel has always used.
 *
 * ⚠️ markRead and delete both change the unread/total counts the shell
 * shows, so each invalidates DASHBOARD_KEY as well as this list.
 */
export const MESSAGES_KEY = ['messages'];

/**
 * PF-119 follow-up — a visitor's message arrives without any mutation here.
 * The stats entry already polls (useDashboardStats), so the list rides on it
 * rather than polling too: when the stats' message TOTAL moves, refetch the
 * list. Only a change counts — the first answer is the baseline. A delete
 * here moves the total as well and costs one extra list fetch; that is
 * cheaper than a second poll.
 */
export const useMessages = () => {
  const qc = useQueryClient();
  const total = useDashboardStats().data?.messages;
  // The effect only re-runs when `total` CHANGES, so "has it moved" is the
  // dependency list's job; the ref only skips the first answer — whether it
  // was already cached at mount (the shell loaded it) or lands later.
  const baseline = useRef(false);
  useEffect(() => {
    if (total === undefined) return;
    if (baseline.current) qc.invalidateQueries({ queryKey: MESSAGES_KEY });
    baseline.current = true;
  }, [total, qc]);

  return useQuery({ queryKey: MESSAGES_KEY, queryFn: contactService.getAll });
};

export const useMarkMessageRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactService.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      refreshDashboard(qc);
    },
  });
};

/**
 * PF-115 — star / unstar. Called as `mutate({ id, starred })`.
 *
 * ⚠️ Invalidates the LIST only, deliberately NOT `DASHBOARD_KEY`: starring
 * changes no count the shell or the Overview shows (unread and total are
 * untouched). Copying the two mutations above would refetch the dashboard on
 * every star for nothing — a test pins the omission.
 */
export const useStarMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }) => contactService.star(id, starred),
    onSuccess: () => qc.invalidateQueries({ queryKey: MESSAGES_KEY }),
  });
};

export const useDeleteMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      refreshDashboard(qc);
    },
  });
};
