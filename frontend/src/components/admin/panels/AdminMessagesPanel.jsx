import { useState } from 'react';
import { useMessages, useMarkMessageRead, useStarMessage, useDeleteMessage }
  from '../../../hooks/useMessages';
import { searchWords, messageMatches, highlightParts, MESSAGE_TABS }
  from '../../../utils/messageSearch';
import { CloseIcon }     from '../../icons/BrandIcons';
import { ConfirmDialog } from '../ConfirmDialog';
import a      from '../../../styles/admin.module.css';
import styles from './AdminMessagesPanel.module.css';

/*
 * ── PF-115 — the Messages panel, Phase 2 ────────────────────────────────────
 *
 * The card is Admin.dc.html:538-568. Three owner additions (2026-10-07) have no
 * prototype source:
 *
 *   • a STAR — "special messages can be put a star… it goes to star section
 *     but it see in the all messages section too". Admin-only, so it takes
 *     effect at once like MARK READ; the staging rule is about what reaches
 *     the public site.
 *   • SEARCH — any term, across name, email and text; every word must match;
 *     matches are highlighted. Runs over the list already in hand
 *     (utils/messageSearch.js says why).
 *   • ALL · UNREAD · STARRED filters, applied together with the search.
 *
 * And one fix: DELETE asks first. It used to delete on the first click.
 */

const DATE_FORMAT = { year: 'numeric', month: 'short', day: 'numeric' };

/** `text` with every hit wrapped in <mark> — as TEXT, never HTML. */
function Highlighted({ text, words }) {
  return highlightParts(text, words).map((part, i) =>
    part.match
      ? <mark key={i} className={styles.hit}>{part.text}</mark>
      : <span key={i}>{part.text}</span>);
}

/** The server's message, or the plain truth that no server answered. */
const messageFor = (err, fallback) =>
  err?.response
    ? (err.response.data?.message || fallback)
    : 'Cannot reach the server — it may not be running.';

export function AdminMessagesPanel() {
  // PF-107 moved these into hooks/useMessages.js; the key is still ['messages'].
  const { data: messages = [], isLoading } = useMessages();
  const markRead  = useMarkMessageRead();
  const star      = useStarMessage();
  const deleteMsg = useDeleteMessage();

  const [query,     setQuery]     = useState('');
  const [tab,       setTab]       = useState('all');
  const [confirmId, setConfirmId] = useState(null);
  // Server failures only — this panel has no fields to mark.
  const [serverError, setServerError] = useState(null);

  const words     = searchWords(query);
  const activeTab = MESSAGE_TABS.find((t) => t.key === tab);
  // Tab first, then the search. The counts are the TAB totals, before the
  // search — so they do not jump about while a word is being typed.
  const inTab   = messages.filter(activeTab.test);
  const visible = inTab.filter((m) => messageMatches(m, words));

  const onError = (fallback) => (err) => setServerError(messageFor(err, fallback));

  const handleDelete = async () => {
    try {
      await deleteMsg.mutateAsync(confirmId);
      setServerError(null);
    } catch (err) {
      setServerError(messageFor(err, 'Could not delete the message.'));
    }
    setConfirmId(null);
  };

  const confirmTarget = messages.find((m) => m._id === confirmId);

  /** What the list area says when it has no cards to show. */
  const emptyText = () => {
    if (messages.length === 0) {
      return 'No messages yet. Once recruiters fill out the contact form, they will appear here.';
    }
    if (words.length > 0) {
      const where = tab === 'all' ? '' : ` in ${activeTab.label}`;
      return `No messages match “${query.trim()}”${where}.`;
    }
    return tab === 'starred'
      ? 'No starred messages. Press ☆ on a message to keep it here.'
      : 'No unread messages.';
  };

  return (
    <div className={a.stack}>
      {serverError && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <section className={a.panel} aria-label="Messages">
        <div className={styles.controls}>
          {/* A <form role="search"> like /blog's, so the field is announced as
              search. Results narrow as you type; Enter submits nothing. */}
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <label className={styles.searchField}>
              <span aria-hidden="true" className={styles.searchSlash}>/</span>
              <input
                type="text"
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search names, emails, messages…"
                aria-label="Search messages"
              />
              {query !== '' && (
                <button type="button" className={styles.searchClear}
                  onClick={() => setQuery('')} aria-label="Clear search">
                  <CloseIcon size={14} />
                </button>
              )}
            </label>
          </form>

          {/* Toggle buttons in a group — the honest semantics for a filter,
              the way /blog's tag chips are. (role="tablist" would promise
              arrow-key roving and a tabpanel this does not have.) */}
          <div className={styles.filters} role="group" aria-label="Show">
            {MESSAGE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={t.key === tab ? `${styles.filter} ${styles.filterOn}` : styles.filter}
                aria-pressed={t.key === tab}
                onClick={() => setTab(t.key)}
              >
                {t.label} <span className={styles.filterCount}>{messages.filter(t.test).length}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.list} aria-busy="true">
            <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
          </div>
        ) : visible.length === 0 ? (
          // Inline and polite, never a modal — a live search hits zero
          // results mid-word as a matter of course (the /blog decision).
          <p className={styles.status} role="status">{emptyText()}</p>
        ) : (
          <ul className={styles.list} role="list">
            {visible.map((msg) => {
              const cardClass = [
                styles.card,
                msg.starred && styles.cardStarred,
                !msg.read && styles.cardUnread,
              ].filter(Boolean).join(' ');

              return (
                <li key={msg._id} className={cardClass} data-message-card="">
                  {/* Unread marker — owner decision 2026-09-16: the site's
                      green (--ok), top-right, pulsing. The prototype
                      (Admin.dc.html:545) has the same geometry in orange.
                      `kf-glowdot` is the GLOBAL carrier — the keyframe name
                      cannot be written inline any more than in a module —
                      and the timing is longhands, never the shorthand, which
                      would reset the name. */}
                  {!msg.read && (
                    <span
                      aria-hidden="true"
                      data-unread-dot=""
                      className="kf-glowdot"
                      style={{
                        position: 'absolute', top: 17, right: 17,
                        width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', display: 'block',
                        animationDuration: '2.4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
                      }}
                    />
                  )}
                  <div className={styles.head}>
                    <span className={styles.name}><Highlighted text={msg.name} words={words} /></span>
                    <a href={`mailto:${msg.email}`} className={styles.email}>
                      <Highlighted text={msg.email} words={words} />
                    </a>
                    <span className={a.spacer} />
                    <button
                      type="button"
                      className={msg.starred ? `${styles.star} ${styles.starOn}` : styles.star}
                      aria-pressed={Boolean(msg.starred)}
                      aria-label={`Star message from ${msg.name}`}
                      onClick={() => star.mutate(
                        { id: msg._id, starred: !msg.starred },
                        { onError: onError('Could not change the star.') },
                      )}
                    >
                      <span aria-hidden="true">{msg.starred ? '★' : '☆'}</span>
                    </button>
                    <span className={styles.date}>
                      {new Date(msg.createdAt).toLocaleDateString('en-US', DATE_FORMAT)}
                    </span>
                  </div>
                  <p className={styles.message}><Highlighted text={msg.message} words={words} /></p>
                  <div className={styles.actions}>
                    {!msg.read && (
                      <button type="button" className={styles.markRead}
                        onClick={() => markRead.mutate(msg._id, { onError: onError('Could not mark the message read.') })}>
                        ✓ MARK READ
                      </button>
                    )}
                    <a href={`mailto:${msg.email}?subject=Re: Your Portfolio Message`} className={styles.reply}>
                      ✉ REPLY
                    </a>
                    <span className={a.spacer} />
                    <button type="button" className={a.btnRowDanger} onClick={() => setConfirmId(msg._id)}
                      aria-label={`Delete message from ${msg.name}`}>
                      DELETE
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* PF-115: DELETE asks first — the shared dialog, the prototype's own
          copy (Admin.dc.html:1227). Focus lands on CANCEL. */}
      {confirmId && (
        <ConfirmDialog
          title="Delete message?"
          busy={deleteMsg.isPending}
          onCancel={() => setConfirmId(null)}
          onConfirm={handleDelete}
        >
          This will permanently delete the message from {confirmTarget?.name ?? 'this sender'}.
        </ConfirmDialog>
      )}
    </div>
  );
}
