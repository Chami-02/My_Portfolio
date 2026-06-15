import { useInView } from '../../hooks/useInView';
import { SKILLS }    from '../../data/skills';

const CATEGORIES = [
  { key: 'language', label: 'Languages',  symbol: '{ }' },
  { key: 'frontend', label: 'Frontend',   symbol: '◈'   },
  { key: 'backend',  label: 'Backend',    symbol: '⬡'   },
  { key: 'database', label: 'Database',   symbol: '◉'   },
  { key: 'devops',   label: 'DevOps',     symbol: '⟳'   },
];

export function SkillsSection() {
  const [ref, inView] = useInView();

  // Group skills by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: SKILLS.filter((s) => s.category === cat.key),
  })).filter((cat) => cat.items.length > 0);

  return (
    <section
      id="skills"
      style={{
        padding: 'var(--section-y) var(--content-px)',
        background:
          'linear-gradient(180deg, var(--bg) 0%, var(--bg-surface) 50%, var(--bg) 100%)',
      }}
    >
      <div
        ref={ref}
        className={`reveal ${inView ? 'revealed' : ''}`}
        style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}
      >
        <span className="section-label">02 / Skills</span>
        <h2 className="section-title">What I Work With</h2>
        <div className="section-divider" />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '1rem',
          }}
        >
          {grouped.map(({ key, label, symbol, items }) => (
            <div
              key={key}
              className="glass"
              style={{
                borderRadius: '0.875rem',
                padding: '1.375rem',
                transition: 'border-color 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-bright)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {/* Category header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1rem',
                    color: 'var(--accent)',
                    minWidth: '1.5rem',
                  }}
                >
                  {symbol}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Skill pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {items.map((skill) => (
                  <span key={skill.id} className="tech-tag">
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}