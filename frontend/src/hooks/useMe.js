// frontend/src/hooks/useMe.js
import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authService';
import { ME_KEY }      from '../services/session';

// Re-exported so existing consumers keep importing it from here. It is
// DEFINED in services/session.js — see the note there for why.
export { ME_KEY };

/**
 * PF-107. The signed-in account.
 *
 * ⚠️ `authService.getMe` has existed since Phase 1 and had NO caller at
 * any layer — it was written for ProtectedRoute and never wired up.
 * This is its first consumer. The admin header showed a hardcoded
 * `admin@portfolio.dev` instead, which is a lie in any deployment.
 *
 * ⚠️ `retry: false`. The shared QueryClient retries once by default,
 * which is right for a flaky list fetch and wrong here: a 401 means the
 * token is bad, and retrying a bad token just delays the redirect that
 * api.js's response interceptor is already about to perform.
 *
 * PF-108 built session validation on top of this same call rather than
 * introducing a second one — ProtectedRoute reads it; do not add a
 * parallel "check my token" request beside it.
 *
 * ⚠️ `data === null` is a real state, not a loading one: api.js writes
 * null into this entry when a silent refresh fails, so that ProtectedRoute
 * redirects without a refetch. A fresh login removes the entry again.
 */
export const useMe = () =>
  useQuery({ queryKey: ME_KEY, queryFn: authService.getMe, retry: false });
