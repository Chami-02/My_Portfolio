import api, { refreshSession } from './api';
import { session, ME_KEY }     from './session';
import { queryClient }         from '../lib/queryClient';

/**
 * PF-108. Every call here either starts a session, renews one, or ends one;
 * `getMe` is how the app asks whether it still has one.
 *
 * ⚠️ `getToken` and `isLoggedIn` are GONE. Both read a token out of
 * localStorage, and the access token no longer lives there — after a reload
 * they would say "signed out" while a valid refresh token sat one key away,
 * and after an expiry they would say "signed in" for a token the server had
 * already refused. ProtectedRoute now asks the server (useMe) instead.
 */
export const authService = {
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    session.set(data);
    // A failed refresh writes `null` into this entry so ProtectedRoute
    // redirects; a fresh sign-in must clear that or the next /admin visit
    // would bounce straight back here.
    queryClient.removeQueries({ queryKey: ME_KEY });
    return data;
  },

  /**
   * Rotate the refresh token. api.js does this silently on any 401; this
   * public form is for the expiry banner's STAY SIGNED IN, which wants the
   * renewal without waiting for a request to fail first. Same function
   * underneath, so it shares the single-flight lock and, on failure,
   * clears the session and tells the cache the same way.
   */
  refresh: () => refreshSession(),

  /**
   * Tell the server, then forget locally — in that order, because the
   * server call needs the refresh token that `clear` deletes. A failed
   * network call still signs the browser out; the session row then dies
   * on its own expiry rather than immediately, which is the right way
   * round for a user who has clicked SIGN OUT.
   */
  logout: async () => {
    const refreshToken = session.getRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } finally {
      session.clear();
    }
  },

  getMe: () => api.get('/auth/me').then((r) => r.data.data),
};
