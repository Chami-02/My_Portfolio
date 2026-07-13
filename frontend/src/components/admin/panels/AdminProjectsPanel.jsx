import { useState }                                      from 'react';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../../../hooks/useProjects';

const EMPTY = { title: '', description: '', tech: '', githubUrl: '', liveUrl: '', featured: false, order: 0 };

function SectionCard({ children, title }) {
  return (
    <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '1.25rem' }}>
      {title && <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>{title}</h3>}
      {children}
    </div>
  );
}

const INPUT = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.5rem',
  padding: '0.625rem 0.875rem', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
  fontSize: '0.875rem', outline: 'none', width: '100%', transition: 'border-color 0.2s',
};

export function AdminProjectsPanel() {
  const { data: projects = [], isLoading } = useProjects();
  const createProject  = useCreateProject();
  const updateProject  = useUpdateProject();
  const deleteProject  = useDeleteProject();

  const [form,    setForm]    = useState(EMPTY);
  const [editing, setEditing] = useState(null);  // null = create mode, _id = edit mode
  const [confirm, setConfirm] = useState(null);  // _id to confirm deletion

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, tech: form.tech.split(',').map((t) => t.trim()).filter(Boolean) };

    if (editing) {
      await updateProject.mutateAsync({ id: editing, data });
    } else {
      await createProject.mutateAsync(data);
    }
    setForm(EMPTY);
    setEditing(null);
  };

  const startEdit = (project) => {
    setEditing(project._id);
    setForm({ ...project, tech: project.tech.join(', '), liveUrl: project.liveUrl || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setForm(EMPTY); setEditing(null); };

  const confirmDelete = (id) => setConfirm(id);
  const handleDelete  = async () => {
    if (!confirm) return;
    await deleteProject.mutateAsync(confirm);
    setConfirm(null);
  };

  const isSubmitting = createProject.isPending || updateProject.isPending;

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        {editing ? '✏️ Edit Project' : '+ New Project'}
      </h2>

      {/* ── Form ── */}
      <SectionCard title={editing ? 'Edit Project' : 'Add New Project'}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem', marginBottom: '0.875rem' }}>
            {[
              { name: 'title',       placeholder: 'Project title',             required: true  },
              { name: 'githubUrl',   placeholder: 'https://github.com/...',    required: true  },
              { name: 'liveUrl',     placeholder: 'https://live-demo.com (optional)', required: false },
              { name: 'order',       placeholder: 'Display order (0, 1, 2...)', required: false },
            ].map(({ name, placeholder, required }) => (
              <div key={name}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {name.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <input name={name} required={required} placeholder={placeholder}
                  value={form[name]} onChange={handleChange} style={INPUT}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '0.875rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Description
            </label>
            <textarea name="description" required rows={3} placeholder="What does this project do? Be honest and specific."
              value={form.description} onChange={handleChange}
              style={{ ...INPUT, resize: 'vertical' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
            />
          </div>

          <div style={{ marginBottom: '0.875rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Tech Stack (comma separated)
            </label>
            <input name="tech" placeholder="React, Node.js, MongoDB, Docker"
              value={form.tech} onChange={handleChange} style={INPUT}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <input type="checkbox" name="featured" id="featured" checked={form.featured} onChange={handleChange}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            <label htmlFor="featured" style={{ color: 'var(--text-body)', fontSize: '0.875rem', cursor: 'pointer' }}>
              Mark as featured project
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={isSubmitting} className="btn-primary"
              style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
              {isSubmitting ? 'Saving...' : (editing ? 'Save Changes' : 'Add Project')}
            </button>
            {editing && (
              <button type="button" onClick={cancelEdit} className="btn-outline">
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      {/* ── Projects list ── */}
      <SectionCard title={`All Projects (${projects.length})`}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1,2,3].map(n => <div key={n} className="skeleton" style={{ height: '60px', borderRadius: '0.5rem' }} />)}
          </div>
        ) : projects.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
            No projects yet. Add one above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {projects.map((p) => (
              <div key={p._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                padding: '0.875rem 1rem', background: 'var(--bg)', borderRadius: '0.625rem',
                border: `1px solid ${editing === p._id ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                    {p.featured && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)',
                        border: '1px solid rgba(129,140,248,0.3)', padding: '0.1rem 0.4rem', borderRadius: '9999px',
                        background: 'var(--accent-glow)', whiteSpace: 'nowrap' }}>
                        ★ Featured
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '0.2rem',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.tech?.join(', ')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => startEdit(p)} style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                    padding: '0.375rem 0.75rem', color: 'var(--text-body)', cursor: 'pointer',
                    fontSize: '0.8rem', transition: 'all 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-body)'; }}>
                    Edit
                  </button>
                  <button onClick={() => confirmDelete(p._id)} style={{
                    background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem',
                    padding: '0.375rem 0.75rem', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Delete confirmation modal ── */}
      {confirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
        }}>
          <div className="glass" style={{ borderRadius: '1rem', padding: '2rem', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Delete Project?</h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              This will permanently remove the project from your portfolio and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleDelete} disabled={deleteProject.isPending}
                style={{ background: '#dc2626', border: 'none', borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
                  color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
                  opacity: deleteProject.isPending ? 0.7 : 1 }}>
                {deleteProject.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setConfirm(null)} className="btn-outline" style={{ fontSize: '0.875rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}