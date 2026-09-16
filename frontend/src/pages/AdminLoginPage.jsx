import { useState }                              from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { authService }         from '../services/authService';
import { session }             from '../services/session';
import { loginErrorMessage }   from '../utils/loginError';
import a from '../styles/admin.module.css';

/**
 * Where to go after signing in. ProtectedRoute hands over the location the
 * user was trying to reach as `state.from`; a direct visit has none and
 * lands on the dashboard. PF-108 — this page used to hard-navigate to
 * `/admin` and discard the captured destination.
 */
const destinationFrom = (location) => {
  const from = location.state?.from;
  if (!from?.pathname) return '/admin';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
};

export function AdminLoginPage() {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();
  const location              = useLocation();
  const destination           = destinationFrom(location);

  // A stored refresh token means "probably signed in" — send them through
  // ProtectedRoute, which asks the server. If the token is dead the silent
  // refresh clears it and ProtectedRoute sends them back here with nothing
  // in storage, so this cannot loop. Rendered, not an effect: the old
  // `useEffect` + `isLoggedIn()` painted the form for one frame first.
  if (session.hasRefreshToken()) {
    return <Navigate to={destination} replace />;
  }

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.login(form.email, form.password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '2rem',
      background:     'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }} className="animate-fade-in-up">

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--accent)' }}>&lt;</span>PC<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span><span style={{ color: 'var(--accent)' }}>&gt;</span>
            </span>
          </Link>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '0.75rem',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '1.5rem', marginBottom: '0.375rem' }}>
            Portfolio CMS
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Admin Sign In
          </h1>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background:   'rgba(239,68,68,0.06)',
            border:       '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.625rem',
            padding:      '0.875rem 1rem',
            marginBottom: '1.25rem',
            display:      'flex',
            gap:          '0.5rem',
            alignItems:   'flex-start',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"
              style={{ width: 16, height: 16, flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className={a.label}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="admin@portfolio.dev"
              value={form.email}
              onChange={handleChange}
              className={a.input}
            />
          </div>

          <div>
            <label className={a.label}>
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className={a.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width:          '100%',
              justifyContent: 'center',
              marginTop:      '0.5rem',
              opacity:        loading ? 0.7 : 1,
              cursor:         loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, border: '2px solid currentColor',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.6s linear infinite',
                }} />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Back link */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none',
            fontFamily: 'var(--font-mono)', transition: 'color 0.2s' }}
            onMouseEnter={(e) => { e.target.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)'; }}>
            ← Back to Portfolio
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}