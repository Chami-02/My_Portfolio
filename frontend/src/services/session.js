/**
 * The browser's half of the session model (PF-108). React-free.
 *
 * Two tokens, two homes, on purpose:
 *
 *   - The ACCESS token lives in a module variable and nowhere else. It is
 *     what every API request carries, and it dies with the tab — a reload
 *     starts with none, and api.js's interceptor silently trades the
 *     refresh token for a new one. Keeping it out of storage means a
 *     script that reads localStorage gets nothing it can use directly.
 *   - The REFRESH token lives in localStorage, because it has to survive a
 *     reload and an httpOnly cookie is not available to this deployment
 *     (frontend and backend are different sites on vercel.app — see the
 *     PF-108 report). It is single-use: the server rotates it on every
 *     refresh and revokes the whole session if a used one is presented
 *     again.
 *
 * `subscribe` exists for the one React consumer that needs to know when the
 * refresh expiry moves (SessionExpiryBanner, via useSyncExternalStore).
 * Every store write goes through `set` or `clear`, so those are the only
 * two places that notify.
 */

const REFRESH_KEY     = 'portfolio_refresh';
const REFRESH_EXP_KEY = 'portfolio_refresh_expires';

/**
 * The TanStack key for "who is signed in". Defined HERE rather than in
 * hooks/useMe.js (which re-exports it) because api.js has to write to that
 * cache entry when a refresh fails, and api.js cannot import useMe —
 * useMe → authService → api would be a cycle.
 */
export const ME_KEY = ['auth', 'me'];

let accessToken     = null;
let accessExpiresAt = null;   // ms since epoch, or null

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

// localStorage can throw (private mode, storage disabled, quota). A session
// that cannot be persisted is a session that ends on reload — degraded,
// not broken — so every access is guarded and falls back to "nothing".
const read = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* see above */ }
};
const remove = (key) => {
  try { localStorage.removeItem(key); } catch { /* see above */ }
};

const toMs = (iso) => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

export const session = {
  /** Store a freshly issued pair — the shape login and refresh both return. */
  set(payload) {
    accessToken     = payload.accessToken ?? null;
    accessExpiresAt = toMs(payload.accessExpiresAt);
    if (payload.refreshToken) {
      write(REFRESH_KEY, payload.refreshToken);
      const exp = toMs(payload.refreshExpiresAt);
      if (exp === null) remove(REFRESH_EXP_KEY);
      else write(REFRESH_EXP_KEY, String(exp));
    }
    notify();
  },

  clear() {
    accessToken     = null;
    accessExpiresAt = null;
    remove(REFRESH_KEY);
    remove(REFRESH_EXP_KEY);
    notify();
  },

  getAccessToken:     () => accessToken,
  getAccessExpiresAt: () => accessExpiresAt,
  getRefreshToken:    () => read(REFRESH_KEY),
  hasRefreshToken:    () => read(REFRESH_KEY) !== null,

  /** ms since epoch, or null when there is no stored session. */
  getRefreshExpiresAt() {
    const raw = read(REFRESH_EXP_KEY);
    if (raw === null) return null;
    const ms = Number(raw);
    return Number.isFinite(ms) ? ms : null;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
