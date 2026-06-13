import { useState } from 'react';
import { useInView } from '../../hooks/useInView';

export function ContactSection() {
  const [ref, inView] = useInView();
  const [form,   setForm]   = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errMsg, setErrMsg] = useState('');

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ⚠️ NOTE: In Sprint 5 (PF-32), this handleSubmit will be replaced
  // to POST to your real Express API at /api/contact.
  // For now it simulates a network delay so you can see the UI states.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrMsg('');
    await new Promise((r) => setTimeout(r, 1200)); // simulate API call
    setStatus('success');
    setForm({ name: '', email: '', message: '' });
  };

  /* Shared input style — avoids repeating inline styles */
  const INPUT = {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '0.625rem',
    padding: '0.875rem 1rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const focusInput  = (e) => { e.target.style.borderColor = 'var(--accent)'; };
  const blurInput   = (e) => { e.target.style.borderColor = 'var(--border)'; };

  return (
    <section
      id="contact"
      style={{
        padding: 'var(--section-y) var(--content-px)',
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-surface) 100%)',
      }}
    >
      <div
        ref={ref}
        className={`reveal ${inView ? 'revealed' : ''}`}
        style={{ maxWidth: '640px', margin: '0 auto' }}
      >
        <span className="section-label">04 / Contact</span>
        <h2 className="section-title">Get In Touch</h2>
        <div className="section-divider" />

        <p style={{ color: 'var(--text-body)', marginBottom: '2.5rem', lineHeight: 1.8 }}>
          I'm actively looking for junior developer opportunities. If you have a role,
          a project, or just want to connect — send me a message. I respond within 24 hours.
        </p>

        {/* ── Success state ── */}
        {status === 'success' ? (
          <div
            style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: '1rem',
              padding: '3rem 2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✓</div>
            <p
              style={{
                color: 'var(--green)',
                fontWeight: 600,
                fontSize: '1.1rem',
                marginBottom: '0.5rem',
              }}
            >
              Message received!
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              I'll get back to you within 24 hours.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="btn-outline"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
            >
              Send another message
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Error banner */}
            {status === 'error' && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '0.625rem',
                  padding: '0.875rem 1rem',
                }}
              >
                <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{errMsg}</p>
              </div>
            )}

            {/* Name + Email side-by-side on tablet+ */}
            <div style={{ display: 'grid', gap: '1.25rem' }} className="form-row">
              <div>
                <label
                  htmlFor="contact-name"
                  style={{
                    display: 'block',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Parindra Chameekara"
                  value={form.name}
                  onChange={handleChange}
                  onFocus={focusInput}
                  onBlur={blurInput}
                  style={INPUT}
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  style={{
                    display: 'block',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  onFocus={focusInput}
                  onBlur={blurInput}
                  style={INPUT}
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="contact-message"
                style={{
                  display: 'block',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={6}
                placeholder="Tell me about the role, project, or just say hi..."
                value={form.message}
                onChange={handleChange}
                onFocus={focusInput}
                onBlur={blurInput}
                style={{ ...INPUT, resize: 'vertical', minHeight: '140px' }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                opacity: status === 'sending' ? 0.7 : 1,
                cursor: status === 'sending' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'sending' ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                  Sending...
                </>
              ) : (
                <>
                  Send Message
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ width: 16, height: 16 }}
                  >
                    <path d="M22 2L11 13M22 2l-7 18-4-8-8-4 18-7z" />
                  </svg>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @media (min-width: 540px) {
          .form-row { grid-template-columns: 1fr 1fr !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}