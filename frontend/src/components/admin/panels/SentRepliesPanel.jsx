import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDeleteSentReply, useDeleteSentReplies } from '../../../hooks/useMessages';
import { searchWords, sentMatches, previewText } from '../../../utils/messageSearch';
import { formatSent } from '../../../utils/messageTime';
import { friendlyError } from '../../../utils/friendlyError';
import { CloseIcon }     from '../../icons/BrandIcons';
import { ConfirmDialog } from '../ConfirmDialog';
import { LoadError }     from '../LoadError';
import { Highlighted }   from './MessageParts';
import { SentReplyView } from './SentReplyView';
import a      from '../../../styles/admin.module.css';
import styles from './AdminMessagesPanel.module.css';

/*
 * PF-154 (owner, 2026-11-07) — SENT: every reply sent from the panel, newest
 * first, in the inbox's own shapes (search, three-line cards, ticks, a big view
 * in the address, the shared confirm before a delete).
 *
 * Deleting is permanent and removes the panel's copy only — the visitor already
 * has the email, and the confirm says so. ⚠️ The inbox's rule holds here too:
 * bulk delete acts only on what is on screen (`chosen`), never on a reply a
 * search has hidden.
 */
export function SentRepliesPanel({ sentQuery, messagesQuery, zone }) {
  const { data: replies = [], isLoading } = sentQuery;
  // Failed AND nothing to show (the inbox's rule).
  const isError = sentQuery.isError && sentQuery.data === undefined;
  const removeOne  = useDeleteSentReply();
  const removeMany = useDeleteSentReplies();

  const [query,      setQuery]      = useState('');
  const [selected,   setSelected]   = useState(() => new Set());
  // `{ id }` for one reply, `{ many: true }` for what is ticked.
  const [confirming, setConfirming] = useState(null);
  const [serverError, setServerError] = useState(null);

  const words   = searchWords(query);
  const visible = replies.filter((r) => sentMatches(r, words));
  const chosen  = visible.filter((r) => selected.has(r._id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;

  // ── The big view, in the address (the inbox's pattern) ──────────────────
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openId = params.get('sent');
  const openReply = openId ? replies.find((r) => r._id === openId) : undefined;
  const openIndex = visible.findIndex((r) => r._id === openId);
  const prevReply = openIndex > 0 ? visible[openIndex - 1] : null;
  const nextReply = (openIndex >= 0 ? visible[openIndex + 1] : visible[0]) ?? null;

  const openView = (r) => setParams({ box: 'sent', sent: r._id }, { state: { fromList: true } });
  const goTo = (r) => setParams({ box: 'sent', sent: r._id }, { replace: true, state: location.state });
  const closeView = () => {
    if (location.state?.fromList) navigate(-1);
    else setParams({ box: 'sent' }, { replace: true });
  };

  // Gone: deleted on another device, or an old address.
  const missing = Boolean(openId) && !isLoading && !isError && !openReply;
  useEffect(() => {
    if (missing) setParams({ box: 'sent' }, { replace: true });
  }, [missing, setParams]);

  // Whether the answered message is still in the inbox — unknown until it loads.
  const inboxIds = messagesQuery.data ? new Set(messagesQuery.data.map((m) => m._id)) : null;
  const stillInInbox = (r) => (inboxIds ? inboxIds.has(String(r.contact)) : undefined);
  const openMessage = (contactId) => setParams({ message: String(contactId) });

  // ── Deleting ────────────────────────────────────────────────────────────
  const toggle = (id) => setSelected((old) => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((old) => {
    const next = new Set(old);
    visible.forEach((r) => (allChosen ? next.delete(r._id) : next.add(r._id)));
    return next;
  });

  const handleDelete = async () => {
    if (confirming.many) {
      try {
        await removeMany.mutateAsync(chosen.map((r) => r._id));
        setSelected(new Set());
        setServerError(null);
      } catch (err) {
        setServerError(friendlyError(err, { fallback: 'Could not delete the sent replies.' }));
      }
      setConfirming(null);
      return;
    }
    // The one to show next, chosen before this one leaves the list.
    const after = confirming.id === openId ? (nextReply ?? prevReply) : null;
    try {
      await removeOne.mutateAsync(confirming.id);
      setServerError(null);
      if (confirming.id === openId) {
        if (after) goTo(after);
        else closeView();
      }
    } catch (err) {
      setServerError(friendlyError(err, { fallback: 'Could not delete the sent reply.' }));
    }
    setConfirming(null);
  };

  const confirmTarget = replies.find((r) => r._id === confirming?.id);

  const emptyText = () => (replies.length === 0
    ? 'No replies sent yet. When you reply to a message, your reply appears here.'
    : `No sent replies match “${query.trim()}”.`);

  return (
    <>
      {serverError && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <section className={a.panel} aria-label="Sent replies">
        <div className={styles.controls}>
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <label className={styles.searchField}>
              <span aria-hidden="true" className={styles.searchSlash}>/</span>
              <input
                type="text"
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search names, emails, replies…"
                aria-label="Search sent replies"
              />
              {query !== '' && (
                <button type="button" className={styles.searchClear}
                  onClick={() => setQuery('')} aria-label="Clear search">
                  <CloseIcon size={14} />
                </button>
              )}
            </label>
          </form>
        </div>

        {isLoading ? (
          <div className={styles.list} aria-busy="true">
            <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
          </div>
        ) : isError ? (
          <LoadError what="YOUR SENT REPLIES" query={sentQuery} />
        ) : visible.length === 0 ? (
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
              {visible.map((r) => {
                const sent = formatSent(r.sentAt, zone);
                return (
                  <li key={r._id} className={styles.card} data-sent-card="">
                    <div className={styles.head}>
                      <label className={styles.tickArea}>
                        <input
                          type="checkbox"
                          className={styles.tick}
                          checked={selected.has(r._id)}
                          onChange={() => toggle(r._id)}
                          aria-label={`Select your reply to ${r.toName}`}
                        />
                      </label>
                      <span className={styles.toLabel}>TO</span>
                      <span className={styles.name}><Highlighted text={r.toName} words={words} /></span>
                      <span className={styles.email}><Highlighted text={r.toEmail} words={words} /></span>
                    </div>
                    <dl className={styles.details}>
                      <div className={styles.detail}><dt>Sent</dt><dd>{sent.date}</dd></div>
                      <div className={styles.detail}>
                        <dt>Time</dt><dd>{sent.time} <span className={styles.detailNote}>({zone})</span></dd>
                      </div>
                    </dl>
                    <button type="button" className={styles.preview} onClick={() => openView(r)}
                      aria-label={`Read your reply to ${r.toName}`}>
                      <span className={styles.previewText}>
                        <Highlighted text={previewText(r.message, words)} words={words} />
                      </span>
                    </button>
                    <div className={styles.cardFoot}>
                      <span className={styles.answering}>Answering: “{r.original.message}”</span>
                      <button type="button" className={a.btnRow} onClick={() => openView(r)}
                        aria-label={`Open your reply to ${r.toName}`}>
                        OPEN
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {chosen.length > 0 && (
              <div className={styles.bulkBar} role="group" aria-label="Selected sent replies">
                <span className={styles.bulkCount} aria-live="polite">{chosen.length} SELECTED</span>
                <button type="button" className={a.btnRow} onClick={() => setSelected(new Set())}>
                  CLEAR SELECTION
                </button>
                <span className={a.spacer} />
                <button type="button" className={a.btnRowDanger} disabled={removeMany.isPending}
                  onClick={() => setConfirming({ many: true })}>
                  DELETE
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {openReply && (
        <SentReplyView
          reply={openReply}
          position={openIndex + 1}
          total={visible.length}
          prev={prevReply}
          next={nextReply}
          zone={zone}
          words={words}
          stillInInbox={stillInInbox(openReply)}
          onGo={goTo}
          onClose={closeView}
          onOpenMessage={openMessage}
          onDelete={(r) => setConfirming({ id: r._id })}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.many
            ? `Delete ${chosen.length} sent ${chosen.length === 1 ? 'reply' : 'replies'}?`
            : 'Delete sent reply?'}
          busy={confirming.many ? removeMany.isPending : removeOne.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={handleDelete}
        >
          {confirming.many
            ? `This permanently removes ${chosen.length === 1 ? 'the selected reply' : `the ${chosen.length} selected replies`} from SENT. Emails already received can’t be unsent.`
            : `This permanently removes your reply to ${confirmTarget?.toName ?? 'this person'} from SENT. The email they received can’t be unsent.`}
        </ConfirmDialog>
      )}
    </>
  );
}
