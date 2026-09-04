import { useState }                                              from 'react';
import { useBlogPostAdmin, useCreatePost, useUpdatePost,
         useTogglePublish, useDeletePost }                       from '../../../hooks/useBlog';
import { emptyForm, emptySection, postToForm, formToPayload,
         formErrors, hasTag, toggleTag, removeTag }               from '../../../utils/blogForm';
import { useVocabulary, useCreateVocabulary, useDeleteVocabulary,
         useVocabularyImpact }                                    from '../../../hooks/useVocabulary';

const INPUT = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '0.5rem', padding: '0.625rem 0.875rem', color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s',
};

const LABEL = {
  display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
  fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase',
};

// Ink for text sitting ON the accent fill. Matches `.btn-primary`
// (global.css:298) rather than introducing a second literal for the same
// job — two values here would be ambiguous to resolve at the Sprint 14
// theme cutover.
const ON_ACCENT = '#0f0f0f';

const SMALL_BUTTON = {
  background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
  padding: '0.25rem 0.6rem', color: 'var(--text-body)', cursor: 'pointer',
  fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
};

const REMOVE_BUTTON = {
  background: 'none', border: 'none', color: '#f87171', cursor: 'pointer',
  fontSize: '1.25rem', lineHeight: 1, padding: '0 0.25rem',
};

const FI = {
  onFocus: (e) => { e.target.style.borderColor = 'var(--accent)'; },
  onBlur:  (e) => { e.target.style.borderColor = 'var(--border)'; },
};

/**
 * One editable line inside a section — a paragraph or a bullet.
 *
 * Paragraphs get a textarea and bullets get an input, because a bullet that
 * grows to three lines is a paragraph wearing the wrong marker.
 */
function LineRow({ kind, index, value, onChange, onRemove }) {
  const isParagraph = kind === 'body';

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)',
        marginTop: '0.7rem', minWidth: '1.25rem', textAlign: 'right' }}>
        {isParagraph ? `${index + 1}.` : '•'}
      </span>
      {isParagraph ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`Paragraph ${index + 1}…`}
          style={{ ...INPUT, resize: 'vertical', flexGrow: 1 }} {...FI} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Bullet point…"
          style={{ ...INPUT, flexGrow: 1 }} {...FI} />
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${isParagraph ? 'paragraph' : 'bullet'} ${index + 1}`}
        style={{ ...REMOVE_BUTTON, marginTop: '0.5rem' }}>
        ×
      </button>
    </div>
  );
}

/**
 * One section of the post: a heading, its paragraphs and its bullets.
 *
 * ── PF-97 ───────────────────────────────────────────────────────────────
 * This replaces the single "Content * (Markdown supported)" textarea the
 * panel carried since Phase 1. That textarea was bound to `content`, a
 * field PF-59 deprecated and that no post in this database has ever held,
 * so the editor showed nothing and refused to submit.
 *
 * The numbering here is the same 01·02·03 the reading view renders, so the
 * order of these blocks is the order a visitor reads — which is why they
 * can be moved.
 */
function SectionEditor({ section, index, total, onField, onLine, onAddLine, onRemoveLine, onMove, onRemove }) {
  const number = String(index + 1).padStart(2, '0');

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '0.625rem',
      padding: '1rem', background: 'var(--bg)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '0.75rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
          color: 'var(--accent)', letterSpacing: '0.08em' }}>
          SECTION {number}
        </span>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          {/* Sections are positional and drive the reading view's numbering,
              so reordering has to be possible without retyping the post. */}
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            aria-label={`Move section ${number} up`}
            style={{ ...SMALL_BUTTON, opacity: index === 0 ? 0.35 : 1 }}>↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
            aria-label={`Move section ${number} down`}
            style={{ ...SMALL_BUTTON, opacity: index === total - 1 ? 0.35 : 1 }}>↓</button>
          <button type="button" onClick={onRemove} aria-label={`Remove section ${number}`}
            style={REMOVE_BUTTON}>×</button>
        </div>
      </div>

      <div style={{ marginBottom: '0.875rem' }}>
        <label style={LABEL} htmlFor={`section-heading-${index}`}>Heading *</label>
        <input id={`section-heading-${index}`} value={section.heading}
          onChange={(e) => onField('heading', e.target.value)}
          placeholder="Introduction" style={INPUT} {...FI} />
      </div>

      {['body', 'bullets'].map((kind) => (
        <div key={kind} style={{ marginBottom: kind === 'body' ? '0.875rem' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ ...LABEL, marginBottom: 0 }}>{kind === 'body' ? 'Paragraphs' : 'Bullets'}</span>
            <button type="button" onClick={() => onAddLine(kind)} style={SMALL_BUTTON}>
              + Add {kind === 'body' ? 'paragraph' : 'bullet'}
            </button>
          </div>
          {section[kind].length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem', padding: '0.25rem 0 0.25rem 1.75rem' }}>
              None yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {section[kind].map((value, j) => (
                <LineRow key={j} kind={kind} index={j} value={value}
                  onChange={(next) => onLine(kind, j, next)}
                  onRemove={() => onRemoveLine(kind, j)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Confirm dialog for deleting a tag from the shared vocabulary.
 *
 * ⚠️ This is not a "remove from this post" dialog. `DELETE
 * /api/vocabulary/tag/:id` deletes the row AND `$pull`s the value out of
 * every blog post that carries it. So the dialog states the real blast
 * radius, using the count the server itself reports.
 *
 * The locked decision (`.claude/locked-decisions.md`) is explicit:
 * "Vocabulary deletion is hard-delete with cascade, behind an impact-count
 * confirm." The impact count is the whole point of the confirm — a generic
 * "are you sure?" here would be strictly worse than none, because it implies
 * the consequence has been checked when it has not.
 *
 * ⚠️ The confirm button stays DISABLED until the count arrives. Rendering
 * "removes it from 0 blog posts" while the request is still in flight would
 * be a confident lie at exactly the moment the reader is deciding — the
 * number would be indistinguishable from a genuine zero.
 */
function ChipDeleteConfirm({ chip, onCancel, onConfirm, isDeleting }) {
  const { data: impact, isLoading, isError } = useVocabularyImpact('tag', chip._id);

  const affected = impact?.affected;
  const label    = impact?.label || 'blog posts';
  const known    = typeof affected === 'number';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
      role="dialog" aria-modal="true" aria-label={`Remove ${chip.value} from the tag list`}>
      <div className="glass" style={{ borderRadius: '1rem', padding: '2rem', maxWidth: '420px', width: '100%' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Remove &ldquo;{chip.value}&rdquo; from the tag list?
        </h3>

        <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {isLoading && 'Checking how many posts use it…'}
          {isError   && 'Could not check how many posts use this tag. It is safer to cancel.'}
          {known && (
            affected === 0
              ? `This deletes the tag permanently. No ${label} currently use it.`
              : `This deletes the tag permanently and removes it from ${affected} ${affected === 1 ? label.replace(/s$/, '') : label}. This cannot be undone.`
          )}
        </p>

        {/* ⚠️ type="button" is LOAD-BEARING on both of these. This dialog
            renders inside the post <form> (it hangs off the tag picker,
            which is a form field), and a <button> with no type defaults to
            type="submit". Without it, "Yes, Remove" deleted the tag AND
            silently saved the whole post, closing the editor — the delete
            appeared to work while doing something twice as large. Caught by
            a test that expected the tags field to still exist afterwards.
            The Delete Post dialog below escapes this only because it is
            rendered outside the form. */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" onClick={onConfirm} disabled={!known || isDeleting}
            style={{ background: '#dc2626', border: 'none', borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
              cursor: (!known || isDeleting) ? 'not-allowed' : 'pointer',
              opacity: (!known || isDeleting) ? 0.6 : 1 }}>
            {isDeleting ? 'Removing…' : 'Yes, Remove'}
          </button>
          <button type="button" onClick={onCancel} className="btn-outline" style={{ fontSize: '0.875rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The shared tag vocabulary, as a picker.
 *
 * ── PF-97 ───────────────────────────────────────────────────────────────
 * The API behind this was built in Sprint 9 (PF-61 / PF-62) — model, list,
 * create, cascading delete and a delete-impact count — and had **zero**
 * frontend consumers until this component. The chips a visitor sees are
 * real rows in the `vocabulary` collection, not a list derived from the
 * posts.
 *
 * Three distinct actions, and the design is explicit that they differ
 * (`Admin.dc.html:487`): "CLICK TO PICK · ✓ = SELECTED · × REMOVES IT FROM
 * THIS LIST".
 *
 *   click the label → toggles the tag on THIS post          (local, cheap)
 *   + ADD TAG       → adds a chip to the pool               (POST)
 *   ×               → DELETES the tag from the pool AND strips it from
 *                     every post that carries it            (DELETE, cascading)
 *
 * ⚠️ The third is destructive and global, which is why it goes through a
 * confirm carrying the server's own impact count rather than a generic
 * "are you sure". `.claude/locked-decisions.md`: "Vocabulary deletion is
 * hard-delete with cascade, behind an impact-count confirm."
 */
function TagPicker({ tags, onToggle, onRemoved, onError }) {
  const { data: chips = [], isLoading } = useVocabulary('tag');
  const createTag = useCreateVocabulary('tag');
  const deleteTag = useDeleteVocabulary('tag');

  const [draft,   setDraft]   = useState('');
  const [pending, setPending] = useState(null); // the chip awaiting confirmation

  const addTag = async () => {
    const value = draft.trim();
    if (!value) return;

    // Already in the pool: pick it rather than sending a POST that would
    // 409. The design does the same — addChip() skips the insert when the
    // label exists and falls straight through to toggleChip().
    const existing = chips.find((c) => c.value.toLowerCase() === value.toLowerCase());
    if (existing) {
      if (!hasTag(tags, existing.value)) onToggle(existing.value);
      setDraft('');
      return;
    }

    try {
      const created = await createTag.mutateAsync(value);
      onToggle(created.value);   // a tag you just added is a tag you want
      setDraft('');
    } catch (err) {
      onError(err.response?.data?.message || `Could not add "${value}".`);
    }
  };

  const confirmRemove = async () => {
    const chip = pending;
    setPending(null);
    try {
      const result = await deleteTag.mutateAsync(chip._id);
      // The server stripped it from every post; strip it from the form in
      // hand too, which the refetch cannot do because this post is being
      // edited and is not what the query returns.
      onRemoved(chip.value, result);
    } catch (err) {
      onError(err.response?.data?.message || `Could not remove "${chip.value}".`);
    }
  };

  return (
    <div style={{ padding: '0.875rem', borderRadius: '0.75rem',
      background: 'var(--bg)', border: '1px dashed var(--border)' }}>

      <p style={{ margin: '0 0 0.625rem', fontFamily: 'var(--font-mono)', fontSize: '0.625rem',
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Click to pick · ✓ = selected · × removes it from this list
      </p>

      {isLoading ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[1,2,3,4].map((n) => (
            <div key={n} className="skeleton" style={{ height: 30, width: 84, borderRadius: 999 }} />
          ))}
        </div>
      ) : chips.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          No tags in the list yet — add one below.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {chips.map((chip) => {
            const on = hasTag(tags, chip.value);
            return (
              <span key={chip._id} style={{
                display: 'inline-flex', alignItems: 'stretch', borderRadius: 999, overflow: 'hidden',
                background: on ? 'var(--accent)' : 'transparent',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                <button type="button" onClick={() => onToggle(chip.value)}
                  title={on ? 'Click to unpick' : 'Click to add'}
                  aria-pressed={on}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.4rem 0.25rem 0.4rem 0.75rem', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                    color: on ? ON_ACCENT : 'var(--text-body)',
                  }}>
                  {on ? '✓ ' : '+ '}{chip.value}
                </button>
                <button type="button" onClick={() => setPending(chip)}
                  title="Remove from the list"
                  aria-label={`Remove ${chip.value} from the tag list`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', padding: '0 0.625rem 0 0.375rem',
                    background: 'none', border: 'none',
                    borderLeft: `1px solid ${on ? 'rgba(0,0,0,0.25)' : 'var(--border)'}`,
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
                    lineHeight: 1, color: on ? ON_ACCENT : 'var(--text-muted)',
                  }}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter must not submit the post — this input lives inside the
            // post <form>, where Enter is a submit by default.
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          }}
          placeholder="New tag name…"
          aria-label="New tag name"
          style={{ ...INPUT, flex: '1 1 160px', minWidth: 160, borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} {...FI} />
        <button type="button" onClick={addTag} disabled={createTag.isPending || !draft.trim()}
          style={{
            flex: 'none', padding: '0.55rem 1rem', borderRadius: 999,
            border: '1px solid rgba(129,140,248,0.4)', background: 'var(--accent-glow)',
            color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700,
            fontSize: '0.7rem', letterSpacing: '0.1em',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            opacity: draft.trim() ? 1 : 0.5,
          }}>
          {createTag.isPending ? 'ADDING…' : '+ ADD TAG'}
        </button>
      </div>

      {pending && (
        <ChipDeleteConfirm chip={pending}
          onCancel={() => setPending(null)}
          onConfirm={confirmRemove}
          isDeleting={deleteTag.isPending} />
      )}
    </div>
  );
}

export function AdminBlogPanel() {
  const { data: posts = [], isLoading } = useBlogPostAdmin();
  const createPost    = useCreatePost();
  const updatePost    = useUpdatePost();
  const togglePublish = useTogglePublish();
  const deletePost    = useDeletePost();

  const [form,    setForm]    = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [view,    setView]    = useState('list'); // 'list' | 'edit'
  const [errors,  setErrors]  = useState([]);

  const resetEditor = () => { setForm(emptyForm()); setEditing(null); setErrors([]); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  // ── Section state ───────────────────────────────────────────────────
  // Every one of these rebuilds the arrays it touches rather than mutating
  // them in place. React compares by reference, so a `sections[i].body[j] =
  // value` would change the data and render nothing.
  const updateSection = (index, mutate) =>
    setForm((p) => ({
      ...p,
      sections: p.sections.map((section, i) => (i === index ? mutate(section) : section)),
    }));

  const setSectionField = (index, field, value) =>
    updateSection(index, (section) => ({ ...section, [field]: value }));

  const setLine = (index, kind, lineIndex, value) =>
    updateSection(index, (section) => ({
      ...section,
      [kind]: section[kind].map((line, j) => (j === lineIndex ? value : line)),
    }));

  const addLine = (index, kind) =>
    updateSection(index, (section) => ({ ...section, [kind]: [...section[kind], ''] }));

  const removeLine = (index, kind, lineIndex) =>
    updateSection(index, (section) => ({
      ...section,
      [kind]: section[kind].filter((_, j) => j !== lineIndex),
    }));

  const addSection = () =>
    setForm((p) => ({ ...p, sections: [...p.sections, emptySection()] }));

  const removeSection = (index) =>
    setForm((p) => ({ ...p, sections: p.sections.filter((_, i) => i !== index) }));

  const moveSection = (index, direction) =>
    setForm((p) => {
      const target = index + direction;
      if (target < 0 || target >= p.sections.length) return p;
      const sections = [...p.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...p, sections };
    });

  // ── Save ────────────────────────────────────────────────────────────
  // The old version awaited mutateAsync with no catch, so a rejected save
  // was an unhandled promise rejection and the form simply sat there. That
  // is exactly why the inherited `content` 400 went unnoticed for two
  // sprints — the server was refusing every post and the panel said
  // nothing. Errors are now visible or they are not errors.
  const handleSubmit = async (e) => {
    e.preventDefault();

    const problems = formErrors(form);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setErrors([]);

    const data = formToPayload(form);

    try {
      if (editing) {
        await updatePost.mutateAsync({ id: editing, data });
      } else {
        await createPost.mutateAsync(data);
      }
      resetEditor();
      setView('list');
    } catch (err) {
      // Same shape AdminSkillsPanel uses, plus the distinction
      // utils/loginError.js exists to make: a request that never reached a
      // server is not a rejected post, and saying "check your fields"
      // would send you looking in the wrong place.
      setErrors([
        err.response
          ? (err.response.data?.message || `Save failed (HTTP ${err.response.status}).`)
          : 'Cannot reach the server — it may not be running. Your changes have not been saved.',
      ]);
    }
  };

  const startEdit = (post) => {
    setEditing(post._id);
    setForm(postToForm(post));
    setErrors([]);
    setView('edit');
  };

  const isSaving = createPost.isPending || updatePost.isPending;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Blog Posts</h2>
        {view === 'list' ? (
          <button onClick={() => { resetEditor(); setView('edit'); }} className="btn-primary"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            + New Post
          </button>
        ) : (
          <button onClick={() => { setView('list'); resetEditor(); }} className="btn-outline"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            ← Back to List
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          {errors.map((message) => (
            <p key={message} style={{ color: '#f87171', fontSize: '0.85rem' }}>{message}</p>
          ))}
        </div>
      )}

      {/* ── Editor view ── */}
      {view === 'edit' && (
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {editing ? 'Edit Post' : 'New Post'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={LABEL} htmlFor="post-title">Title *</label>
              <input id="post-title" name="title" required placeholder="Blog post title"
                value={form.title} onChange={handleChange} style={INPUT} {...FI} />
            </div>
            <div>
              <label style={LABEL} htmlFor="post-excerpt">Excerpt * (max 300 chars)</label>
              <textarea id="post-excerpt" name="excerpt" required rows={2}
                placeholder="Short description shown in blog list..."
                value={form.excerpt} onChange={handleChange}
                style={{ ...INPUT, resize: 'vertical' }} {...FI} />
            </div>

            {/* ── Sections ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ ...LABEL, marginBottom: 0 }}>Sections *</span>
                <button type="button" onClick={addSection} className="btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.375rem 0.875rem' }}>
                  + Add Section
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {form.sections.map((section, i) => (
                  <SectionEditor
                    key={i}
                    section={section}
                    index={i}
                    total={form.sections.length}
                    onField={(field, value) => setSectionField(i, field, value)}
                    onLine={(kind, j, value) => setLine(i, kind, j, value)}
                    onAddLine={(kind) => addLine(i, kind)}
                    onRemoveLine={(kind, j) => removeLine(i, kind, j)}
                    onMove={(direction) => moveSection(i, direction)}
                    onRemove={() => removeSection(i)}
                  />
                ))}
              </div>
            </div>

            <div>
              <label style={LABEL} htmlFor="post-tags">Tags (comma separated)</label>
              <input id="post-tags" name="tags" placeholder="React, Node.js, Docker"
                value={form.tags} onChange={handleChange} style={INPUT} {...FI} />
            </div>

            {/* ── PF-97: the shared tag vocabulary ──────────────────────
                The text field above stays — it is how you type a one-off
                tag. This picks from the pool that already exists, which
                is what stops the same tag being spelled three ways across
                four posts. */}
            <TagPicker
              tags={form.tags}
              onToggle={(value) => setForm((p) => ({ ...p, tags: toggleTag(p.tags, value) }))}
              onRemoved={(value) => {
                // The server stripped this tag from every STORED post. The
                // post open in the editor is unsaved form state that no
                // refetch can reach, so it has to be stripped here too —
                // otherwise the deleted tag sits in the field and gets
                // re-created on the next save.
                setForm((p) => ({ ...p, tags: removeTag(p.tags, value) }));
              }}
              onError={(message) => setErrors([message])}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" name="published" id="pub" checked={form.published} onChange={handleChange}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <label htmlFor="pub" style={{ color: 'var(--text-body)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Publish immediately (uncheck to save as draft)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" disabled={isSaving} className="btn-primary"
                style={{ opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Post')}
              </button>
              <button type="button" onClick={() => { setView('list'); resetEditor(); }} className="btn-outline">
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
                      {/* PF-97: was `createdAt` alone. The site displays
                          `publishedAt || createdAt` (PF-95), and migration 005
                          set publish dates months before the seed's insert
                          stamp — so the panel and the site printed different
                          dates for the same post. */}
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString()} · {post.readingTimeMinutes} min read · {post.views} views
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => togglePublish.mutate(post._id, {
                      onError: (err) => setErrors([err.response?.data?.message || 'Could not change the publish state.']),
                    })} style={{
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
              <button onClick={async () => {
                try {
                  await deletePost.mutateAsync(confirm);
                } catch (err) {
                  setErrors([err.response?.data?.message || 'Could not delete the post.']);
                }
                setConfirm(null);
              }}
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
