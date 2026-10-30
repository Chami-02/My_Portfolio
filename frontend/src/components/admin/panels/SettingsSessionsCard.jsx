// frontend/src/components/admin/panels/SettingsSessionsCard.jsx
import { useRef, useState } from 'react';
import { useSessions, useEndSessions, useSignInHistory } from '../../../hooks/useSessions';
import { useAdminFlash }  from '../../../hooks/useAdminFlash';
import { useFormGuard }   from '../../../hooks/useFormGuard';
import { resetErrorMessage }   from '../../../utils/resetError';
import { formatDate }     from '../../../utils/blogMeta';
import { activeText }     from '../../../utils/sessionTimes';
import { formatSent }     from '../../../utils/messageTime';
import { ConfirmDialog }  from '../ConfirmDialog';
import { LoadError }      from '../LoadError';
import { PasswordConfirmForm } from '../PasswordConfirmForm';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

const FID = 'settings-sessions';

const METHOD_LABELS = { password: 'Password', google: 'Google' };

// PF-133 — what each history row says happened.
const EVENT_TEXT = {
  'sign-in':         { ok: 'Signed in', failed: 'Failed sign-in' },
  'reset-request':   { ok: 'Reset code requested', failed: 'Reset requested — unknown address' },
  'password-reset':  { ok: 'Password reset', failed: 'Password reset' },
  'password-change': { ok: 'Password changed', failed: 'Password changed' },
  // PF-135 — `failed` = the password re-check refused it.
  'backup-download': { ok: 'Backup downloaded', failed: 'Backup download — wrong password' },
  'backup-restore':  { ok: 'Backup restored', failed: 'Backup restore — wrong password' },
};
/** Rows shown at first, and added by each SHOW MORE — the server sends 50. */
const PAGE = 10;

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
 * PF-133's sign-in history is the card's second part (owner, 2026-10-29):
 * RECENT ACTIVITY, with its own query and its own LoadError.
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
      <div className={styles.foldBody}>
      {query.isError && <LoadError what="SESSIONS" query={query} />}

      {query.isSuccess && (
        <>
          <h3 className={`${a.labelLead} ${styles.subhead}`} id={`${FID}-now`}>Signed in now</h3>
          <ul className={styles.sessions} aria-labelledby={`${FID}-now`}>
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

      <RecentActivity />
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
            <PasswordConfirmForm
              fid={FID}
              guard={guard}
              inputRef={passwordRef}
              password={password}
              onPasswordChange={setPassword}
              error={error}
              onSubmit={confirm}
            />
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

/**
 * PF-133 — every sign-in attempt, reset request, reset and change: the
 * account's own and those for addresses that match no account (someone
 * trying addresses). OWASP: log successes AND failures, and let the owner
 * see them. Kept 90 days on the server; the newest 10 show, SHOW MORE adds
 * 10 at a time up to the 50 sent, SHOW LESS goes back — the card never
 * grows without limit (owner, 2026-10-29).
 *
 * Times are the READER's own clock (dates stay reader-local), in the
 * Messages panel's YYYY/MM/DD 12-hour form.
 */
function RecentActivity() {
  const query = useSignInHistory();
  const [shown, setShown] = useState(PAGE);
  const events = query.data ?? [];

  return (
    <div className={styles.activity}>
      <h3 className={`${a.labelLead} ${styles.subhead}`} id={`${FID}-activity`}>Recent activity</h3>
      {query.isError && <LoadError what="SIGN-IN HISTORY" query={query} />}

      {query.isSuccess && events.length === 0 && (
        <p className={styles.note}>Nothing yet. Sign-ins and failed attempts show here for 90 days.</p>
      )}

      {query.isSuccess && events.length > 0 && (
        <>
          <ul className={styles.sessions} aria-labelledby={`${FID}-activity`}>
            {events.slice(0, shown).map((e) => {
              const failed = e.outcome === 'failed';
              const when = formatSent(e.at);
              return (
                <li key={e.id} className={styles.session}>
                  <div className={styles.sessionText}>
                    <p className={styles.sessionDevice}>
                      <span className={failed ? styles.badgeFailed : a.badgeOk}>{failed ? 'FAILED' : 'OK'}</span>
                      <span className={styles.value}>
                        {[EVENT_TEXT[e.kind]?.[e.outcome] ?? e.kind, METHOD_LABELS[e.method]].filter(Boolean).join(' · ')}
                      </span>
                    </p>
                    <p className={styles.sessionMeta}>
                      {[e.address, e.device, e.location, `${when.date} ${when.time}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {events.length > PAGE && (
            <div className={styles.actions}>
              {shown < events.length && (
                <button type="button" className={a.btnRow} onClick={() => setShown((n) => n + PAGE)}>
                  SHOW MORE
                </button>
              )}
              {shown > PAGE && (
                <button type="button" className={a.btnRow} onClick={() => setShown(PAGE)}>
                  SHOW LESS
                </button>
              )}
            </div>
          )}
          {/* Owner, 2026-10-29: a line you don't recognise says what to do. */}
          <p className={styles.note}>
            Don&apos;t recognise a line? Change your password above, then sign out any device you don&apos;t know.
          </p>
        </>
      )}
    </div>
  );
}
