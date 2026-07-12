import { useInView } from '../../hooks/useInView';
import { useAbout }  from '../../hooks/useAbout';

export function AboutSection() {
  const [ref, inView]                  = useInView();
  const { data: about, isLoading }     = useAbout();

  const stats = about?.stats || [];
  const bio   = about?.bio   || [];

  return (
    <section id="about" style={{ padding: 'var(--section-y) var(--content-px)' }}>
      <div ref={ref} className={`reveal ${inView ? 'revealed' : ''}`}
        style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
        <span className="section-label">01 / About</span>
        <h2 className="section-title">Who I Am</h2>
        <div className="section-divider" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4rem', alignItems: 'center' }} className="about-grid">

          {/* Bio */}
          <div style={{ maxWidth: '520px' }}>
            {isLoading ? (
              <>
                <div className="skeleton" style={{ height: '1rem', marginBottom: '1rem', borderRadius: '0.375rem' }} />
                <div className="skeleton" style={{ height: '1rem', width: '80%', marginBottom: '1.25rem', borderRadius: '0.375rem' }} />
                <div className="skeleton" style={{ height: '1rem', marginBottom: '1rem', borderRadius: '0.375rem' }} />
              </>
            ) : (
              bio.map((paragraph, i) => (
                <p key={i} style={{ color: 'var(--text-body)', lineHeight: 1.85, marginBottom: '1.25rem', fontSize: '1rem' }}>
                  {paragraph}
                </p>
              ))
            )}

            {about?.availableForWork && (
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                {about.availabilityNote}
              </p>
            )}

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <a href="#projects" className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.625rem 1.375rem' }}>
                See My Work
              </a>
              {about?.cvUrl && (
                <a href={about.cvUrl} target="_blank" rel="noreferrer" className="btn-outline"
                  style={{ fontSize: '0.875rem', padding: '0.625rem 1.375rem' }}>
                  Download CV
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {isLoading
              ? [1,2,3,4].map((n) => <div key={n} className="skeleton" style={{ height: '100px', borderRadius: '0.875rem' }} />)
              : stats.map(({ value, label }) => (
                  <div key={label} className="glass" style={{ padding: '1.75rem 1.25rem', borderRadius: '0.875rem', textAlign: 'center',
                    transition: 'transform 0.2s, border-color 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '2.5rem', color: 'var(--accent)', lineHeight: 1, marginBottom: '0.5rem' }}>{value}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>{label}</p>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
      <style>{`@media (min-width: 768px) { .about-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
    </section>
  );
}