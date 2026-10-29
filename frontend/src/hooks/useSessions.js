// frontend/src/hooks/useSessions.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/authService';

export const SESSIONS_KEY = ['auth', 'sessions'];

/**
 * PF-132 — the Settings Sessions card's list. No `data = []` default: a
 * failed load must reach `LoadError`, never read as "no other devices".
 */
export const useSessions = () =>
  useQuery({ queryKey: SESSIONS_KEY, queryFn: authService.getSessions });

/**
 * Sign devices out. Called as `mutate({ id, password })` for one device, or
 * `mutate({ password })` for every other one. The list is refetched either
 * way — also after a refusal, so a device that had already ended (404)
 * leaves the list.
 */
export const useEndSessions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }) =>
      (id ? authService.endSession({ id, password }) : authService.endOtherSessions({ password })),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
};
