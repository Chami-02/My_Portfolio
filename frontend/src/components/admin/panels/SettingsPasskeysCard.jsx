// frontend/src/components/admin/panels/SettingsPasskeysCard.jsx
import { useRef, useState } from 'react';
import {
  usePasskeys, usePrepareAddPasskey, useFinishAddPasskey, useRemovePasskey,
} from '../../../hooks/usePasskeys';
import { useAdminFlash }  from '../../../hooks/useAdminFlash';
import { useFormGuard }   from '../../../hooks/useFormGuard';
import { passkeySupported } from '../../../services/passkeyService';
import { passkeyAddMessage } from '../../../utils/passkeyError';
import { resetErrorMessage } from '../../../utils/resetError';
import { formatDate }     from '../../../utils/blogMeta';
import { ConfirmDialog }  from '../ConfirmDialog';
import { LoadError }      from '../LoadError';
import { PasswordConfirmForm } from '../PasswordConfirmForm';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

const FID = 'settings-passkeys';

// Module scope: useFormGuard's `check` is memoised on the validator.
const passwordErrors = ({ password }) =>
  (password ? [] : [{ field: 'password', message: 'Enter your password.' }]);

/**
 * PF-140 — the passkeys that can sign in to this account.
 *
 * Standards: OWASP MFA Cheat Sheet — adding or removing a way in needs an
 * existing factor (the password; a live session may be a borrowed laptop), and
 * the server emails an alert.
 *
 * ⚠️ Adding takes TWO presses, deliberately. The password goes to the server,
 * and a browser may refuse to show the fingerprint prompt once a network wait
 * has passed since the press (Safari is the strict one). So CREATE PASSKEY is
 * its own press, with the answer already in hand.
 *
 * Actions are immediate, not staged, and a typed password is not unsaved work:
 * the same reasoning as the Sessions card, whose fold and classes these are.
 */
export function SettingsPasskeysCard() {
  const query   = usePasskeys();
  const prepare = usePrepareAddPasskey();
  const finish  = useFinishAddPasskey();
  const remove  = useRemovePasskey();
  const { showFlash } = useAdminFlash();

  const [folded,   setFolded]   = useState(true);
  // null | { step: 'password' } | { step: 'create', options } | { step: 'remove', id, label }
  const [dialog,   setDialog]   = useState(null);
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const guard       = useFormGuard(passwordErrors, FID);
  const passwordRef = useRef(null);

  const passkeys = query.data ?? [];
  const busy = prepare.isPending || finish.isPending || remove.isPending;

  const open = (next) => {
    setDialog(next);
    setPassword('');
    setError('');
    guard.reset();
  };
  const close = () => { if (!busy) setDialog(null); };

  const confirmPassword = async (e) => {
    e?.preventDefault();
    if (!guard.check({ password })) return;
    setError('');
    try {
      const options = await prepare.mutateAsync({ password });
      setPassword('');
      setDialog({ step: 'create', options });
    } catch (err) {
      setError(resetErrorMessage(err));
    }
  };

  const create = async () => {
    setError('');
    try {
      const added = await finish.mutateAsync(dialog.options);
      setDialog(null);
      showFlash(`Passkey added: ${added.label ?? 'this device'}`);
    } catch (err) {
      setError(passkeyAddMessage(err));
      // The server has spent this challenge, so the next try starts over. A
      // stop on the device has not, and CREATE PASSKEY can be pressed again.
      if (err?.isAxiosError) setDialog({ step: 'password' });
    }
  };

  const confirmRemove = async (e) => {
    e?.preventDefault();
    if (!guard.check({ password })) return;
    setError('');
    try {
      await remove.mutateAsync({ id: dialog.id, password });
      setDialog(null);
      showFlash(`Passkey removed: ${dialog.label}`);
    } catch (err) {
      setError(resetErrorMessage(err));
    }
  };

  const passwordForm = (onSubmit) => (
    <PasswordConfirmForm
      fid={FID}
      guard={guard}
      inputRef={passwordRef}
      password={password}
      onPasswordChange={setPassword}
      error={error}
      onSubmit={onSubmit}
    />
  );

  return (
    <section className={a.panel} aria-labelledby={`${FID}-title`}>
      <div className={styles.disclosureHead}>
        <h2 className={a.panelTitle} id={`${FID}-title`}>Passkeys</h2>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={!folded}
          aria-controls={`${FID}-body`}
          onClick={() => setFolded((f) => !f)}
        >
          MANAGE PASSKEYS
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>
      </div>

      {/* No count until loaded (PF-117). */}
      {query.isSuccess && folded && (
        <p className={styles.lastChanged}>
          {passkeys.length === 0 ? 'NONE YET' : `${passkeys.length} ON THIS ACCOUNT`}
        </p>
      )}

      <div
        id={`${FID}-body`}
        className={`${styles.collapse} ${folded ? '' : styles.collapseOpen}`}
        inert={folded}
      >
      <div className={styles.collapseInner}>
      <div className={styles.foldBody}>
      <p className={`${styles.note} ${styles.noteIntro}`}>
        Sign in with your fingerprint instead of typing a password. Your fingerprint never leaves your
        device. Your password and Google keep working.
      </p>

      {query.isError && <LoadError what="PASSKEYS" query={query} />}

      {query.isSuccess && (
        <>
          {passkeys.length > 0 && (
            <>
            <h3 className={`${a.labelLead} ${styles.subhead}`} id={`${FID}-list`}>Your passkeys</h3>
            <ul className={styles.sessions} aria-labelledby={`${FID}-list`}>
              {passkeys.map((p) => (
                <li key={p.id} className={styles.session}>
                  <div className={styles.sessionText}>
                    <p className={styles.sessionDevice}>
                      <span className={styles.value}>{p.label ?? 'Unnamed passkey'}</span>
                      {p.synced && <span className={a.badge}>SYNCED</span>}
                    </p>
                    <p className={styles.sessionMeta}>
                      {`ADDED ${formatDate(p.addedAt)} · ${p.lastUsedAt ? `LAST USED ${formatDate(p.lastUsedAt)}` : 'NOT USED YET'}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={a.btnRowDanger}
                    onClick={() => open({ step: 'remove', id: p.id, label: p.label ?? 'this passkey' })}
                  >
                    REMOVE
                  </button>
                </li>
              ))}
            </ul>
            </>
          )}

          {passkeySupported() ? (
            <div className={`${styles.actions} ${styles.actionsCompact}`}>
              <button type="button" className={a.btnRow} onClick={() => open({ step: 'password' })}>
                + ADD A PASSKEY
              </button>
            </div>
          ) : (
            <p className={styles.note}>This browser can&apos;t make passkeys. Try a recent version of Chrome, Safari or Edge.</p>
          )}
        </>
      )}
      </div>
      </div>
      </div>

      {dialog?.step === 'password' && (
        <ConfirmDialog
          title="Add a passkey"
          onConfirm={confirmPassword}
          onCancel={close}
          confirmLabel="CONTINUE"
          busyLabel="CHECKING…"
          confirmTone="primary"
          busy={prepare.isPending}
          initialFocusRef={passwordRef}
          extra={passwordForm(confirmPassword)}
        >
          First, confirm with your password. We&apos;ll email you when a passkey is added.
        </ConfirmDialog>
      )}

      {dialog?.step === 'create' && (
        <ConfirmDialog
          title="Create your passkey"
          onConfirm={create}
          onCancel={close}
          confirmLabel="CREATE PASSKEY"
          busyLabel="WAITING FOR YOUR DEVICE…"
          confirmTone="primary"
          busy={finish.isPending}
          extra={error && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        >
          Press CREATE PASSKEY, then use your fingerprint. A device without a fingerprint reader uses its own lock instead.
        </ConfirmDialog>
      )}

      {dialog?.step === 'remove' && (
        <ConfirmDialog
          title={`Remove ${dialog.label}?`}
          onConfirm={confirmRemove}
          onCancel={close}
          confirmLabel="REMOVE"
          busyLabel="REMOVING…"
          busy={remove.isPending}
          initialFocusRef={passwordRef}
          extra={passwordForm(confirmRemove)}
        >
          It stops signing in straight away, though your device may still list it until you delete it there. Confirm with your password.
        </ConfirmDialog>
      )}
    </section>
  );
}
