import { useState }                                              from 'react';
import { useBlogPostAdmin, useCreatePost, useUpdatePost,
         useTogglePublish, useDeletePost }                       from '../../../hooks/useBlog';

const EMPTY_POST = { title: '', excerpt: '', content: '', tags: '', published: false };

const INPUT = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '0.5rem', padding: '0.625rem 0.875rem', color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s',
};

export function AdminBlogPanel() {
  const { data: posts = [], isLoading } = useBlogPostAdmin();
  const createPost    = useCreatePost();
  const updatePost    = useUpdatePost();
  const togglePublish = useTogglePublish();
  const deletePost    = useDeletePost();

  const [form,    setForm]    = useState(EMPTY_POST);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [view,    setView]    = useState('list'); // 'list' | 'edit'

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) };
    if (editing) {
      await updatePost.mutateAsync({ id: editing, data });
    } else {
      await createPost.mutateAsync(data);
    }
    setForm(EMPTY_POST);
    setEditing(null);
    setView('list');
  };

  const startEdit = (post) => {
    setEditing(post._id);
    setForm({ ...post, tags: post.tags?.join(', ') || '' });
    setView('edit');
  };

  const FI = {
    onFocus: (e) => { e.target.style.borderColor = 'var(--accent)'; },
    onBlur:  (e) => { e.target.style.borderColor = 'var(--border)'; },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Blog Posts</h2>
        {view === 'list' ? (
          <button onClick={() => { setForm(EMPTY_POST); setEditing(null); setView('edit'); }} className="btn-primary"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            + New Post
          </button>
        ) : (
          <button onClick={() => { setView('list'); setForm(EMPTY_POST); setEditing(null); }} className="btn-outline"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            ← Back to List
          </button>
        )}
      </div>

      {/* ── Editor view ── */}
      {view === 'edit' && (
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {editing ? 'Edit Post' : 'New Post'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Title *</label>
              <input name="title" required placeholder="Blog post title" value={form.title} onChange={handleChange} style={INPUT} {...FI} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Excerpt * (max 300 chars)</label>
              <textarea name="excerpt" required rows={2} placeholder="Short description shown in blog list..." value={form.excerpt} onChange={handleChange} style={{ ...INPUT, resize: 'vertical' }} {...FI} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
                Content * (Markdown supported)
              </label>
              <textarea name="content" required rows={16} placeholder="Write your full post content here in Markdown...&#10;&#10;## Introduction&#10;&#10;Your content here...&#10;&#10;## Section Two&#10;&#10;More content..."
                value={form.content} onChange={handleChange} style={{ ...INPUT, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.825rem', lineHeight: 1.7 }} {...FI} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>Tags (comma separated)</label>
              <input name="tags" placeholder="React, Node.js, Docker" value={form.tags} onChange={handleChange} style={INPUT} {...FI} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" name="published" id="pub" checked={form.published} onChange={handleChange}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <label htmlFor="pub" style={{ color: 'var(--text-body)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Publish immediately (uncheck to save as draft)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" disabled={createPost.isPending || updatePost.isPending} className="btn-primary"
                style={{ opacity: (createPost.isPending || updatePost.isPending) ? 0.7 : 1 }}>
                {(createPost.isPending || updatePost.isPending) ? 'Saving...' : (editing ? 'Save Changes' : 'Create Post')}
              </button>
              <button type="button" onClick={() => { setView('list'); setForm(EMPTY_POST); setEditing(null); }} className="btn-outline">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1,2,3].map(n => <div key={n} className="skeleton" style={{ height: '72px', borderRadius: '0.5rem' }} />)}
            </div>
          ) : posts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
              No blog posts yet. Click "+ New Post" to write your first one.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {posts.map((post) => (
                <div key={post._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                  padding: '1rem', background: 'var(--bg)', borderRadius: '0.625rem', border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ minWidth: 0, flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{post.title}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.15rem 0.5rem',
                        borderRadius: '9999px', border: '1px solid',
                        borderColor: post.published ? 'rgba(52,211,153,0.3)' : 'rgba(100,116,139,0.3)',
                        color:       post.published ? 'var(--green)' : 'var(--text-muted)',
                        background:  post.published ? 'rgba(52,211,153,0.06)' : 'transparent',
                      }}>
                        {post.published ? '● Published' : '○ Draft'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                      {new Date(post.createdAt).toLocaleDateString()} · {post.readingTimeMinutes} min read · {post.views} views
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => togglePublish.mutate(post._id)} style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                      padding: '0.375rem 0.75rem', color: 'var(--text-body)', cursor: 'pointer', fontSize: '0.8rem',
                    }}>
                      {post.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button onClick={() => startEdit(post)} style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                      padding: '0.375rem 0.75rem', color: 'var(--text-body)', cursor: 'pointer', fontSize: '0.8rem',
                    }}>
                      Edit
                    </button>
                    <button onClick={() => setConfirm(post._id)} style={{
                      background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem',
                      padding: '0.375rem 0.75rem', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem',
                    }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="glass" style={{ borderRadius: '1rem', padding: '2rem', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Delete Post?</h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              This will permanently delete the blog post and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={async () => { await deletePost.mutateAsync(confirm); setConfirm(null); }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
                  color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Yes, Delete
              </button>
              <button onClick={() => setConfirm(null)} className="btn-outline" style={{ fontSize: '0.875rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}