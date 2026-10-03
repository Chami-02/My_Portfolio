import { useEffect, useRef } from 'react';
import a      from '../../styles/admin.module.css';
import styles from './ConfirmDialog.module.css';

/**
 * The admin's one destructive-action confirm (PF-113).
 *
 * Generalises the prototype's single modal (Admin.dc.html:605-615), which
 * serves `kind: 'project' | 'post' | 'message'` from one `askDelete(kind, id,
 * title, body)` (Admin.dc.html:967-974). It replaces the project-only modal and
 * the tag-only one that PF-97 wrote inline; PF-115 moves Messages onto it.
 *
 * It knows nothing about WHAT is being deleted — the caller passes the words
 * and the action. That is the point: the vocabulary confirm's real content is
 * the server's impact count, which only the caller can fetch.
 *
 * ⚠️ BOTH buttons are `type="button"`, and that is load-bearing. The
 * vocabulary picker renders this INSIDE the record's <form>, and a button with
 * no type is a submit: PF-97's tag dialog once deleted the tag AND silently
 * saved the whole post (Silent failures).
 *
 * @param confirmDisabled  e.g. while an impact count is still loading — a "0"
 *                         that is really "not known yet" is a confident lie at
 *                         exactly the moment the reader decides
 */
export function ConfirmDialog({
  title, children, onConfirm, onCancel,
  confirmLabel = 'YES, DELETE', busyLabel = 'DELETING…',
  busy = false, confirmDisabled = false,
}) {
  const cancelRef = useRef(null);

  // Focus lands on CANCEL — the safe choice for a destructive dialog, so an
  // Enter pressed out of habit does nothing irreversible. Focus goes back to
  // whatever opened the dialog when it closes, so a keyboard user is not
  // dropped at the top of the page.
  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => { if (opener instanceof HTMLElement) opener.focus(); };
  }, []);

  // Escape cancels. On `document`, because focus may have been moved anywhere
  // inside; ignored while the delete is in flight.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className={styles.card}>
        <h3 className={styles.title} id="confirm-dialog-title">{title}</h3>
        <p className={styles.body}>{children}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${a.btnDanger} ${styles.yes}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
          <button
            type="button"
            ref={cancelRef}
            className={`${a.btnOutline} ${styles.no}`}
            onClick={onCancel}
            disabled={busy}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
