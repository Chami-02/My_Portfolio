import { useMessages, useMarkMessageRead, useDeleteMessage } from '../../../hooks/useMessages';

export function AdminMessagesPanel() {
  // PF-107: these three were declared inline here with the literal key
  // ['messages']. They moved to hooks/useMessages.js when the shell's
  // sidebar badge became a second consumer — same key, same cache
  // entry, so nothing fetches twice.
  const { data: messages = [], isLoading } = useMessages();
  const markRead  = useMarkMessageRead();
  const deleteMsg = useDeleteMessage();

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.375rem' }}>Messages</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', fontFamily: 'var(--font-mono)' }}>
        {unreadCount} unread · {messages.length} total
      </p>

      <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3].map(n => <div key={n} className="skeleton" style={{ height: '100px', borderRadius: '0.625rem' }} />)}
          </div>
        ) : messages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
            No messages yet. Once recruiters fill out the contact form, they'll appear here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((msg) => (
              <div key={msg._id} style={{
                padding: '1.25rem', background: 'var(--bg)', borderRadius: '0.75rem',
                border: `1px solid ${msg.read ? 'var(--border)' : 'rgba(52,211,153,.35)'}`,
                position: 'relative',
              }}>
                {/* Unread marker — owner decision 2026-09-16: the site's
                    green (--ok), top-right, pulsing, and the header row
                    padded so the date clears it. The prototype
                    (Admin.dc.html:545) has the same geometry in orange;
                    green is the owner's deviation. `kf-glowdot` is the
                    GLOBAL carrier — the keyframe name cannot be written
                    inline any more than in a module — and the timing is
                    longhands, never the shorthand, which would reset the
                    name. Phase 1 inline styling otherwise; PF-115
                    transcribes the rest of this card. */}
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
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap', paddingRight: 20 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{msg.name}</span>
                  <a href={`mailto:${msg.email}`} style={{ color: 'var(--accent)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>{msg.email}</a>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                    {new Date(msg.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p style={{ color: 'var(--text-body)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '1rem' }}>{msg.message}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!msg.read && (
                    <button onClick={() => markRead.mutate(msg._id)} style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                      padding: '0.3rem 0.75rem', color: 'var(--text-body)', cursor: 'pointer', fontSize: '0.78rem',
                    }}>
                      ✓ Mark Read
                    </button>
                  )}
                  <a href={`mailto:${msg.email}?subject=Re: Your Portfolio Message`}
                    style={{ background: 'none', border: '1px solid rgba(129,140,248,0.3)', borderRadius: '0.375rem',
                      padding: '0.3rem 0.75rem', color: 'var(--accent)', fontSize: '0.78rem', textDecoration: 'none' }}>
                    ✉ Reply
                  </a>
                  <button onClick={() => deleteMsg.mutate(msg._id)} style={{
                    background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.375rem',
                    padding: '0.3rem 0.75rem', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem', marginLeft: 'auto',
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}