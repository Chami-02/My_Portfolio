// frontend/src/components/admin/panels/SettingsSessionsCard.jsx
import { useRef, useState } from 'react';
import { useSessions, useEndSessions } from '../../../hooks/useSessions';
import { useAdminFlash }  from '../../../hooks/useAdminFlash';
import { useFormGuard }   from '../../../hooks/useFormGuard';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { resetErrorMessage }   from '../../../utils/resetError';
import { formatDate }     from '../../../utils/blogMeta';
import { activeText }     from '../../../utils/sessionTimes';
import { ConfirmDialog }  from '../ConfirmDialog';
import { LoadError }      from '../LoadError';
import { EyeIcon, EyeOffIcon } from '../../icons/BrandIcons';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

const FID = 'settings-sessions';

const METHOD_LABELS = { password: 'Password', google: 'Google' };

// Module scope: useFormGuard's `check` is memoised on the validator.
const passwordErrors = ({ password }) =>
  (password ? [] : [{ field: 'password', message: 'Enter your password.' }]);

/**
 * PF-132 — every device signed in to the admin, and a way to sign any of
 * them out.
 *
 * Standards: OWASP ASVS 5.0 V7.5.2 — view and end any or all active
 * sessions, AFTER authenticating again; so each sign-out asks for the
 * current password (owner's choice, 2026-10-29). Ending a session is
 * immediate (NIST SP 800-63B-4 §7): the server revokes the session family
 * and its access token dies with it.
 *
 * ⚠️ Actions are immediate, not staged: this is not site content, so the
 * panels' "nothing changes until SAVE" rule does not apply (like PF-124's
 * password change). A typed password is not unsaved work either, so the
 * card does not join the unsaved-changes guard.
 *
 * THIS device has no button: SIGN OUT in the header ends it and also clears
 * this browser's tokens, which a server-side revoke here could not.
 *
 * PF-133's sign-in history joins this card as its second part (owner,
 * 2026-10-29); until it is built, nothing on screen stands in for it.
 *
 * FOLDS like the Password card (owner, 2026-10-29): one line, MANAGE
 * SESSIONS ▾, sliding open with the same classes — so the two cannot drift.
 * The list is still fetched on mount, so it is there when the fold opens
 * and the slide never jumps when data lands. Focus stays on the toggle: a
 * list has no first field to move to.
 */
export function SettingsSessionsCard() {
  const query = useSessions();
  const end   = useEndSessions();
  const { showFlash } = useAdminFlash();

  // null | { id, device } for one device | { id: null } for every other one.
  const [folded,   setFolded]   = useState(true);
  const [target,   setTarget]   = useState(null);
  const [password, setPassword] = useState('');
  const [shown,    setShown]    = useState(false);
  const [error,    setError]    = useState('');
  const guard       = useFormGuard(passwordErrors, FID);
  const passwordRef = useRef(null);

  const sessions = query.data ?? [];
  const others   = sessions.filter((s) => !s.current);
  // This device first — it is the one the reader is sitting at.
  const ordered  = [...sessions.filter((s) => s.current), ...others];

  const open = (next) => {
    setTarget(next);
    setPassword('');
    setShown(false);
    setError('');
    guard.reset();
  };
  const close = () => { if (!end.isPending) setTarget(null); };

  const confirm = async (e) => {
    e?.preventDefault();
    if (!guard.check({ password })) return;
    setError('');
    try {
      await end.mutateAsync({ id: target.id ?? undefined, password });
      setTarget(null);
      showFlash(target.id ? `Signed out ${target.device}` : 'Signed out every other session');
    } catch (err) {
      // 404: that device had already ended — the list refetches; say so.
      setError(resetErrorMessage(err));
    }
  };

  return (
    <section className={a.panel} aria-labelledby={`${FID}-title`}>
      <div className={styles.disclosureHead}>
        <h2 className={a.panelTitle} id={`${FID}-title`}>Sessions</h2>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={!folded}
          aria-controls={`${FID}-body`}
          onClick={() => setFolded((f) => !f)}
        >
          MANAGE SESSIONS
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>
      </div>

      <div
        id={`${FID}-body`}
        className={`${styles.collapse} ${folded ? '' : styles.collapseOpen}`}
        inert={folded}
      >
      <div className={styles.collapseInner}>
      <div className={styles.sessionsBody}>
      {query.isError && <LoadError what="SESSIONS" query={query} />}

      {query.isSuccess && (
        <>
          <h3 className={`${a.labelLead} ${styles.subhead}`}>Signed in now</h3>
          <ul className={styles.sessions}>
            {ordered.map((s) => (
              <li key={s.id} className={styles.session}>
                <div className={styles.sessionText}>
                  <p className={styles.sessionDevice}>
                    <span className={styles.value}>{s.device ?? 'Unknown device'}</span>
                    {s.current && <span className={a.badgeOk}>THIS DEVICE</span>}
                  </p>
                  {/* Each fact only when known — a session from before PF-132
                      recorded none of them, and a guess would be a lie. */}
                  <p className={styles.sessionMeta}>
                    {[
                      METHOD_LABELS[s.signInMethod],
                      s.location,
                      s.startedAt && `SIGNED IN ${formatDate(s.startedAt)}`,
                      s.current ? 'ACTIVE NOW' : activeText(s.lastActiveAt),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    className={a.btnRowDanger}
                    onClick={() => open({ id: s.id, device: s.device ?? 'that device' })}
                  >
                    SIGN OUT
                  </button>
                )}
              </li>
            ))}
          </ul>

          {others.length > 0 ? (
            <div className={styles.actions}>
              <button type="button" className={a.btnRowDanger} onClick={() => open({ id: null })}>
                SIGN OUT ALL OTHER SESSIONS
              </button>
            </div>
          ) : (
            <p className={styles.note}>No other device is signed in.</p>
          )}
        </>
      )}
      </div>
      </div>
      </div>

      {target && (
        <ConfirmDialog
          title={target.id ? `Sign out ${target.device}?` : 'Sign out every other session?'}
          onConfirm={confirm}
          onCancel={close}
          confirmLabel="SIGN OUT"
          busyLabel="SIGNING OUT…"
          busy={end.isPending}
          initialFocusRef={passwordRef}
          extra={(
            <form className={a.form} onSubmit={confirm} noValidate>
              {error && (
                <div className={a.bannerError} role="alert">
                  <span className={a.bannerDot} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className={a.label} htmlFor={`${FID}-password`}>Your password</label>
                <div className={a.passwordWrap}>
                  <input
                    {...fieldProps(guard.errors, FID, 'password')}
                    ref={passwordRef}
                    className={a.input}
                    type={shown ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); guard.clearField('password'); }}
                  />
                  <button
                    type="button"
                    className={a.reveal}
                    aria-label="Show password"
                    aria-pressed={shown}
                    aria-controls={`${FID}-password`}
                    onClick={() => setShown((v) => !v)}
                  >
                    {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
                {guard.errorFor('password') && (
                  <p className={a.fieldError} id={errorId(FID, 'password')} role="alert">
                    {guard.errorFor('password')}
                  </p>
                )}
              </div>
            </form>
          )}
        >
          {target.id
            ? 'That device is signed out at once and must sign in again. Confirm with your password.'
            : 'Every device except this one is signed out at once. Confirm with your password.'}
        </ConfirmDialog>
      )}
    </section>
  );
}
