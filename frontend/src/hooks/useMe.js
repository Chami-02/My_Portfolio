// frontend/src/hooks/useMe.js
import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authService';

export const ME_KEY = ['auth', 'me'];

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
 * PF-108 builds session validation on top of this same call rather than
 * introducing a second one — do not add a parallel "check my token"
 * request beside it.
 */
export const useMe = () =>
  useQuery({ queryKey: ME_KEY, queryFn: authService.getMe, retry: false });
