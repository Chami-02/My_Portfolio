/* frontend/src/pages/AdminForgotPasswordPage.jsx
 *
 * /admin/forgot-password — PF-125. A signed-out admin resets the password
 * with a six-digit code emailed to the login address they type.
 *
 *   step 1  EMAIL   → POST /auth/password/forgot   (the same answer for any address)
 *   step 2  CODE    → POST /auth/password/reset    (code + new password, typed twice)
 *   done            → /admin/login with "Password changed" — nobody is signed in
 *
 * The card is the sign-in card: same stylesheet, same ambient layer, same
 * entrance — the owner approved "the login card's look" for this page. The
 * prototype has no forgot flow at all, so there is nothing to transcribe.
 *
 * The client checks here (6 digits, 15+ characters, the two entries match)
 * are a COURTESY that saves a round trip. The server enforces every one of
 * them, plus the leaked-password check only it can make.
 */
import { useEffect, useState }          from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService }       from '../services/authService';
import { resetErrorMessage } from '../utils/resetError';
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

// Mirrors the server: backend/src/utils/passwordPolicy.js (MIN_LENGTH) and
// the per-account resend cooldown in passwordResetController.js.
const MIN_LENGTH  = 15;
const RESEND_SECS = 60;

/** Characters as the reader sees them — an emoji is one, as on the server. */
const lengthOf = (text) => [...text].length;

export function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [step,    setStep]    = useState('email');
  const [email,   setEmail]   = useState(() => location.state?.email ?? '');
  const [form,    setForm]    = useState({ code: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  // The address the last code was requested for — read back in the banner
  // (owner, 2026-10-27) so a typo like `gmial` shows. It reveals nothing:
  // the reader sees only what they typed.
  const [sentTo,  setSentTo]  = useState('');

  // The resend cooldown, as a deadline plus a ticking clock — the seconds
  // left are DERIVED in render, never stored.
  const [resendAt, setResendAt] = useState(0);
  const [now,      setNow]      = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const sendCode = async () => {
    if (!email.trim()) {
      setError('Enter the email address you sign in with.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authService.requestPasswordReset(email.trim());
      setSentTo(email.trim());
      setStep('code');
      setNow(Date.now());
      setResendAt(Date.now() + RESEND_SECS * 1000);
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    sendCode();
  };

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const code = form.code.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (lengthOf(form.password) < MIN_LENGTH) {
      setError(`The new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (form.password !== form.confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setBusy(true);
    setError('');
    try {
      await authService.resetPassword({ email: email.trim(), code, password: form.password });
      navigate('/admin/login', { replace: true, state: { passwordReset: true, email: email.trim() } });
    } catch (err) {
      setError(resetErrorMessage(err));
      setBusy(false);
    }
  };

  const changeAddress = () => {
    setStep('email');
    setForm({ code: '', password: '', confirm: '' });
    setError('');
    setSentTo('');
  };

  return (
    <PageShell>
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
            Reset <span className={styles.headingOutline}>password</span>
          </h1>
          <p className={styles.lede}>
            {step === 'email'
              ? "Enter the email address you sign in with. We'll send a 6-digit code to it."
              : 'Enter the code from the email and choose a new password.'}
          </p>

          {error && (
            <div role="alert" className={styles.error}>
              <span aria-hidden="true" className={styles.errorMark}>!</span>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {sentTo && !error && (
            <div role="status" className={styles.notice}>
              <span aria-hidden="true" className={styles.noticeMark}>✓</span>
              <p className={styles.noticeText}>
                If <strong>{sentTo}</strong> can sign in here, a reset code is on its way.
                It expires in 10 minutes.
              </p>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className={styles.form} noValidate>
              <span aria-hidden="true" className={styles.rule} />

              <label className={`${styles.field} ${styles.fieldEmail}`}>
                <span className={styles.fieldLabel}>Email address</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </label>

              <button type="submit" disabled={busy} className={styles.submit}>
                <span aria-hidden="true" data-motion-decorative="" className={styles.sheen} />
                <span className={styles.submitLabel}>{busy ? 'SENDING…' : 'SEND CODE →'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit} className={styles.form} noValidate>
              <span aria-hidden="true" className={styles.rule} />

              <label className={`${styles.field} ${styles.fieldEmail}`}>
                <span className={styles.fieldLabel}>6-digit code</span>
                <input
                  type="text"
                  name="code"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={form.code}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>

              {/* The eye sits outside the <label>, as on the sign-in form —
                  a button inside a label makes the label's click ambiguous.
                  One toggle shows BOTH new-password fields. */}
              <div className={`${styles.field} ${styles.fieldPassword}`}>
                <label htmlFor="reset-new-password" className={styles.fieldLabel}>
                  New password (at least {MIN_LENGTH} characters)
                </label>
                <div className={styles.passwordWrap}>
                  <input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form.password}
                    onChange={handleChange}
                    className={`${styles.input} ${styles.inputWithToggle}`}
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    aria-label="Show password"
                    aria-pressed={showPassword}
                    aria-controls="reset-new-password reset-confirm-password"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              <div className={`${styles.field} ${styles.fieldPassword}`}>
                <label htmlFor="reset-confirm-password" className={styles.fieldLabel}>
                  Repeat new password
                </label>
                <input
                  id="reset-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  name="confirm"
                  required
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={form.confirm}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.assist}>
                <button type="button" className={styles.textLink} onClick={changeAddress}>
                  Use a different address
                </button>
                <button
                  type="button"
                  className={styles.textLink}
                  disabled={busy || secondsLeft > 0}
                  onClick={sendCode}
                >
                  {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
                </button>
              </div>

              <button type="submit" disabled={busy} className={styles.submit}>
                <span aria-hidden="true" data-motion-decorative="" className={styles.sheen} />
                <span className={styles.submitLabel}>{busy ? 'SAVING…' : 'RESET PASSWORD →'}</span>
              </button>
            </form>
          )}

          <div className={styles.foot}>
            <Link to="/admin/login" className={styles.back}>← BACK TO SIGN IN</Link>
            <ThemeToggle />
          </div>

        </div>
      </div>

      <GrainOverlay />
    </PageShell>
  );
}
