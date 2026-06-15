import { useInView } from '../../hooks/useInView';

const STATS = [
  { value: '6+',   label: 'Months Learning' },
  { value: '5+',   label: 'Projects Built'  },
  { value: '44',   label: 'Jira Tickets'    },
  { value: '100%', label: 'Self-Taught'     },
];

export function AboutSection() {
  const [ref, inView] = useInView();

  return (
    <section id="about" style={{ padding: 'var(--section-y) var(--content-px)' }}>
      <div
        ref={ref}
        className={`reveal ${inView ? 'revealed' : ''}`}
        style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}
      >
        {/* Section heading */}
        <span className="section-label">01 / About</span>
        <h2 className="section-title">Who I Am</h2>
        <div className="section-divider" />

        {/* Two-column grid: text left, stats right */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '4rem',
            alignItems: 'center',
          }}
          className="about-grid"
        >
          {/* ── Left: Bio text ── */}
          <div style={{ maxWidth: '520px' }}>
            <p
              style={{
                color: 'var(--text-body)',
                lineHeight: 1.85,
                marginBottom: '1.25rem',
                fontSize: '1rem',
              }}
            >
              I'm a self-taught developer based in{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                Sri Lanka
              </span>
              , building my skills one real project at a time. I focus on clean,
              documented code and learning industry-standard tools — not tutorials,
              but shipping actual working software.
            </p>

            <p
              style={{
                color: 'var(--text-body)',
                lineHeight: 1.85,
                marginBottom: '1.25rem',
                fontSize: '1rem',
              }}
            >
              This portfolio is not a template. It's a{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                live MERN application
              </span>{' '}
              tracked in Jira, containerized with Docker, tested with Vitest and
              Jest, and deployed through a GitHub Actions CI/CD pipeline — built
              exactly the way a professional engineering team would build it.
            </p>

            <p
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}
            >
              Currently open to junior developer roles and freelance projects.
            </p>

            {/* CTA row */}
            <div
              style={{
                marginTop: '2rem',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <a
                href="#projects"
                className="btn-primary"
                style={{ fontSize: '0.875rem', padding: '0.625rem 1.375rem' }}
              >
                See My Work
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ width: 15, height: 15 }}
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="/Parindra_Chameekara_CV.pdf"
                target="_blank"
                rel="noreferrer"
                className="btn-outline"
                style={{ fontSize: '0.875rem', padding: '0.625rem 1.375rem' }}
              >
                Download CV
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ width: 15, height: 15 }}
                >
                  <path d="M12 15V3M6 9l6 6 6-6M3 21h18" />
                </svg>
              </a>
            </div>
          </div>

          {/* ── Right: Stats grid ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
            }}
          >
            {STATS.map(({ value, label }, i) => (
              <div
                key={label}
                className="glass"
                style={{
                  padding: '1.75rem 1.25rem',
                  borderRadius: '0.875rem',
                  textAlign: 'center',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'var(--border-bright)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: '2.5rem',
                    color: 'var(--accent)',
                    lineHeight: 1,
                    marginBottom: '0.5rem',
                  }}
                >
                  {value}
                </p>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile, side-by-side on tablet+ */}
      <style>{`
        @media (min-width: 768px) {
          .about-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}