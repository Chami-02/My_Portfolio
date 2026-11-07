import { useViewDialog } from '../../../hooks/useViewDialog';
import { CloseIcon } from '../../icons/BrandIcons';
import { Highlighted } from './MessageParts';
import { formatSent } from '../../../utils/messageTime';
import a      from '../../../styles/admin.module.css';
import styles from './AdminMessagesPanel.module.css';

const TITLE_ID = 'sent-view-title';

/*
 * PF-154 (owner, 2026-11-07) — one sent reply, whole: who it went to, the
 * subject, when, the words, and the message it answered. MessageView's dialog
 * (useViewDialog: Esc, ← →, Tab kept inside, Back through the address).
 *
 * `stillInInbox`: true / false once the inbox has loaded, undefined before —
 * then neither the link nor the "deleted" note shows, rather than a guess.
 */
export function SentReplyView({
  reply, position, total, prev, next, zone, words, stillInInbox,
  onGo, onClose, onOpenMessage, onDelete,
}) {
  const { panelRef, closeRef } = useViewDialog({ onClose, onGo, prev, next });
  const sent = formatSent(reply.sentAt, zone);
  const received = formatSent(reply.original.receivedAt, zone);

  return (
    // The overlay root IS the backdrop: two stacked layers would take the clicks.
    <div
      className={styles.viewOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.viewPanel} ref={panelRef} data-sent-view="">
        <div className={styles.viewBar}>
          <button type="button" className={styles.viewStep} disabled={!prev}
            onClick={() => onGo(prev)} aria-label="Previous sent reply">‹</button>
          {position > 0 && (
            <span className={styles.viewCounter} aria-live="polite">{position} / {total}</span>
          )}
          <button type="button" className={styles.viewStep} disabled={!next}
            onClick={() => onGo(next)} aria-label="Next sent reply">›</button>
          <span className={a.spacer} />
          <button ref={closeRef} type="button" className={styles.viewStep} onClick={onClose} aria-label="Close">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className={styles.viewBody} tabIndex={0} aria-label="The whole reply">
          <div className={styles.viewHead}>
            <span className={styles.toLabel}>TO</span>
            <h2 id={TITLE_ID} className={styles.viewName}>
              <Highlighted text={reply.toName} words={words} />
            </h2>
          </div>
          <a href={`mailto:${reply.toEmail}`} className={styles.email}>
            <Highlighted text={reply.toEmail} words={words} />
          </a>
          <div className={styles.viewDetails}>
            <dl className={styles.details}>
              <div className={styles.detail}><dt>Subject</dt><dd>{reply.subject}</dd></div>
              <div className={styles.detail}><dt>Sent</dt><dd>{sent.date}</dd></div>
              <div className={styles.detail}>
                <dt>Time</dt><dd>{sent.time} <span className={styles.detailNote}>({zone})</span></dd>
              </div>
            </dl>
          </div>
          <p className={styles.viewMessage}><Highlighted text={reply.message} words={words} /></p>

          <section className={styles.replies} aria-label="The message you answered">
            <div className={styles.replyItem}>
              <p className={styles.replyWhen}>
                {reply.toName.toUpperCase()} WROTE · {received.date} · {received.time}
              </p>
              <p className={styles.original}><Highlighted text={reply.original.message} words={words} /></p>
            </div>
          </section>
          {stillInInbox === false && (
            <p className={styles.originalGone}>Their message has been deleted from your inbox.</p>
          )}
        </div>

        <div className={styles.viewActions}>
          {stillInInbox && (
            <button type="button" className={a.btnRow} onClick={() => onOpenMessage(reply.contact)}>
              OPEN THEIR MESSAGE
            </button>
          )}
          <span className={a.spacer} />
          <button type="button" className={a.btnRowDanger} onClick={() => onDelete(reply)}
            aria-label={`Delete your reply to ${reply.toName}`}>
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}
