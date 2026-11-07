import { useEffect, useRef, useState } from 'react';
import { useFormGuard } from '../../../hooks/useFormGuard';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useReplyToMessage } from '../../../hooks/useMessages';
import { errorId, fieldProps } from '../../../utils/formErrors';
import { friendlyError } from '../../../utils/friendlyError';
import a      from '../../../styles/admin.module.css';
import styles from './AdminMessagesPanel.module.css';

const FID = 'message-reply';
const MAX_LENGTH = 3000; // the route's own limit (contactController)

const validate = ({ text }) => {
  if (!text.trim()) return [{ field: 'text', message: 'This field is required.' }];
  if (text.trim().length > MAX_LENGTH) {
    return [{ field: 'text', message: `Please keep your reply under ${MAX_LENGTH} characters.` }];
  }
  return [];
};

/*
 * PF-153 (owner, 2026-11-05 and 2026-11-07) — answer a visitor from the panel, so
 * they see the domain instead of a Gmail address.
 *
 * Follows the standing form rules: `noValidate`, SEND dim until something is
 * typed, an invalid send refused with the banner and the field marked, and leaving
 * a typed reply asks first (useUnsavedChanges, which also covers Esc and Back: they
 * change the address, and the guard's blocker stops that).
 */
export function MessageReply({ message, onDone }) {
  const [text, setText] = useState('');
  const [serverError, setServerError] = useState('');
  const reply = useReplyToMessage();
  const guard = useFormGuard(validate, FID);
  const dirty = text !== '';
  const requestLeave = useUnsavedChanges({ dirty, what: 'your reply' });

  const boxRef = useRef(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
    // Optional-called: jsdom has no scrollIntoView (useFormGuard explains).
    boxRef.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (reply.isPending || !guard.check({ text })) return;
    setServerError('');
    try {
      const { recorded } = await reply.mutateAsync({ id: message._id, message: text.trim() });
      setText('');
      onDone(recorded ? 'sent' : 'unrecorded');
    } catch (err) {
      setServerError(friendlyError(err, { fallback: "Your reply wasn't sent. Please try again in a moment." }));
    }
  };

  const problem = guard.errorFor('text');

  return (
    <form className={styles.replyForm} onSubmit={send} noValidate aria-label="Reply to this message">
      {guard.errors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>CHECK THE CHANGES AGAIN — 1 field needs attention.</span>
        </div>
      )}
      {serverError && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}
      <p className={styles.replyTo}>To: {message.email}</p>
      <label className={a.label} htmlFor={`${FID}-text`}>Your reply *</label>
      <textarea
        {...fieldProps(guard.errors, FID, 'text')}
        ref={boxRef}
        rows={6}
        className={`${a.textarea} ${styles.replyBox}`}
        value={text}
        onChange={(e) => { setText(e.target.value); guard.clearField('text'); }}
      />
      {problem && <p className={a.fieldError} id={errorId(FID, 'text')} role="alert">{problem}</p>}
      <div className={styles.replyActions}>
        <button
          key={guard.shakeKey}
          type="submit"
          className={`${a.btnPrimary} ${guard.shaking ? a.shake : ''}`}
          onAnimationEnd={guard.onShakeEnd}
          disabled={!dirty || reply.isPending}
        >
          {reply.isPending ? 'SENDING…' : 'SEND REPLY'}
        </button>
        <button type="button" className={a.btnRow} disabled={reply.isPending}
          onClick={() => requestLeave(() => onDone(null))}>
          CANCEL
        </button>
      </div>
    </form>
  );
}
