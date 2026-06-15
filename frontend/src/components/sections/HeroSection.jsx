import { useTypewriter } from '../../hooks/useTypewriter';
import { TerminalWindow } from '../common/TerminalWindow';

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com/Chami-02',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/chamikara-gallege-3b0861295',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    label: 'Email',
    href: 'mailto:parindrachameekara@gmail.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M2 7l10 7 10-7"/>
      </svg>
    ),
  },
];

export function HeroSection() {
  const typedRole = useTypewriter();

  return (
    <section
      id="hero"
      className="grid-bg"
      style={{
        minHeight: '100vh',
        paddingTop: '7rem',
        paddingBottom: '4rem',
        paddingLeft: 'var(--content-px)',
        paddingRight: 'var(--content-px)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial glow background — purely decorative */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 'var(--content-max)',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '4rem',
          alignItems: 'center',
        }}
        className="hero-grid"
      >
        {/* ── LEFT: Text Content ── */}
        <div style={{ maxWidth: '560px' }}>

          {/* Available badge */}
          <div
            className="animate-fade-in-up"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid rgba(52,211,153,0.3)',
              background: 'rgba(52,211,153,0.05)',
              borderRadius: '9999px',
              padding: '0.35rem 0.875rem',
              marginBottom: '1.75rem',
            }}
          >
            <span
              className="animate-pulse-glow"
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--green)',
                display: 'block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--green)',
                letterSpacing: '0.05em',
              }}
            >
              Open to opportunities
            </span>
          </div>

          {/* Name */}
          <h1
            className="animate-fade-in-up-delay-1"
            style={{
              fontSize: 'clamp(2.75rem, 6vw, 4.5rem)',
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              marginBottom: '0.5rem',
              color: 'var(--text-primary)',
            }}
          >
            Parindra<br />
            <span className="gradient-text">Chameekara</span>
          </h1>

          {/* Typewriter role */}
          <div
            className="animate-fade-in-up-delay-2"
            style={{
              height: '2rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1rem',
                fontWeight: 500,
                color: 'var(--accent)',
              }}
            >
              {typedRole}
              <span className="animate-blink" style={{ marginLeft: '1px' }}>|</span>
            </span>
          </div>

          {/* Bio */}
          <p
            className="animate-fade-in-up-delay-3"
            style={{
              color: 'var(--text-body)',
              fontSize: '1rem',
              lineHeight: 1.75,
              marginBottom: '2.5rem',
              maxWidth: '440px',
            }}
          >
            Building full-stack web applications with the MERN stack. 
            Containerized with Docker, tracked in Jira, shipped with CI/CD.
            Currently learning in public — this portfolio is a live project.
          </p>

          {/* CTA Buttons */}
          <div
            className="animate-fade-in-up-delay-4"
            style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}
          >
            <a href="#projects" className="btn-primary">
              View My Work
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
            <a href="#contact" className="btn-outline">
              Get In Touch
            </a>
          </div>

          {/* Social Links */}
          <div
            className="animate-fade-in-up-delay-5"
            style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
          >
            {SOCIAL_LINKS.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                target={label !== 'Email' ? '_blank' : undefined}
                rel="noreferrer noopener"
                aria-label={label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                  border: '1px solid var(--border)', color: 'var(--text-muted)',
                  transition: 'all 0.2s', textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.background = 'var(--accent-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {icon}
              </a>
            ))}

            <span style={{ color: 'var(--border-bright)', fontSize: '0.8rem', marginLeft: '0.5rem', fontFamily: 'var(--font-mono)' }}>
              — Chami-02
            </span>
          </div>
        </div>

        {/* ── RIGHT: Terminal Window ── */}
        <div
          className="animate-fade-in-up-delay-3"
          style={{ maxWidth: '500px', width: '100%' }}
        >
          <TerminalWindow />

          {/* Stats strip below terminal */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            {[
              { value: '8', label: 'Sprints Planned' },
              { value: '44+', label: 'Jira Tickets' },
              { value: '100%', label: 'Dockerized' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="glass"
                style={{
                  padding: '0.875rem',
                  borderRadius: '0.625rem',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent)' }}>
                  {value}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.15em' }}>SCROLL</span>
        <div
          style={{
            width: '1px',
            height: '40px',
            background: 'linear-gradient(to bottom, var(--border-bright), transparent)',
          }}
          className="animate-float"
        />
      </div>

      {/* Responsive grid styles */}
     <style>{`
        @media (min-width: 900px) {
        .hero-grid { grid-template-columns: 1fr 1fr !important; }
      }
        @media (max-width: 899px) {
        .hero-grid { grid-template-columns: 1fr !important; }
      }
      `}</style>
    </section>
  );
}