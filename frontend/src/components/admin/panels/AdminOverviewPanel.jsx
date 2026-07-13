import { useProjects }   from '../../../hooks/useProjects';
import { useSkills }     from '../../../hooks/useSkills';
import { useBlogPosts }  from '../../../hooks/useBlog';

export function AdminOverviewPanel() {
  const { data: projects = [] } = useProjects();
  const { data: skills   = [] } = useSkills();
  const { data: posts    = [] } = useBlogPosts();

  const stats = [
    { label: 'Projects',        value: projects.length,                     icon: '◈' },
    { label: 'Skills',          value: skills.length,                       icon: '{ }' },
    { label: 'Published Posts', value: posts.filter(p => p.published).length, icon: '📝' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.375rem' }}>Welcome back 👋</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem', fontFamily: 'var(--font-mono)' }}>
        Manage your portfolio content from here.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="glass" style={{ borderRadius: '0.875rem', padding: '1.25rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>{icon}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.375rem' }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}