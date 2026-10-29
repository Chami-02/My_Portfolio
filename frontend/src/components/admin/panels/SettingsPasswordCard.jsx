// frontend/src/components/admin/panels/SettingsPasswordCard.jsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient }     from '@tanstack/react-query';
import { authService }        from '../../../services/authService';
import { useAdminFlash }      from '../../../hooks/useAdminFlash';
import { useFormGuard }       from '../../../hooks/useFormGuard';
import { useUnsavedChanges }  from '../../../hooks/useUnsavedChanges';
import { usePasswordStrength } from '../../../hooks/usePasswordStrength';
import { useMe }              from '../../../hooks/useMe';
import { ME_KEY }             from '../../../services/session';
import { SIGN_INS_KEY }       from '../../../hooks/useSessions';
import { formatDate }         from '../../../utils/blogMeta';
import { useAbout }           from '../../../hooks/useAbout';
import { contextWords }       from '../../../utils/passwordStrength';
import { PasswordStrength }   from '../PasswordStrength';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { resetErrorMessage }  from '../../../utils/resetError';
import {
  EMPTY_CHANGE, MIN_LENGTH, RESEND_SECS, passwordChangeErrors,
} from '../../../utils/passwordRules';
import { EyeIcon, EyeOffIcon } from '../../icons/BrandIcons';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

const FID = 'settings-password';

/**
 * PF-124 — change the password while signed in, proved twice (owner,
 * 2026-10-13): the current password AND a code emailed to the address this
 * login used.
 *
 *   step `passwords`  current + new (twice) → SEND CODE  → POST …/change/code
 *   step `code`       the 6 digits          → SAVE NEW PASSWORD → POST …/change
 *
 * Step one does every check and the server parks the new password's HASH
 * beside the code, so step two sends only the code. The passwords stay in
 * state while the code step is up — RESEND sends step one again, and CANCEL
 * goes back to them rather than emptying them.
 *
 * The strength meter (zxcvbn + no name / address / site words) is a live
 * courtesy; the server makes the same check, and its answer wins.
 *
 * Folded by default (owner, 2026-10-27): one line — "Password · CHANGE
 * PASSWORD ▾" — that slides the form open (the GitHub / Google settings
 * pattern). A WAI-ARIA disclosure: a real button with `aria-expanded` and
 * `aria-controls`; the folded body is `inert`, so nothing in it can be
 * tabbed to or read out. Opening moves focus to Current password; closing
 * returns it to the button. Closing a half-typed form asks first (the same
 * Keep / Discard as leaving); a success folds it again.
 *
 * Not a staged panel: nothing here is public, so there is no REVERT. It does
 * follow the admin form rules — `noValidate`, the guard's refuse-and-mark,
 * the button dim only until something is typed — and it joins the
 * unsaved-changes guard with NO save: "save" a half-typed password change
 * would mean nothing, so leaving asks Keep / Discard only.
 */
export function SettingsPasswordCard() {
  const { showFlash } = useAdminFlash();
  const guard = useFormGuard(passwordChangeErrors, FID);

  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState(EMPTY_CHANGE);
  const [step,   setStep]   = useState('passwords');
  const [sentTo, setSentTo] = useState('');
  const [busy,   setBusy]   = useState(false);
  // A server refusal ("current password is wrong", "…data leak…") — its own
  // channel, never folded into the guard's field marks.
  const [error,  setError]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  // The resend cooldown as a deadline plus a ticking clock — the seconds left
  // are DERIVED in render (the forgot page's pattern).
  const [resendAt, setResendAt] = useState(0);
  const [now,      setNow]      = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  // The words a password may not be built from — the server's own list.
  const qc = useQueryClient();
  const { data: me }    = useMe();
  const { data: about } = useAbout();
  const words = contextWords({
    addresses: me?.addresses?.map((x) => x.address) ?? (me?.email ? [me.email] : []),
    name:      about?.name,
  });
  const strength = usePasswordStrength(form.password, words);

  const dirty = Object.values(form).some(Boolean);
  const requestLeave = useUnsavedChanges({ dirty, what: 'the password form' });

  // Focus follows the fold — but only after the owner moved it, never on the
  // first render (a page load must not jump into a password field).
  const toggleRef  = useRef(null);
  const currentRef = useRef(null);
  const moveFocus  = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (open ? currentRef : toggleRef).current?.focus();
  }, [open]);

  /** Everything back to a folded, empty card. */
  const clear = () => {
    setForm(EMPTY_CHANGE);
    setStep('passwords');
    setSentTo('');
    setError('');
    setShowCurrent(false);
    setShowNew(false);
    guard.reset();
  };

  const fold = () => {
    clear();
    moveFocus.current = true;
    setOpen(false);
  };

  const toggle = () => {
    if (open) {
      requestLeave(fold);
      return;
    }
    moveFocus.current = true;
    setOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    guard.clearField(name);
  };

  const sendCode = async () => {
    setBusy(true);
    setError('');
    try {
      const address = await authService.requestPasswordChangeCode(form);
      setSentTo(address);
      setStep('code');
      setNow(Date.now());
      setResendAt(Date.now() + RESEND_SECS * 1000);
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!guard.check({ step, strength, ...form })) return;

    if (step === 'passwords') {
      sendCode();
      return;
    }

    setBusy(true);
    setError('');
    try {
      const message = await authService.changePassword({ code: form.code.trim() });
      fold();
      showFlash(message);
      // PF-133: "Last changed", the leaked-password banner and the history
      // all read what just changed.
      qc.invalidateQueries({ queryKey: ME_KEY });
      qc.invalidateQueries({ queryKey: SIGN_INS_KEY });
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const backToPasswords = () => {
    setStep('passwords');
    setForm((prev) => ({ ...prev, code: '' }));
    setSentTo('');
    setError('');
    guard.reset();
  };

  const fieldError = (field) => {
    const message = guard.errorFor(field);
    return message
      ? <p className={a.fieldError} id={errorId(FID, field)} role="alert">{message}</p>
      : null;
  };

  // One eye per secret: the current password's own, and one for the new
  // password and its repeat together (the forgot page's pairing).
  const eye = (shown, toggle, controls) => (
    <button
      type="button"
      className={a.reveal}
      aria-label="Show password"
      aria-pressed={shown}
      aria-controls={controls}
      onClick={toggle}
    >
      {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
    </button>
  );

  const secretProps = {
    autoCapitalize: 'none',
    autoCorrect: 'off',
    spellCheck: false,
    className: a.input,
    onChange: handleChange,
  };

  const newIds = `${FID}-password ${FID}-confirm`;

  return (
    <section className={a.panel} aria-labelledby="settings-password-title">
      <div className={styles.disclosureHead}>
        <h2 className={a.panelTitle} id="settings-password-title">Password</h2>
        <button
          ref={toggleRef}
          type="button"
          className={styles.disclosure}
          aria-expanded={open}
          aria-controls={`${FID}-body`}
          onClick={toggle}
        >
          CHANGE PASSWORD
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>
      </div>

      {/* PF-133: when it last changed (NIST: change on evidence, never on a
          schedule). Nothing for a password set before PF-124 stamped it. */}
      {me?.passwordChangedAt && (
        <p className={styles.lastChanged}>LAST CHANGED {formatDate(me.passwordChangedAt)}</p>
      )}

      <div
        id={`${FID}-body`}
        className={`${styles.collapse} ${open ? styles.collapseOpen : ''}`}
        inert={!open}
      >
      <div className={styles.collapseInner}>
      <p className={styles.lede}>
        {step === 'passwords'
          ? 'Changing it needs your current password and a code we email to the address you signed in with. Every other device is then signed out.'
          : <>A code is on its way to <strong className={styles.value}>{sentTo}</strong>. It expires in 10 minutes.</>}
      </p>

      <form className={a.form} onSubmit={handleSubmit} noValidate>
        {guard.errors.length > 0 && (
          <div className={a.bannerError} role="alert">
            <span className={a.bannerDot} aria-hidden="true" />
            <span>
              CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
              {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
            </span>
          </div>
        )}

        {error && (
          <div className={a.bannerError} role="alert">
            <span className={a.bannerDot} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {step === 'passwords' ? (
          <>
            <div>
              <label className={a.label} htmlFor={`${FID}-currentPassword`}>Current password</label>
              <div className={a.passwordWrap}>
                <input
                  {...secretProps}
                  {...fieldProps(guard.errors, FID, 'currentPassword')}
                  ref={currentRef}
                  type={showCurrent ? 'text' : 'password'}
                  name="currentPassword"
                  autoComplete="current-password"
                  value={form.currentPassword}
                />
                {eye(showCurrent, () => setShowCurrent((v) => !v), `${FID}-currentPassword`)}
              </div>
              {fieldError('currentPassword')}
            </div>

            <div className={a.fieldGrid}>
              <div>
                <label className={a.label} htmlFor={`${FID}-password`}>New password</label>
                <div className={a.passwordWrap}>
                  <input
                    {...secretProps}
                    {...fieldProps(guard.errors, FID, 'password')}
                    type={showNew ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    value={form.password}
                  />
                  {eye(showNew, () => setShowNew((v) => !v), newIds)}
                </div>
                {fieldError('password')}
                <PasswordStrength result={strength} id={`${FID}-strength`} />
              </div>

              <div>
                <label className={a.label} htmlFor={`${FID}-confirm`}>Repeat new password</label>
                <input
                  {...secretProps}
                  {...fieldProps(guard.errors, FID, 'confirm')}
                  type={showNew ? 'text' : 'password'}
                  name="confirm"
                  autoComplete="new-password"
                  value={form.confirm}
                />
                {fieldError('confirm')}
              </div>
            </div>
            <p className={styles.hint}>
              At least {MIN_LENGTH} characters. A few unrelated words make a strong one — no need
              for forced capitals or symbols. Not your name, your email address or the site's name.
            </p>
          </>
        ) : (
          <div className={styles.codeField}>
            <label className={a.label} htmlFor={`${FID}-code`}>6-digit code</label>
            <input
              {...fieldProps(guard.errors, FID, 'code')}
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className={a.inputMono}
              value={form.code}
              onChange={handleChange}
            />
            {fieldError('code')}
          </div>
        )}

        <div className={styles.actions}>
          {/* Dim until something is typed — never because it is invalid. */}
          <button
            key={guard.shakeKey}
            type="submit"
            className={`${a.btnPrimary} ${guard.shaking ? a.shake : ''}`}
            onAnimationEnd={guard.onShakeEnd}
            disabled={!dirty || busy}
          >
            {step === 'passwords'
              ? (busy ? 'SENDING…' : 'SEND CODE')
              : (busy ? 'SAVING…' : 'SAVE NEW PASSWORD')}
          </button>

          {step === 'code' && (
            <>
              <button
                type="button"
                className={a.btnGhost}
                onClick={sendCode}
                disabled={busy || secondsLeft > 0}
              >
                {secondsLeft > 0 ? `RESEND CODE IN ${secondsLeft}s` : 'RESEND CODE'}
              </button>
              <button type="button" className={a.btnGhost} onClick={backToPasswords} disabled={busy}>
                CANCEL
              </button>
            </>
          )}
        </div>
      </form>
      </div>
      </div>
    </section>
  );
}
