// frontend/src/hooks/useMessages.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '../services/contactService';
import { DASHBOARD_KEY } from './useDashboardStats';

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

export const useMessages = () =>
  useQuery({ queryKey: MESSAGES_KEY, queryFn: contactService.getAll });

export const useMarkMessageRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactService.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
};

export const useDeleteMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
};
