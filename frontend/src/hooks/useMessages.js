// frontend/src/hooks/useMessages.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '../services/contactService';

/**
 * PF-107. Extracted from AdminMessagesPanel, which declared this query
 * inline. It now has two consumers — the panel and the shell's sidebar
 * badge / footer session column — which is the bar for pulling
 * something out rather than duplicating it.
 *
 * ⚠️ The key stays the literal ['messages'] the panel already used, so
 * the extraction shares the panel's existing cache entry rather than
 * opening a second one beside it. Changing the key here would make the
 * sidebar fetch independently of the panel and quietly double the
 * request count.
 */
export const MESSAGES_KEY = ['messages'];

export const useMessages = () =>
  useQuery({ queryKey: MESSAGES_KEY, queryFn: contactService.getAll });

export const useMarkMessageRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactService.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: MESSAGES_KEY }),
  });
};

export const useDeleteMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: MESSAGES_KEY }),
  });
};
