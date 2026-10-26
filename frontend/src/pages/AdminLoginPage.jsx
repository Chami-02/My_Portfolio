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
 *   - The prototype's "DESIGN PREVIEW" line (a demo address and the
 *     demo password) is not rendered here. The omitted password is
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
 *
 * PF-119 adds Google as the first door (owner-approved 2026-10-12 — the
 * prototype has no Google button): CONTINUE WITH GOOGLE, an OR divider,
 * then the password form, unchanged. The button is a plain link to the
 * API, which sends the browser to Google; Google sends it back to the API,
 * and the API sends it HERE with either
 *
 *   #handoff=<one-time code>     traded for a session by the effect below
 *   #google_error=<reason>       shown in the same error banner
 *
 * Both are in the fragment, which never reaches a server. They are read
 * ONCE, at mount, and wiped from the address bar straight away.
 *
 * PF-125 adds the way back from a forgotten password: a `Forgot password?`
 * link under the password field, always; after THREE wrong passwords in a
 * row, a "Having trouble?" line offering the same reset (owner, 2026-10-14
 * — chosen over a password hint, which this page must never show). The
 * count is this page visit's only; the server's authLimiter is the real
 * gate. A finished reset lands here with "Password changed".
 */
import { useEffect, useRef, useState }              from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { authService }       from '../services/authService';
import { session }           from '../services/session';
import {
  loginErrorMessage,
  googleErrorMessage,
  googleExchangeErrorMessage,
} from '../utils/loginError';
import { ThemeToggle }       from '../components/layout/ThemeToggle';
import { EyeIcon, EyeOffIcon } from '../components/icons/BrandIcons';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { BrandMark }       from '../components/common/BrandMark';
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

/** Wrong passwords in a row before the reset is offered (owner, 2026-10-14). */
const TROUBLE_AFTER = 3;

/** What Google sign-in left in the fragment, if anything. */
const googleResultFrom = (hash) => {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  return { handoff: params.get('handoff'), error: params.get('google_error') };
};

export function AdminLoginPage() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const destination = destinationFrom(location);

  // Read once, at mount. Later renders see the hash already wiped.
  const [google] = useState(() => googleResultFrom(location.hash));

  // PF-125 — a finished reset arrives with the address it used.
  const [form,    setForm]    = useState(() => ({ email: location.state?.email ?? '', password: '' }));
  const [error,   setError]   = useState(() => (google.error ? googleErrorMessage(google.error) : ''));
  const [loading, setLoading] = useState(false);
  // Show / hide the typed password (owner, 2026-10-14). Hidden by default.
  const [showPassword, setShowPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(Boolean(google.handoff));
  const [notice, setNotice] = useState(() =>
    (location.state?.passwordReset ? 'Password changed. Sign in with your new password.' : ''));
  // Only a WRONG PASSWORD counts (a 401). An unreachable server says
  // nothing about the password, so it must not push anyone towards a reset.
  const [failures, setFailures] = useState(0);

  // ⚠️ The handoff is SINGLE USE, and StrictMode runs this effect twice in
  // development. A ref survives that double run (same component instance),
  // so the second run finds the code already spent and does nothing —
  // without it, the second exchange would get a 401 and paint "expired"
  // over a sign-in that had just worked.
  const exchanged = useRef(false);

  useEffect(() => {
    if (!google.handoff && !google.error) return;
    // Wipe the fragment first: a one-time code has no business in the
    // address bar, the history entry, or a screenshot.
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: location.state });

    if (!google.handoff || exchanged.current) return;
    exchanged.current = true;
    authService.googleExchange(google.handoff)
      .then((returnTo) => navigate(returnTo || '/admin', { replace: true }))
      .catch((err) => {
        setError(googleExchangeErrorMessage(err));
        setGoogleBusy(false);
      });
    // Mount only — `google` never changes, and re-running on a location
    // change (which this effect itself causes) must not happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A stored refresh token means "probably signed in" — send them through
  // ProtectedRoute, which asks the server. If the token is dead the silent
  // refresh clears it and ProtectedRoute sends them back here with nothing
  // in storage, so this cannot loop. Rendered, not an effect: the old
  // `useEffect` + `isLoggedIn()` painted the form for one frame first.
  // Not while a Google handoff is being traded: its own success stores a
  // refresh token, and this would race the effect's navigate.
  if (session.hasRefreshToken() && !googleBusy) {
    return <Navigate to={destination} replace />;
  }

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      await authService.login(form.email, form.password);
      navigate(destination, { replace: true });
    } catch (err) {
      if (err?.response?.status === 401) setFailures((n) => n + 1);
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
            <BrandMark alt="Parindra Gallage" />
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

          {notice && !error && (
            <div role="status" className={styles.notice}>
              <span aria-hidden="true" className={styles.noticeMark}>✓</span>
              <p className={styles.noticeText}>{notice}</p>
            </div>
          )}

          {failures >= TROUBLE_AFTER && (
            <div className={styles.trouble}>
              <span>Having trouble?</span>
              <Link to="/admin/forgot-password" state={{ email: form.email }} className={styles.troubleLink}>
                RESET YOUR PASSWORD →
              </Link>
            </div>
          )}

          {/* PF-119 — a LINK, not a button with a click handler: the
              browser itself must travel to the API and on to Google.
              While a handoff is being traded it stops being a link, so a
              second click cannot start a second sign-in mid-exchange. */}
          {googleBusy ? (
            <span className={styles.google} aria-disabled="true" role="status">
              <GoogleMark />
              <span>SIGNING IN WITH GOOGLE…</span>
            </span>
          ) : (
            <a href={authService.googleStartUrl(destination)} className={styles.google}>
              <GoogleMark />
              <span>CONTINUE WITH GOOGLE</span>
            </a>
          )}

          <p className={styles.divider}>
            <span aria-hidden="true" className={styles.dividerLine} />
            <span className={styles.dividerText}>OR</span>
            <span aria-hidden="true" className={styles.dividerLine} />
          </p>

          {/* `noValidate` — the browser's own popups do not match the
              page and say nothing the server will not; the server's 400
              and 401 are what the banner reports (PF-117 follow-up). */}
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <span aria-hidden="true" className={styles.rule} />

            <label className={`${styles.field} ${styles.fieldEmail}`}>
              <span className={styles.fieldLabel}>Email address</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                className={styles.input}
              />
            </label>

            {/* The toggle sits INSIDE the field but OUTSIDE the <label>: a
                button inside a label is itself labelable, and the label's
                click would then be ambiguous. `type="button"` — inside a
                <form>, a type-less button SUBMITS. One fixed name plus
                `aria-pressed` (not a name that flips): a screen reader then
                says "Show password, toggle button, pressed". */}
            <div className={`${styles.field} ${styles.fieldPassword}`}>
              <label htmlFor="admin-login-password" className={styles.fieldLabel}>Password</label>
              <div className={styles.passwordWrap}>
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.inputWithToggle}`}
                />
                <button
                  type="button"
                  className={styles.reveal}
                  aria-label="Show password"
                  aria-pressed={showPassword}
                  aria-controls="admin-login-password"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            {/* PF-125 — always here, so a forgotten password never needs
                three wrong guesses first. Carries the typed address over. */}
            <div className={`${styles.assist} ${styles.assistEnd}`}>
              <Link to="/admin/forgot-password" state={{ email: form.email }} className={styles.textLink}>
                Forgot password?
              </Link>
            </div>

            {/* `disabled` guards against a double submit while the request
                is in flight; it changes nothing visible (see the module).
                The sheen is decorative-only, so under reduced motion it
                is removed rather than frozen — frozen, it is a white
                stripe parked over the label. */}
            <button type="submit" disabled={loading || googleBusy} className={styles.submit}>
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

/**
 * Google's "G" — the four-colour mark Google's branding guidelines require
 * on any sign-in button that names Google. Fixed colours in BOTH themes, on
 * purpose: the mark is Google's, not the site's palette.
 */
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48" className={styles.googleMark}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
