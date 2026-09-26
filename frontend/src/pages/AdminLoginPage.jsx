/* frontend/src/pages/AdminLoginPage.jsx
 *
 * /admin/login — PF-109. The Phase 2 sign-in card, transcribed from
 * docs/design/Admin.dc.html:52-103. The last Phase 1 page on the admin
 * surface until this: 184 lines of inline style objects, Phase 1 tokens,
 * a runtime-injected <style>@keyframes spin</style>, and a <label> that
 * was never associated with its input.
 *
 * What is NOT the prototype's, and why (all owner-decided 2026-09-16,
 * recorded in .claude/locked-decisions.md):
 *
 *   - The background is the SITE's ambient layer — the same three
 *     components HomePage and NotFoundPage mount — not the export's
 *     aurora-orb + scanline stage. The owner's instruction is that the
 *     main page, the admin panel and this page share one background.
 *   - The theme toggle is the site's 44x44 sun/moon button, not the
 *     export's --acc2 pill (PF-107's decision, applied here).
 *   - The prototype's "DESIGN PREVIEW — try admin@portfolio.dev / <demo
 *     password>" line is not rendered here. The omitted password is
 *     seed.js's DEMO_ADMIN_PASSWORD fallback — spelling it out in this
 *     comment would itself trip CI's credential scanner, the same
 *     literal it already allowlists inside seed.js.
 *   - There is no spinner. The export's busy state is the label
 *     changing to SIGNING IN…, and that is all this renders. The
 *     injected @keyframes spin went with it.
 *
 * The sign-in LOGIC is PF-108's and is unchanged: `destinationFrom`
 * honours the location ProtectedRoute captured, a stored refresh token
 * short-circuits to that destination, and every failure goes through
 * utils/loginError.js so a wrong password and an unreachable server
 * produce different sentences.
 */
import { useState }                                 from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { authService }       from '../services/authService';
import { session }           from '../services/session';
import { loginErrorMessage } from '../utils/loginError';
import { ThemeToggle }       from '../components/layout/ThemeToggle';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import logo   from '../assets/logo.png';
import styles from './AdminLoginPage.module.css';

/**
 * Where to go after signing in. ProtectedRoute hands over the location the
 * user was trying to reach as `state.from`; a direct visit has none and
 * lands on the dashboard. PF-108 — this page used to hard-navigate to
 * `/admin` and discard the captured destination.
 */
const destinationFrom = (location) => {
  const from = location.state?.from;
  if (!from?.pathname) return '/admin';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
};

export function AdminLoginPage() {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();
  const location              = useLocation();
  const destination           = destinationFrom(location);

  // A stored refresh token means "probably signed in" — send them through
  // ProtectedRoute, which asks the server. If the token is dead the silent
  // refresh clears it and ProtectedRoute sends them back here with nothing
  // in storage, so this cannot loop. Rendered, not an effect: the old
  // `useEffect` + `isLoggedIn()` painted the form for one frame first.
  if (session.hasRefreshToken()) {
    return <Navigate to={destination} replace />;
  }

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.login(form.email, form.password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      {/* Ambient first: the card establishes its own stacking context at
          z-index 2, and the fixed canvases sit at 0 and 1 beneath it.
          Same order and reasoning as NotFoundPage. No `Reveal` (a single
          screen with nothing below the fold animates once as a whole —
          the card's riseIn) and no ErrorBoundary (nothing here fetches
          on render). */}
      <StarfieldCanvas />
      <CursorGlow />

      <div className={styles.screen}>
        <div className={styles.card}>

          <div className={styles.brand}>
            <span className={styles.logoWrap}>
              <span aria-hidden="true" className={styles.ring} />
              <img src={logo} alt="Parindra Gallage" width="54" height="54" className={styles.logo} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>
                PARINDRA<span className={styles.brandDot}>.</span>DEV
              </span>
              <span className={styles.brandSub}>PORTFOLIO CMS</span>
            </span>
          </div>

          <h1 className={styles.heading}>
            Admin <span className={styles.headingOutline}>sign in</span>
          </h1>
          <p className={styles.lede}>
            Restricted area. Sign in to manage projects, skills, profile, writing and messages.
          </p>

          {/* role="alert" so a screen reader hears the failure without
              having to find it — the Phase 1 banner had no role. */}
          {error && (
            <div role="alert" className={styles.error}>
              <span aria-hidden="true" className={styles.errorMark}>!</span>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <span aria-hidden="true" className={styles.rule} />

            <label className={`${styles.field} ${styles.fieldEmail}`}>
              <span className={styles.fieldLabel}>Email address</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="admin@portfolio.dev"
                value={form.email}
                onChange={handleChange}
                className={styles.input}
              />
            </label>

            <label className={`${styles.field} ${styles.fieldPassword}`}>
              <span className={styles.fieldLabel}>Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className={styles.input}
              />
            </label>

            {/* `disabled` guards against a double submit while the request
                is in flight; it changes nothing visible (see the module).
                The sheen is decorative-only, so under reduced motion it
                is removed rather than frozen — frozen, it is a white
                stripe parked over the label. */}
            <button type="submit" disabled={loading} className={styles.submit}>
              <span aria-hidden="true" data-motion-decorative="" className={styles.sheen} />
              <span className={styles.submitLabel}>
                {loading ? 'SIGNING IN…' : 'SIGN IN →'}
              </span>
            </button>
          </form>

          <div className={styles.foot}>
            {/* `?nosplash=1` on every inbound link from admin (DESIGN.md §7),
                matching the shell's ↗ HOME and ← BACK TO HOME PAGE. */}
            <Link to="/?nosplash=1" className={styles.back}>← BACK TO PORTFOLIO</Link>
            <ThemeToggle />
          </div>

        </div>
      </div>

      {/* Last. z-index 70 beats page content regardless of DOM order, so
          this is for the reader, not the browser. */}
      <GrainOverlay />
    </PageShell>
  );
}
