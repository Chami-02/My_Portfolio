// frontend/src/hooks/usePasskeys.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { passkeyService } from '../services/passkeyService';
import { ME_KEY } from '../services/session';

export const PASSKEYS_KEY = ['auth', 'passkeys'];

/**
 * PF-140 — the Settings Passkeys card's list. No `data = []` default: a failed
 * load must reach `LoadError`, never read as "you have no passkeys".
 */
export const usePasskeys = () =>
  useQuery({ queryKey: PASSKEYS_KEY, queryFn: passkeyService.list });

// `/auth/me` too: the Account card's "Sign-in methods" follows these.
const refresh = (qc) => Promise.all([
  qc.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  qc.invalidateQueries({ queryKey: ME_KEY }),
]);

export const usePrepareAddPasskey = () =>
  useMutation({ mutationFn: passkeyService.prepareAdd });

export const useFinishAddPasskey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: passkeyService.finishAdd,
    onSuccess: () => refresh(qc),
  });
};

/** Refetched after a refusal too: one already gone (404) leaves the list. */
export const useRemovePasskey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: passkeyService.remove,
    onSettled: () => refresh(qc),
  });
};
