import axios from 'axios';
import { session, ME_KEY } from './session';
import { queryClient }     from '../lib/queryClient';

// In development: Vite proxy forwards /api/* → backend:5000/api/*
// In production:  VITE_API_URL points directly to the backend's own origin
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 12000,   // 12 seconds before timing out
  headers: {
    'Content-Type': 'application/json',
  },
  // ── ⚠️ ARRAY PARAMS, PF-105 ──────────────────────────────────────────
  // axios v1 serialises an array as `tag[]=a&tag[]=b`. `URLSearchParams`
  // — which react-router writes into the address bar, and which /blog's
  // tag filter is built on — produces the REPEAT form, `tag=a&tag=b`.
  //
  // Express's `qs` parser happens to turn both into an array, so leaving
  // this alone would appear to work while the address bar and the request
  // on the wire disagreed. That is a bad kind of working: the URL a
  // visitor copies is then not the URL the app fetches, and any future
  // check on the raw query string sees a shape no client code writes.
  //
  // `indexes: null` is axios's own switch for the repeat form. Set once
  // here rather than per call, so no future caller has to remember it.
  paramsSerializer: { indexes: null },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Runs before EVERY request leaves the browser.
// Attaches the in-memory access token when there is one. It is read at send
// time, not captured, so a request replayed after a refresh picks up the
// NEW token even though its config still carries the old header.
api.interceptors.request.use(
  (config) => {
    const token = session.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Silent refresh (PF-108) ───────────────────────────────────────────────────
// The endpoints that must never trigger a refresh of their own: a 401 from
// login is a wrong password, from refresh is a dead session, and logout is
// answered 200 regardless.
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];
const isAuthPath = (url = '') => AUTH_PATHS.some((p) => url.includes(p));

// Single-flight. When an access token dies, every query in flight 401s at
// once — a panel load is four or five of them — and each one lands here.
// Only the FIRST starts a refresh; the rest await the same promise, then
// replay. Without this, N concurrent 401s would post N refreshes with the
// same refresh token, and the backend's reuse detection would read the
// second one as theft and revoke the session the first one just renewed.
let refreshInFlight = null;

/**
 * Rotate the refresh token. Exported for authService.refresh (the expiry
 * banner's STAY SIGNED IN) so that a deliberate renewal and an interceptor-
 * driven one share the lock AND the failure path — a direct call that
 * bypassed this would leave a dead token in storage when it 401'd.
 */
export const refreshSession = () => {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = session.getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token'));
  }

  refreshInFlight = api
    .post('/auth/refresh', { refreshToken })
    .then(({ data }) => {
      session.set(data);
      return data.accessToken;
    })
    .catch((err) => {
      // The session is over. Forget it, and tell the cache so that
      // ProtectedRoute — which watches ['auth','me'] — performs ONE router
      // navigate to /admin/login. `null` rather than removing the entry:
      // removal would make an active useMe refetch, 401 again, and land
      // right back here.
      session.clear();
      queryClient.setQueryData(ME_KEY, null);
      throw err;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

// ── Response interceptor ──────────────────────────────────────────────────────
// Runs after EVERY response arrives. On a 401 from a normal request, refresh
// once and replay; on a second 401 give up and let the caller see it.
//
// ⚠️ This used to `localStorage.removeItem('portfolio_token')` and set
// `window.location.href = '/admin/login'` — a full document reload that
// wiped the Query cache and any half-typed form. Gone. Navigation is the
// router's job, done by ProtectedRoute off the cache write above.
api.interceptors.response.use(
  (response) => response,  // Pass successful responses straight through
  async (error) => {
    const { config, response } = error;

    const shouldRefresh =
      response?.status === 401 &&
      config &&
      !config._retried &&
      !isAuthPath(config.url);

    if (!shouldRefresh) {
      // Always reject — let the calling service handle the error
      return Promise.reject(error);
    }

    try {
      await refreshSession();
    } catch {
      return Promise.reject(error);   // the ORIGINAL 401, not the refresh's
    }

    config._retried = true;
    return api(config);
  }
);

/**
 * Absolute URL for an API path, for cases the axios instance can't serve —
 * anchor hrefs, <img src>, anything the browser fetches itself.
 *
 * Needed because the backend is on a DIFFERENT ORIGIN in production
 * (VITE_API_URL), so a hardcoded "/api/resume" in an href would 404 on the
 * live site while working fine behind the dev proxy.
 *
 *   apiUrl('/resume')  →  '/api/resume'                    (dev, proxied)
 *                      →  'https://api.example.com/resume' (prod)
 */
export const apiUrl = (path = '') => {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  return `${base}/${String(path).replace(/^\//, '')}`;
};

export default api;
