import { friendlyError } from '../../../utils/friendlyError';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMessages, useMarkMessageRead, useStarMessage, useDeleteMessage, useBulkMessages }
  from '../../../hooks/useMessages';
import { searchWords, messageMatches, previewText, MESSAGE_TABS }
  from '../../../utils/messageSearch';
import { useAbout } from '../../../hooks/useAbout';
import { DEFAULT_ZONE } from '../../../utils/messageTime';
import { CloseIcon }     from '../../icons/BrandIcons';
import { ConfirmDialog } from '../ConfirmDialog';
import { LoadError }     from '../LoadError';
import { UnreadDot }     from '../UnreadDot';
import { EmailNotSentTag, Highlighted, MessageDetails } from './MessageParts';
import { MessageView }   from './MessageView';
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
 *
 * PF-123 (owner, 2026-10-20): the card shows what the owner's email copy
 * shows — DATE (YYYY/MM/DD), TIME (12-hour, the About panel's zone, so the
 * card and the email always agree), FROM (the sender's approximate location,
 * when known) — and, while the message is UNREAD, the red "Please reply within
 * 24 hours!!" below a solid line. MARK READ is the owner's "handled".
 *
 * PF-153 (owner, 2026-11-07): a card is a short preview and a message opens in
 * MessageView, so a long one never stretches the list. Tick boxes and SELECT ALL
 * act on several at once.
 *
 * ⚠️ SELECT ALL and the bulk buttons act only on what is on screen under the
 * current filter and search (`chosen`). `selected` may hold more, and must never
 * be sent as it is: a message hidden by a search would go without being seen.
 */

/** One plain sentence for any failure (utils/friendlyError.js, PF-144). */
const messageFor = (err, fallback) => friendlyError(err, { fallback });

export function AdminMessagesPanel() {
  // PF-107 moved these into hooks/useMessages.js; the key is still ['messages'].
  const messagesQuery = useMessages();
  const { data: messages = [], isLoading } = messagesQuery;
  // Failed AND nothing to show. A background refetch that fails keeps the
  // last good `data` and still sets isError — that list is fine to show.
  const isError = messagesQuery.isError && messagesQuery.data === undefined;
  const markRead  = useMarkMessageRead();
  const star      = useStarMessage();
  const deleteMsg = useDeleteMessage();
  // Blank `timezone` = "hide it on the site", not "no zone" — fall back.
  const zone = useAbout().data?.timezone || DEFAULT_ZONE;

  const bulk      = useBulkMessages();

  const [query,     setQuery]     = useState('');
  const [tab,       setTab]       = useState('all');
  // `{ id }` for one message, `{ many: true }` for what is ticked.
  const [confirming, setConfirming] = useState(null);
  const [selected,  setSelected]  = useState(() => new Set());
  // Server failures only — this panel has no fields to mark.
  const [serverError, setServerError] = useState(null);

  const words     = searchWords(query);
  const activeTab = MESSAGE_TABS.find((t) => t.key === tab);
  // Tab first, then the search. The counts are the TAB totals, before the
  // search — so they do not jump about while a word is being typed.
  const inTab   = messages.filter(activeTab.test);
  const visible = inTab.filter((m) => messageMatches(m, words));
  const chosen  = visible.filter((m) => selected.has(m._id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;

  const onError = (fallback) => (err) => setServerError(messageFor(err, fallback));

  // ── The big view ────────────────────────────────────────────────────────
  // In the address, so the phone's Back button closes it. `fromList` says a
  // history entry sits behind it to go back to; a reload has none.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openId = params.get('message');
  const openMessage = openId ? messages.find((m) => m._id === openId) : undefined;
  const openIndex = visible.findIndex((m) => m._id === openId);
  // Marked read under UNREAD, it leaves the list but stays open; "next" is then
  // the first one left.
  const prevMessage = openIndex > 0 ? visible[openIndex - 1] : null;
  const nextMessage = (openIndex >= 0 ? visible[openIndex + 1] : visible[0]) ?? null;

  const openView = (msg) => setParams({ message: msg._id }, { state: { fromList: true } });
  const goTo = (msg) => setParams({ message: msg._id }, { replace: true, state: location.state });
  const closeView = () => {
    if (location.state?.fromList) navigate(-1);
    else setParams({}, { replace: true });
  };

  // Gone: deleted on another device, or an old address.
  const missing = Boolean(openId) && !isLoading && !isError && !openMessage;
  useEffect(() => {
    if (missing) setParams({}, { replace: true });
  }, [missing, setParams]);

  // ── Acting on messages ──────────────────────────────────────────────────
  const setStar = (msg) => star.mutate(
    { id: msg._id, starred: !msg.starred },
    { onError: onError('Could not change the star.') },
  );
  const setRead = (msg, read) => markRead.mutate(
    { id: msg._id, read },
    { onError: onError(`Could not mark the message ${read ? 'read' : 'unread'}.`) },
  );

  const toggle = (id) => setSelected((old) => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((old) => {
    const next = new Set(old);
    visible.forEach((m) => (allChosen ? next.delete(m._id) : next.add(m._id)));
    return next;
  });

  const runBulk = async (action, fallback) => {
    try {
      await bulk.mutateAsync({ action, ids: chosen.map((m) => m._id) });
      setSelected(new Set());
      setServerError(null);
    } catch (err) {
      setServerError(messageFor(err, fallback));
    }
  };

  const handleDelete = async () => {
    if (confirming.many) {
      await runBulk('delete', 'Could not delete the messages.');
      setConfirming(null);
      return;
    }
    // The one to show next, chosen before this one leaves the list.
    const after = confirming.id === openId ? (nextMessage ?? prevMessage) : null;
    try {
      await deleteMsg.mutateAsync(confirming.id);
      setServerError(null);
      if (confirming.id === openId) {
        if (after) goTo(after);
        else closeView();
      }
    } catch (err) {
      setServerError(messageFor(err, 'Could not delete the message.'));
    }
    setConfirming(null);
  };

  const confirmTarget = messages.find((m) => m._id === confirming?.id);

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
                {t.label}{!isLoading && !isError && (
                  <> <span className={styles.filterCount}>{messages.filter(t.test).length}</span></>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.list} aria-busy="true">
            <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
          </div>
        ) : isError ? (
          <LoadError what="YOUR MESSAGES" query={messagesQuery} />
        ) : visible.length === 0 ? (
          // Inline and polite, never a modal — a live search hits zero
          // results mid-word as a matter of course (the /blog decision).
          <p className={styles.status} role="status">{emptyText()}</p>
        ) : (
          <>
            <label className={styles.selectAll}>
              <input
                type="checkbox"
                className={styles.tick}
                checked={allChosen}
                ref={(el) => { if (el) el.indeterminate = chosen.length > 0 && !allChosen; }}
                onChange={toggleAll}
              />
              SELECT ALL
            </label>

            <ul className={styles.list} role="list">
              {visible.map((msg) => {
                const cardClass = [
                  styles.card,
                  msg.starred && styles.cardStarred,
                  !msg.read && styles.cardUnread,
                ].filter(Boolean).join(' ');

                return (
                  <li key={msg._id} className={cardClass} data-message-card="">
                    {!msg.read && <UnreadDot style={{ position: 'absolute', top: 17, right: 17 }} />}
                    <div className={styles.head}>
                      <label className={styles.tickArea}>
                        <input
                          type="checkbox"
                          className={styles.tick}
                          checked={selected.has(msg._id)}
                          onChange={() => toggle(msg._id)}
                          aria-label={`Select message from ${msg.name}`}
                        />
                      </label>
                      <span className={styles.name}><Highlighted text={msg.name} words={words} /></span>
                      <span className={styles.email}><Highlighted text={msg.email} words={words} /></span>
                      <span className={a.spacer} />
                      <button
                        type="button"
                        className={msg.starred ? `${styles.star} ${styles.starOn}` : styles.star}
                        aria-pressed={Boolean(msg.starred)}
                        aria-label={`Star message from ${msg.name}`}
                        onClick={() => setStar(msg)}
                      >
                        <span aria-hidden="true">{msg.starred ? '★' : '☆'}</span>
                      </button>
                    </div>
                    <MessageDetails message={msg} zone={zone} />
                    {/* The first three lines. The whole text stays in the page,
                        so a screen reader and a search hit still reach it. */}
                    <button type="button" className={styles.preview} onClick={() => openView(msg)}
                      aria-label={`Read the message from ${msg.name}`}>
                      <span className={styles.previewText}><Highlighted text={previewText(msg.message, words)} words={words} /></span>
                    </button>
                    <div className={styles.cardFoot}>
                      {!msg.read && <span className={styles.replyDueShort}>Please reply within 24 hours!!</span>}
                      <EmailNotSentTag message={msg} />
                      {msg.replies?.length > 0 && <span className={styles.repliedTag}>REPLIED</span>}
                      <span className={a.spacer} />
                      <button type="button" className={a.btnRow} onClick={() => openView(msg)}
                        aria-label={`Open message from ${msg.name}`}>
                        OPEN
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {chosen.length > 0 && (
              <div className={styles.bulkBar} role="group" aria-label="Selected messages">
                <span className={styles.bulkCount} aria-live="polite">{chosen.length} SELECTED</span>
                <button type="button" className={styles.markRead} disabled={bulk.isPending}
                  onClick={() => runBulk('read', 'Could not mark the messages read.')}>
                  ✓ MARK READ
                </button>
                <button type="button" className={a.btnRow} onClick={() => setSelected(new Set())}>
                  CLEAR SELECTION
                </button>
                <span className={a.spacer} />
                <button type="button" className={a.btnRowDanger} disabled={bulk.isPending}
                  onClick={() => setConfirming({ many: true })}>
                  DELETE
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {openMessage && (
        <MessageView
          message={openMessage}
          position={openIndex + 1}
          total={visible.length}
          prev={prevMessage}
          next={nextMessage}
          zone={zone}
          words={words}
          onGo={goTo}
          onClose={closeView}
          onStar={setStar}
          onMarkRead={setRead}
          onDelete={(msg) => setConfirming({ id: msg._id })}
        />
      )}

      {/* PF-115: DELETE asks first — the shared dialog, the prototype's own
          copy (Admin.dc.html:1227). Focus lands on CANCEL. After MessageView, so
          the dialog sits on top of it at the same z-index. */}
      {confirming && (
        <ConfirmDialog
          title={confirming.many
            ? `Delete ${chosen.length} ${chosen.length === 1 ? 'message' : 'messages'}?`
            : 'Delete message?'}
          busy={confirming.many ? bulk.isPending : deleteMsg.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={handleDelete}
        >
          {confirming.many
            ? `This will permanently delete the ${chosen.length === 1 ? 'selected message' : `${chosen.length} selected messages`}.`
            : `This will permanently delete the message from ${confirmTarget?.name ?? 'this sender'}.`}
        </ConfirmDialog>
      )}
    </div>
  );
}
