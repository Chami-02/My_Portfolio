import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../../icons/BrandIcons';
import { UnreadDot } from '../UnreadDot';
import { EmailNotSentTag, Highlighted, MessageDetails } from './MessageParts';
import { MessageReply } from './MessageReply';
import { formatSent } from '../../../utils/messageTime';
import a      from '../../../styles/admin.module.css';
import styles from './AdminMessagesPanel.module.css';

const TITLE_ID = 'message-view-title';

/*
 * PF-153 (owner, 2026-11-07): a message opens in a big view of its own, the way a
 * certificate does (CertificatesPage's CertificateView), so a long one never
 * stretches the list. REPLY, MARK READ and DELETE live here.
 *
 * Opening a message does NOT mark it read: MARK READ is the owner's "handled"
 * (PF-123), and the green dot stays until it is pressed.
 *
 */
export function MessageView({
  message, position, total, prev, next, zone, words,
  onGo, onClose, onStar, onMarkRead, onDelete,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  // Which message is being answered, so stepping to another closes the form.
  const [replyingTo, setReplyingTo] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  const replying = replyingTo === message._id;

  // Keyboard: Esc closes, ← → step, Tab stays inside the dialog. The listener is
  // added once and reads the latest values through a ref, refreshed every render.
  const keys = useRef(null);
  useEffect(() => { keys.current = { onClose, onGo, prev, next }; });
  useEffect(() => {
    const onKey = (e) => {
      const k = keys.current;
      // A dialog on top (the delete confirm, the unsaved-reply question) answers
      // its own keys.
      if (!k || document.querySelectorAll('[role="dialog"]').length > 1) return;
      const typing = e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Escape') { e.preventDefault(); k.onClose(); }
      // In the reply box the arrows move the cursor, not the message.
      else if (e.key === 'ArrowLeft' && k.prev && !typing) { e.preventDefault(); k.onGo(k.prev); }
      else if (e.key === 'ArrowRight' && k.next && !typing) { e.preventDefault(); k.onGo(k.next); }
      else if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('a[href], button:not([disabled])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Open: the page behind stops scrolling, focus moves in; closed: both undone.
  useEffect(() => {
    const opener = document.activeElement;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root.style.overflow = before;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    // The overlay root IS the backdrop: two stacked layers would take the clicks.
    <div
      className={styles.viewOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.viewPanel} ref={panelRef} data-message-view="">
        <div className={styles.viewBar}>
          <button type="button" className={styles.viewStep} disabled={!prev}
            onClick={() => onGo(prev)} aria-label="Previous message">‹</button>
          {position > 0 && (
            <span className={styles.viewCounter} aria-live="polite">{position} / {total}</span>
          )}
          <button type="button" className={styles.viewStep} disabled={!next}
            onClick={() => onGo(next)} aria-label="Next message">›</button>
          <span className={a.spacer} />
          <button
            type="button"
            className={message.starred ? `${styles.star} ${styles.starOn}` : styles.star}
            aria-pressed={Boolean(message.starred)}
            aria-label={`Star message from ${message.name}`}
            onClick={() => onStar(message)}
          >
            <span aria-hidden="true">{message.starred ? '★' : '☆'}</span>
          </button>
          <button ref={closeRef} type="button" className={styles.viewStep} onClick={onClose} aria-label="Close">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className={styles.viewBody} tabIndex={0} aria-label="The whole message">
          <div className={styles.viewHead}>
            {!message.read && <UnreadDot />}
            <h2 id={TITLE_ID} className={styles.viewName}>
              <Highlighted text={message.name} words={words} />
            </h2>
          </div>
          <a href={`mailto:${message.email}`} className={styles.email}>
            <Highlighted text={message.email} words={words} />
          </a>
          <div className={styles.viewDetails}>
            <MessageDetails message={message} zone={zone} withPlace />
          </div>
          <EmailNotSentTag message={message} />
          <p className={styles.viewMessage}><Highlighted text={message.message} words={words} /></p>
          {!message.read && <p className={styles.replyDue}>Please reply within 24 hours!!</p>}
          {message.replies?.length > 0 && (
            <section className={styles.replies} aria-label="Your replies">
              {message.replies.map((r) => (
                <div key={r.sentAt} className={styles.replyItem}>
                  <p className={styles.replyWhen}>YOU REPLIED · {formatSent(r.sentAt, zone).date} · {formatSent(r.sentAt, zone).time}</p>
                  <p className={styles.replyBody}>{r.message}</p>
                </div>
              ))}
            </section>
          )}
          {sentTo === message._id && <p className={styles.replySent} role="status">REPLY SENT.</p>}
          {replying && (
            <MessageReply
              key={message._id}
              message={message}
              onDone={(sent) => {
                setReplyingTo(null);
                if (sent) setSentTo(message._id);
              }}
            />
          )}
        </div>

        <div className={styles.viewActions}>
          {!replying && (
            <button type="button" className={styles.reply}
              onClick={() => { setSentTo(null); setReplyingTo(message._id); }}>
              ✉ REPLY
            </button>
          )}
          {message.read ? (
            // Owner, 2026-10-14: undo a read, so a message can be kept as a to-do.
            // Plain row button — not the success green MARK READ hovers with.
            <button type="button" className={a.btnRow} onClick={() => onMarkRead(message, false)}>
              ↺ MARK UNREAD
            </button>
          ) : (
            <button type="button" className={styles.markRead} onClick={() => onMarkRead(message, true)}>
              ✓ MARK READ
            </button>
          )}
          <span className={a.spacer} />
          <button type="button" className={a.btnRowDanger} onClick={() => onDelete(message)}
            aria-label={`Delete message from ${message.name}`}>
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}
