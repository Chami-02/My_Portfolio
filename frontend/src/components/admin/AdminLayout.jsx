import { useState }           from 'react';
import { useNavigate }        from 'react-router-dom';
import { authService }        from '../../services/authService';

const NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',  icon: '⊞' },
  { id: 'projects',  label: 'Projects',  icon: '◈' },
  { id: 'skills',    label: 'Skills',    icon: '{ }' },
  { id: 'about',     label: 'About',     icon: '👤' },
  { id: 'blog',      label: 'Blog',      icon: '📝' },
  { id: 'messages',  label: 'Messages',  icon: '✉' },
];

export function AdminLayout({ children, activeTab, onTabChange }) {
  const navigate      = useNavigate();
  const [mobile, setMobile] = useState(false);

  const handleLogout = () => {
    authService.logout();
    navigate('/admin/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width:           '220px',
        flexShrink:      0,
        background:      'var(--bg-surface)',
        borderRight:     '1px solid var(--border)',
        display:         'flex',
        flexDirection:   'column',
        position:        'fixed',
        top:             0,
        left:            0,
        bottom:          0,
        zIndex:          30,
        transition:      'transform 0.3s',
        transform:       mobile ? 'translateX(0)' : undefined,
      }} className="admin-sidebar">

        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--accent)' }}>&lt;</span>PC<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span><span style={{ color: 'var(--accent)' }}>&gt;</span>
          </span>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', letterSpacing: '0.1em' }}>
            ADMIN PANEL
          </p>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '1rem 0.75rem', flexGrow: 1 }}>
          {NAV_ITEMS.map(({ id, label, icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { onTabChange(id); setMobile(false); }}
                style={{
                  width:          '100%',
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '0.625rem',
                  padding:        '0.625rem 0.875rem',
                  borderRadius:   '0.5rem',
                  border:         'none',
                  cursor:         'pointer',
                  fontFamily:     'var(--font-sans)',
                  fontSize:       '0.875rem',
                  fontWeight:     isActive ? 600 : 400,
                  marginBottom:   '0.125rem',
                  transition:     'all 0.15s',
                  background:     isActive ? 'var(--accent-glow)' : 'transparent',
                  color:          isActive ? 'var(--accent)' : 'var(--text-body)',
                  textAlign:      'left',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; } }}
              >
                <span style={{ fontSize: '0.9rem', minWidth: '1.25rem' }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <a href="/" target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem',
            color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
            borderRadius: '0.375rem', marginBottom: '0.25rem', transition: 'color 0.2s',
          }}>
            ↗ View Site
          </a>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.875rem', color: '#f87171', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
              borderRadius: '0.375rem', textAlign: 'left', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            ⏻ Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div style={{ marginLeft: '220px', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }} className="admin-main">

        {/* Top bar */}
        <header style={{
          height: '3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.5rem', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20,
        }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {NAV_ITEMS.find((i) => i.activeTab === activeTab)?.label || NAV_ITEMS.find((i) => i.id === activeTab)?.label || 'Dashboard'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              admin@portfolio.dev
            </span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '1.75rem 1.5rem', flexGrow: 1 }}>
          {children}
        </main>
      </div>

      {/* Responsive: collapse sidebar on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { transform: translateX(-100%); }
          .admin-main { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}