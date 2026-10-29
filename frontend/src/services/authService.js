import api, { refreshSession, apiUrl } from './api';
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
   * PF-119 — where the Google button points. A full-page navigation to the
   * API, never an XHR: the API sets its flow cookie and redirects the browser
   * to Google, and both need the browser itself on the API's host.
   * `returnTo` rides along so the admin lands where they were headed.
   */
  googleStartUrl: (returnTo) =>
    `${apiUrl('/auth/google/start')}?returnTo=${encodeURIComponent(returnTo)}`,

  /**
   * PF-119 — trade the one-time handoff Google sign-in ends with for a
   * session. Stored exactly as `login` stores one: there is ONE session
   * model, whichever door was used. Resolves to where the admin was going.
   */
  googleExchange: async (code) => {
    const { data } = await api.post('/auth/google/exchange', { code });
    session.set(data);
    queryClient.removeQueries({ queryKey: ME_KEY });
    return data.returnTo;
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

  /**
   * PF-125 — ask for a reset code. The server answers the SAME for any
   * address (it never says whether one signs in here), so there is nothing
   * to return: resolving means "asked".
   */
  requestPasswordReset: (email) =>
    api.post('/auth/password/forgot', { email }).then(() => undefined),

  /**
   * PF-125 — the emailed code plus the new password. Starts NO session: the
   * server signs every device out, and the admin then signs in with the new
   * password like anyone else.
   */
  resetPassword: ({ email, code, password }) =>
    api.post('/auth/password/reset', { email, code, password }).then((r) => r.data.message),

  /**
   * PF-124 — the signed-in change, step one: the server checks the current
   * password and the new one, then emails a code to the address this login
   * used. Resolves with that address, to read back on screen.
   */
  requestPasswordChangeCode: ({ currentPassword, password }) =>
    api.post('/auth/password/change/code', { currentPassword, password }).then((r) => r.data.sentTo),

  /**
   * PF-124 — step two: just the code. Step one's checks passed and the
   * server keeps the new password's hash beside the code. No token handling:
   * the server signs every OTHER device out and this session lives on.
   */
  changePassword: ({ code }) =>
    api.post('/auth/password/change', { code }).then((r) => r.data.message),

  /**
   * PF-132 — every device signed in to the admin, this one marked `current`.
   * `id` is the session family; it is not a credential.
   */
  getSessions: () => api.get('/auth/sessions').then((r) => r.data.data),

  /**
   * PF-132 — sign one OTHER device out, or every other one. Both need the
   * current password (OWASP ASVS 5.0 V7.5.2). This device is never ended
   * here: SIGN OUT in the header also clears this browser's tokens.
   */
  endSession: ({ id, password }) =>
    api.post('/auth/sessions/revoke', { id, password }).then(() => undefined),
  endOtherSessions: ({ password }) =>
    api.post('/auth/sessions/revoke-others', { password }).then(() => undefined),
};
