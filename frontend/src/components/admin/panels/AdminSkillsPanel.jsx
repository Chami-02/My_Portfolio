import { useState }                                from 'react';
import { useSkills, useCreateSkill, useDeleteSkill } from '../../../hooks/useSkills';

const CATEGORIES = ['language', 'frontend', 'backend', 'database', 'devops', 'other'];
const LEVELS     = ['beginner', 'intermediate', 'advanced'];

const EMPTY = { name: '', category: 'frontend', level: 'beginner' };

const INPUT = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.5rem',
  padding: '0.625rem 0.875rem', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
  fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s',
};

const SELECT = { ...INPUT, cursor: 'pointer' };

export function AdminSkillsPanel() {
  const { data: skills = [], isLoading } = useSkills();
  const createSkill = useCreateSkill();
  const deleteSkill = useDeleteSkill();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createSkill.mutateAsync(form);
      setForm(EMPTY);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add skill');
    }
  };

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: skills.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Skills</h2>

      {/* Add skill form */}
      <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>Add New Skill</h3>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 160px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Skill Name
            </label>
            <input name="name" required placeholder="e.g. TypeScript" value={form.name} onChange={handleChange}
              style={{ ...INPUT, width: '100%' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Category
            </label>
            <select name="category" value={form.category} onChange={handleChange} style={{ ...SELECT, width: '100%' }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Level
            </label>
            <select name="level" value={form.level} onChange={handleChange} style={{ ...SELECT, width: '100%' }}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button type="submit" disabled={createSkill.isPending} className="btn-primary"
            style={{ flexShrink: 0, opacity: createSkill.isPending ? 0.7 : 1 }}>
            {createSkill.isPending ? 'Adding...' : '+ Add Skill'}
          </button>
        </form>
      </div>

      {/* Skills by category */}
      <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          All Skills ({skills.length})
        </h3>

        {isLoading ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[1,2,3,4,5].map(n => <div key={n} className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '9999px' }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {grouped.map(({ category, items }) => (
              <div key={category}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.625rem' }}>
                  {category}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {items.map((skill) => (
                    <div key={skill._id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: '9999px', padding: '0.3rem 0.75rem',
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {skill.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        · {skill.level}
                      </span>
                      <button
                        onClick={() => deleteSkill.mutate(skill._id)}
                        aria-label={`Delete ${skill.name}`}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                          fontSize: '1rem', lineHeight: 1, padding: '0 0 0 0.25rem', transition: 'color 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}