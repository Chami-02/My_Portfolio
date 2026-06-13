import { useInView }  from '../../hooks/useInView';
import { PROJECTS }   from '../../data/projects';

/* ── Individual project card ── */
function ProjectCard({ project, index }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'revealed' : ''}`}
      style={{ transitionDelay: `${index * 0.08}s` }}
    >
      <div
        className="glass"
        style={{
          borderRadius: '1rem',
          padding: '1.75rem',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          transition: 'border-color 0.25s, transform 0.25s, box-shadow 0.25s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor  = 'rgba(129,140,248,0.45)';
          e.currentTarget.style.transform    = 'translateY(-5px)';
          e.currentTarget.style.boxShadow    =
            '0 24px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(129,140,248,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.transform   = 'none';
          e.currentTarget.style.boxShadow   = 'none';
        }}
      >
        {/* Top row: folder icon + featured badge + link icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Folder icon */}
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.625rem',
                background: 'var(--accent-glow)',
                border: '1px solid rgba(129,140,248,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ width: 18, height: 18, color: 'var(--accent)' }}
              >
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </div>

            {project.featured && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--accent)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  border: '1px solid rgba(129,140,248,0.3)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  background: 'var(--accent-glow)',
                }}
              >
                ★ Featured
              </span>
            )}
          </div>

          {/* GitHub + live link */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                transition: 'all 0.2s',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color       = 'var(--accent)';
                e.currentTarget.style.background  = 'var(--accent-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color       = 'var(--text-muted)';
                e.currentTarget.style.background  = 'transparent';
              }}
            >
              {/* GitHub icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15 }}>
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>

            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="View live demo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color       = 'var(--accent)';
                  e.currentTarget.style.background  = 'var(--accent-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color       = 'var(--text-muted)';
                  e.currentTarget.style.background  = 'transparent';
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ width: 14, height: 14 }}
                >
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Title & description */}
        <div style={{ flexGrow: 1 }}>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            {project.title}
          </h3>
          <p
            style={{
              color: 'var(--text-body)',
              fontSize: '0.875rem',
              lineHeight: 1.75,
            }}
          >
            {project.description}
          </p>
        </div>

        {/* Tech stack tags */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.4rem',
            paddingTop: '0.875rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {project.tech.map((t) => (
            <span key={t} className="tech-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}