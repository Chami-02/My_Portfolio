import { highlightParts } from '../../../utils/messageSearch';
import { emailNotSent, formatSent } from '../../../utils/messageTime';
import styles from './AdminMessagesPanel.module.css';

/** `text` with every hit wrapped in <mark> — as TEXT, never HTML. */
export function Highlighted({ text, words }) {
  return highlightParts(text, words).map((part, i) =>
    part.match
      ? <mark key={i} className={styles.hit}>{part.text}</mark>
      : <span key={i}>{part.text}</span>);
}

/**
 * PF-123 — DATE · TIME · FROM, what the owner's email copy shows. A description
 * list: each label names its value for a screen reader, which loose spans would
 * not. The card leaves FROM to the big view, to stay one short line.
 */
export function MessageDetails({ message, zone, withPlace = false }) {
  const sent = formatSent(message.createdAt, zone);
  return (
    <dl className={styles.details}>
      <div className={styles.detail}>
        <dt>Date</dt><dd>{sent.date}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Time</dt><dd>{sent.time} <span className={styles.detailNote}>({zone})</span></dd>
      </div>
      {withPlace && message.location && (
        <div className={styles.detail}>
          <dt>From</dt><dd>{message.location} <span className={styles.detailNote}>(approx.)</span></dd>
        </div>
      )}
    </dl>
  );
}

/** PF-123's "never silent", made visible (PF-153). */
export function EmailNotSentTag({ message }) {
  return emailNotSent(message) ? <span className={styles.emailTag}>EMAIL NOT SENT</span> : null;
}
