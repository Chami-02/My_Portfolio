import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../../hooks/useMe';
import a from '../../styles/admin.module.css';

/**
 * Wraps any component that requires authentication.
 *
 * PF-108. This used to check that a string existed in localStorage — so an
 * EXPIRED token rendered the whole admin shell, every panel then 401'd,
 * and each one raced the same full-page redirect. Now it asks the server:
 *
 *   pending  → a gate skeleton, not the shell. Nothing under it mounts, so
 *              nothing under it can fire a request that would fail.
 *   success  → children.
 *   signed out — a 401, or data === null (api.js writes null when a
 *              silent refresh fails) → ONE router navigate to
 *              /admin/login, remembering where the user was going.
 *   any OTHER error (server down, network off) → an inline retry panel.
 *
 * ⚠️ That last line is load-bearing. "Cannot reach the server" is not
 * "not signed in": with a refresh token still stored, redirecting to login
 * would have login send the user straight back here (it forwards anyone
 * holding a token), and the two pages would bounce a failing request
 * between them until the network came back.
 *
 * On a cold reload the in-memory access token is gone, so the first
 * /auth/me 401s, api.js's interceptor trades the stored refresh token for
 * a new pair and replays, and this component sees `success` — the user
 * never sees the login page. That IS "validate on entry".
 *
 * Usage in App.jsx:
 *   <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
 */
export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { data, error, isPending, isError, refetch } = useMe();

  if (isPending) {
    return (
      <div className={a.gate} role="status" aria-label="Checking your session">
        <span className={a.skelRow} />
        <span className={a.skelRow} />
        <span className={a.skelRow} />
      </div>
    );
  }

  const signedOut = data === null || (isError && error?.response?.status === 401);

  if (signedOut) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location }}
        replace
      />
    );
  }

  if (isError) {
    return (
      <div className={a.gate}>
        <div className={a.bannerError} role="alert">
          <span aria-hidden="true" className={a.bannerDot} />
          COULDN&rsquo;T CHECK YOUR SESSION — THE SERVER DIDN&rsquo;T ANSWER
          <button type="button" onClick={() => refetch()} className={a.bannerAction}>
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return children;
}
