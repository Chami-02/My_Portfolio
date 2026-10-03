import { useState }                                              from 'react';
import { ViewCount } from '../../blog/ViewCount';
import { useBlogPostAdmin, useCreatePost, useUpdatePost,
         useTogglePublish, useDeletePost }                       from '../../../hooks/useBlog';
import { emptyForm, emptySection, postToForm, formToPayload,
         formErrors, toggleTag, removeTag }                       from '../../../utils/blogForm';
import { useFormGuard }            from '../../../hooks/useFormGuard';
import { fieldProps, errorId, fieldId } from '../../../utils/formErrors';
import { VocabularyPicker }        from '../VocabularyPicker';
import { ConfirmDialog }           from '../ConfirmDialog';
import a from '../../../styles/admin.module.css';



const SMALL_BUTTON = {
  background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
  padding: '0.25rem 0.6rem', color: 'var(--text-body)', cursor: 'pointer',
  fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
};

const REMOVE_BUTTON = {
  background: 'none', border: 'none', color: '#f87171', cursor: 'pointer',
  fontSize: '1.25rem', lineHeight: 1, padding: '0 0.25rem',
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
          className={a.textarea} style={{ flexGrow: 1 }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Bullet point…"
          className={a.input} style={{ flexGrow: 1 }} />
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${isParagraph ? 'paragraph' : 'bullet'} ${index + 1}`}
        style={{ ...REMOVE_BUTTON, marginTop: '0.5rem' }}>
        ×
      </button>
    </div>
  );
}

/**
 * The id namespace for this panel's validatable inputs.
 *
 * ⚠️ `post`, matching the ids the editor already used (`post-title`,
 * `post-excerpt`), so wiring validation renamed nothing and broke no
 * `htmlFor`. The SECTION headings did have to change — they were
 * `section-heading-0` and are now `post-sections-0-heading`, which is what
 * `fieldId(FID, 'sections.0.heading')` produces. Deriving the id from the same
 * path the error carries is the whole point: the alternative is an id typed in
 * the JSX and a field typed in the validator, and when those drift the error
 * renders nowhere at all.
 */
const FID = 'post';

/** The inline message under a field. Mirrors AdminAboutPanel's. */
function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return (
    <p className={a.fieldError} id={errorId(FID, field)} role="alert">
      {message}
    </p>
  );
}

/*
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
function SectionEditor({ section, index, total, guard, onField, onLine, onAddLine, onRemoveLine, onMove, onRemove }) {
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
        {/* ⚠️ The id is DERIVED from the same path string the error carries —
            `post-sections-0-heading`, not the hand-written
            `section-heading-0` it replaced. Two independently typed strings
            for one identity is how an error ends up rendering nowhere. */}
        <label className={a.label} htmlFor={fieldId(FID, `sections.${index}.heading`)}>
          Heading *
        </label>
        <input {...fieldProps(guard.errors, FID, `sections.${index}.heading`)}
          value={section.heading}
          onChange={(e) => onField('heading', e.target.value)}
          placeholder="Introduction" className={a.input} />
        <FieldError field={`sections.${index}.heading`} guard={guard} />
      </div>

      {['body', 'bullets'].map((kind) => (
        <div key={kind} style={{ marginBottom: kind === 'body' ? '0.875rem' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className={a.labelLead}>{kind === 'body' ? 'Paragraphs' : 'Bullets'}</span>
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

// The tag picker and its cascade-delete confirm moved to
// components/admin/VocabularyPicker.jsx in PF-113, when the Projects panel's
// `tech` picker became their second consumer.

/**
 * `initialView` — PF-110. The Overview's `+ NEW POST` quick action lands
 * here with the editor already open, the way the prototype's
 * `setState({ tab: 'blog', blogView: 'edit' })` does (Admin.dc.html:1095).
 * Read once, at mount: the panel unmounts on every tab change, so the
 * next arrival gets a fresh initial value.
 */
export function AdminBlogPanel({ initialView = 'list' }) {
  const { data: posts = [], isLoading } = useBlogPostAdmin();
  const createPost    = useCreatePost();
  const updatePost    = useUpdatePost();
  const togglePublish = useTogglePublish();
  const deletePost    = useDeletePost();

  const [form,    setForm]    = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [view,    setView]    = useState(initialView); // 'list' | 'edit'
  // ⚠️ REPLACES a bare `useState([])` of sentence strings. The guard carries
  // the same errors as `{ field, message }`, so each one prints under its own
  // input, refuses the save, and shakes the button — the standing admin rule
  // (owner, 2026-09-25). See hooks/useFormGuard.js.
  const guard = useFormGuard(formErrors, FID);

  // ⚠️ SERVER failures are a DIFFERENT CHANNEL from validation, and keeping
  // them apart is the point. A rejected request, a dead backend and a failed
  // delete have no field to mark — pushing them through the guard would put
  // "Cannot reach the server" under the title input and count it as a field
  // needing attention. `utils/loginError.js` exists because this repo once
  // collapsed exactly these two categories into one sentence.
  const [serverErrors, setServerErrors] = useState([]);

  const resetEditor = () => { setForm(emptyForm()); setEditing(null); guard.reset(); setServerErrors([]); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    // ⚠️ CLEARS the mark, never re-validates. Re-running the validator on every
    // keystroke marks the excerpt "too long" while it is still being written.
    // The full check runs again on the next save, which is when it matters.
    guard.clearField(name);
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

  const setSectionField = (index, field, value) => {
    updateSection(index, (section) => ({ ...section, [field]: value }));
    guard.clearField(`sections.${index}.${field}`);
  };

  const setLine = (index, kind, lineIndex, value) => {
    updateSection(index, (section) => ({
      ...section,
      [kind]: section[kind].map((line, j) => (j === lineIndex ? value : line)),
    }));
    // ⚠️ "Section NN needs at least one paragraph or bullet" is reported
    // against the HEADING — a section's paragraphs are a variable-length list
    // with no single input to mark, and marking every one of them would be
    // noise. So typing a paragraph has to clear the heading's mark, or the
    // error the author just answered stays on screen.
    guard.clearField(`sections.${index}.heading`);
  };

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

    // ⚠️ Refuses BEFORE anything is sent. A save that fires and then reports a
    // 400 has already told the author the wrong thing about which system
    // refused them.
    if (!guard.check(form)) return;
    setServerErrors([]);

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
      setServerErrors([
        err.response
          ? (err.response.data?.message || `Save failed (HTTP ${err.response.status}).`)
          : 'Cannot reach the server — it may not be running. Your changes have not been saved.',
      ]);
    }
  };

  const startEdit = (post) => {
    setEditing(post._id);
    setForm(postToForm(post));
    guard.reset();
    setServerErrors([]);
    setView('edit');
  };

  const isSaving = createPost.isPending || updatePost.isPending;

  // The figure the server currently derives for the post being edited, shown
  // beside the override field so "leave blank to calculate" is checkable
  // rather than a promise. Derived during render from the list already in
  // hand — NOT copied into state on edit, which would go stale the moment a
  // save recomputed it.
  const editingPost = editing ? posts.find((p) => p._id === editing) : null;

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

      {/* ⚠️ THIS REPLACES A PHASE 1 LITERAL BANNER — `#f87171` and
          `rgba(239,68,68,…)` in a JSX `style={{}}` object, which do not flip
          with the theme AND are invisible to `adminFoundation.test.js`, because
          that guard parses stylesheets and cannot see inline styles. That is
          the exact shape of the thing that blocked PF-116 until PF-112 found
          it in AdminAboutPanel.

          It also stops listing every message. The detail now lives under each
          field, where it can be acted on; the banner names the scale, so there
          are not two places to read, one of which cannot say which input it
          means. */}
      {guard.errors.length > 0 && (
        <div className={a.bannerError} role="alert" style={{ marginBottom: '1rem' }}>
          <span className={a.bannerDot} aria-hidden="true" />
          <span>
            CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
            {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
          </span>
        </div>
      )}

      {serverErrors.length > 0 && (
        <div className={a.bannerError} role="alert" style={{ marginBottom: '1rem' }}>
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{serverErrors.join(' ')}</span>
        </div>
      )}

      {/* ── Editor view ── */}
      {view === 'edit' && (
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {editing ? 'Edit Post' : 'New Post'}
          </h3>
          {/* ⚠️ `noValidate` — AND IT FIXES A LIVE DEFECT, not just a
              preference. `#post-title` and `#post-excerpt` carry `required`,
              and without this the browser's own bubble fires first and
              `handleSubmit` never runs at all. `formErrors`' "Title is
              required." and "Excerpt is required." branches have therefore
              NEVER executed since they were written — dead code that reads as
              live, and passing unit tests the whole time because a unit test
              calls the validator directly. The inputs keep `required` for its
              semantics; only the bubble is suppressed. */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className={a.label} htmlFor="post-title">Title *</label>
              <input {...fieldProps(guard.errors, FID, 'title')}
                name="title" required placeholder="Blog post title"
                value={form.title} onChange={handleChange} className={a.input} />
              <FieldError field="title" guard={guard} />
            </div>
            <div>
              <label className={a.label} htmlFor="post-excerpt">Excerpt * (max 300 chars)</label>
              <textarea {...fieldProps(guard.errors, FID, 'excerpt')}
                name="excerpt" required rows={2}
                placeholder="Short description shown in blog list..."
                value={form.excerpt} onChange={handleChange}
                className={a.textarea} />
              <FieldError field="excerpt" guard={guard} />
            </div>

            {/* ── Sections ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className={a.labelLead}>Sections *</span>
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
                    guard={guard}
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
              <label className={a.label} htmlFor="post-tags">Tags (comma separated)</label>
              <input id="post-tags" name="tags" placeholder="React, Node.js, Docker"
                value={form.tags} onChange={handleChange} className={a.input} />
            </div>

            {/* ── PF-97: the shared tag vocabulary ──────────────────────
                The text field above stays — it is how you type a one-off
                tag. This picks from the pool that already exists, which
                is what stops the same tag being spelled three ways across
                four posts. */}
            <VocabularyPicker
              type="tag"
              selected={form.tags}
              onToggle={(value) => setForm((p) => ({ ...p, tags: toggleTag(p.tags, value) }))}
              onRemoved={(value) => {
                // The server stripped this tag from every STORED post. The
                // post open in the editor is unsaved form state that no
                // refetch can reach, so it has to be stripped here too —
                // otherwise the deleted tag sits in the field and gets
                // re-created on the next save.
                setForm((p) => ({ ...p, tags: removeTag(p.tags, value) }));
              }}
              onError={(message) => setServerErrors([message])}
            />
            {/* ── PF-103: the author's reading-time pin ────────────────
                Optional by design. `readingTimeMinutes` is derived by the
                model from a 200-wpm word count and is never sent from here;
                this field is the separate AUTHORED override, and blank —
                the normal state — means "compute it".

                Why the field exists at all: the seeded posts shipped with
                hardcoded 6/7/4/5 figures transcribed from the design, which
                the real 64-158 word bodies never justified. PF-103 made the
                numbers honest, and this is the escape hatch for a post that
                genuinely warrants a different one. */}
            <div>
              <label className={a.label} htmlFor="post-read-time">
                Reading time override (minutes)
              </label>
              <input id="post-read-time" name="readingTimeOverride" type="number"
                min="1" max="999" inputMode="numeric"
                placeholder="Leave blank to calculate from the content"
                value={form.readingTimeOverride} onChange={handleChange}
                className={a.input} />
              <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Leave blank to calculate from the content.
                {editingPost && ` Currently showing ${editingPost.readingTimeMinutes} min read.`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" name="published" id="pub" checked={form.published} onChange={handleChange}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <label htmlFor="pub" style={{ color: 'var(--text-body)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Publish immediately (uncheck to save as draft)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              {/* ⚠️ `key` is what makes a SECOND refusal shake again — re-adding
                  a class React already rendered restarts no animation, so
                  without it the button refuses visibly once and sits still
                  every time after. See AdminAboutPanel for the same note. */}
              <button
                key={guard.shakeKey}
                type="submit"
                disabled={isSaving}
                className={`btn-primary ${guard.shaking ? a.shake : ''}`}
                onAnimationEnd={guard.onShakeEnd}
                style={{ opacity: isSaving ? 0.7 : 1 }}
              >
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

                      {/* ── PF-99 ────────────────────────────────────
                          Promoted out of the grey meta line below,
                          where it read `· 0 views` in 0.75rem muted
                          mono and was effectively unreadable down a
                          list. Owner-requested 2026-09-06.

                          ⚠️ The old fragment was DELETED, not left in
                          place — printing the same count twice per row
                          is what "add a views display" turns into if
                          the existing one is not looked for first. Its
                          absence is pinned by a test.

                          Renders nothing at zero, exactly as on the
                          public cards, so an unread draft carries no
                          chip rather than a `0` competing with the
                          Published/Draft badge beside it. */}
                      <ViewCount
                        views={post.views}
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      />
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                      {/* PF-97: was `createdAt` alone. The site displays
                          `publishedAt || createdAt` (PF-95), and migration 005
                          set publish dates months before the seed's insert
                          stamp — so the panel and the site printed different
                          dates for the same post. */}
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString()} · {post.readingTimeMinutes} min read
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => togglePublish.mutate(post._id, {
                      onError: (err) => setServerErrors([err.response?.data?.message || 'Could not change the publish state.']),
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

      {/* Delete confirmation — PF-113's shared dialog, with the prototype's
          own copy (Admin.dc.html:1216). Rendered outside the form. */}
      {confirm && (
        <ConfirmDialog
          title="Delete post?"
          busy={deletePost.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await deletePost.mutateAsync(confirm);
            } catch (err) {
              setServerErrors([err.response?.data?.message || 'Could not delete the post.']);
            }
            setConfirm(null);
          }}
        >
          This will permanently delete &ldquo;{posts.find((p) => p._id === confirm)?.title ?? 'this post'}&rdquo; and
          cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
