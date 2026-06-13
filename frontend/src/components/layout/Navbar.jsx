import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'About',    href: '#about' },
  { label: 'Skills',   href: '#skills' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact',  href: '#contact' },
];

export function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [activeId,  setActiveId]  = useState('');

  // ── Scroll-based effects ──────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);

      // Highlight the section currently in view
      const sectionIds = NAV_LINKS.map((l) => l.href.slice(1));
      for (const id of [...sectionIds].reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveId(id);
          break;
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Lock body scroll when mobile menu is open ─────────────────
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleNavClick = (e, href) => {
    e.preventDefault();
    setMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      const offset = 80; // Navbar height compensation
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* ── Main Nav Bar ── */}
      <header
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 50,
          transition: 'all 0.3s ease',
          ...(scrolled ? {
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          } : {
            background: 'transparent',
          }),
        }}
      >
        <div
          style={{
            maxWidth: 'var(--content-max)',
            margin: '0 auto',
            padding: '0 var(--content-px)',
            height: '4.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              <span style={{ color: 'var(--accent)' }}>&lt;</span>
              PC
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>
              <span style={{ color: 'var(--accent)' }}>&gt;</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav style={{ display: 'flex', gap: '0.25rem' }} className="hidden-mobile">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = activeId === href.slice(1);
              return (
                <a
                  key={label}
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    color: isActive ? 'var(--accent)' : 'var(--text-body)',
                    background: isActive ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="show-mobile"
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              padding: '0.5rem',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              width: '40px',
              height: '40px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                display: 'block', width: '18px', height: '2px',
                background: 'currentColor', borderRadius: '1px',
                transition: 'all 0.3s',
                transform: menuOpen ? 'rotate(45deg) translateY(6px)' : 'none',
              }}
            />
            <span
              style={{
                display: 'block', width: '18px', height: '2px',
                background: 'currentColor', borderRadius: '1px',
                transition: 'all 0.3s',
                opacity: menuOpen ? 0 : 1,
              }}
            />
            <span
              style={{
                display: 'block', width: '18px', height: '2px',
                background: 'currentColor', borderRadius: '1px',
                transition: 'all 0.3s',
                transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
              }}
            />
          </button>
        </div>
      </header>

      {/* ── Mobile Full-Screen Menu ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(3, 7, 18, 0.98)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'opacity 0.3s, visibility 0.3s',
          opacity: menuOpen ? 1 : 0,
          visibility: menuOpen ? 'visible' : 'hidden',
          pointerEvents: menuOpen ? 'auto' : 'none',
        }}
      >
        {NAV_LINKS.map(({ label, href }, i) => (
          <a
            key={label}
            href={href}
            onClick={(e) => handleNavClick(e, href)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              padding: '0.5rem 2rem',
              borderRadius: '0.5rem',
              transition: 'color 0.2s',
              transform: menuOpen ? 'translateY(0)' : 'translateY(16px)',
              transitionDelay: `${i * 0.07}s`,
              opacity: menuOpen ? 1 : 0,
            }}
            onMouseEnter={(e) => { e.target.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.target.style.color = 'var(--text-primary)'; }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* ── Responsive CSS (inline style tag workaround for Tailwind v4) ── */}
      <style>{`
        @media (min-width: 768px) {
          .hidden-mobile { display: flex !important; }
          .show-mobile   { display: none !important; }
        }
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
      `}</style>
    </>
  );
}