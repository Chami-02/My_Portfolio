import { useState }                                              from 'react';
import { ViewCount } from '../../blog/ViewCount';
import { useBlogPostAdmin, useCreatePost, useUpdatePost,
         useTogglePublish, useDeletePost }                       from '../../../hooks/useBlog';
import { emptySection, postToForm, formToPayload, formErrors,
         isPostDirty, toggleTag, removeTag }                     from '../../../utils/blogForm';
import { useFormGuard }            from '../../../hooks/useFormGuard';
import { useAdminFlash }           from '../../../hooks/useAdminFlash';
import { fieldProps, errorId, fieldId } from '../../../utils/formErrors';
import { VocabularyPicker }        from '../VocabularyPicker';
import { ConfirmDialog }           from '../ConfirmDialog';
import a      from '../../../styles/admin.module.css';
import styles from './AdminBlogPanel.module.css';

/*
 * ── PF-115 — the Blog panel, Phase 2 ────────────────────────────────────────
 *
 * Restyled to Admin.dc.html:454-536 and given the two halves of the standing
 * admin rules it was missing (owner, 2026-10-03 / 2026-09-25):
 *
 *   • DRAFTS — a new post can be SAVED AS A DRAFT with only a title; a draft
 *     is invisible on /blog and publishing it later demands everything.
 *   • STAGING — SAVE is dim until something changed, REVERT CHANGES restores
 *     the last SAVED state (never a blank form), UNSAVED CHANGES marks it.
 *
 * The structure is the Projects panel's (PF-113), deliberately — a third
 * shape for the same rules would be a third thing to keep in step.
 *
 * ⚠️ The prototype's "Publish immediately (uncheck to save as draft)" CHECKBOX
 * IS GONE (owner, 2026-10-07). With SAVE AS DRAFT beside the publish button the
 * two could disagree; the button decides, as it does in Projects.
 *
 * ⚠️ The prototype's single "Content * (Markdown supported)" textarea is NOT
 * restored. It predates PF-59's `sections[]` schema; restoring it re-breaks the
 * panel completely (PF-97). A test pins its absence.
 */

/**
 * The id namespace for this panel's validatable inputs — `post-title`,
 * `post-sections-0-heading`. ⚠️ Every id is DERIVED from the same path string
 * the error carries (`fieldId(FID, 'sections.0.heading')`). Two independently
 * typed strings for one identity is how an error ends up rendering nowhere.
 */
const FID = 'post';

/** The inline message under a field. */
function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return (
    <p className={a.fieldError} id={errorId(FID, field)} role="alert">
      {message}
    </p>
  );
}

/**
 * One editable line inside a section — a paragraph or a bullet.
 *
 * Paragraphs get a textarea and bullets get an input, because a bullet that
 * grows to three lines is a paragraph wearing the wrong marker.
 *
 * ⚠️ PF-115 gives each its OWN accessible name. Until now they had only a
 * placeholder, so `getAllByLabelText(/paragraph 1/)` matched the REMOVE
 * buttons — a screen reader announced an unnamed text box.
 */
function LineRow({ kind, index, sectionNumber, value, onChange, onRemove }) {
  const isParagraph = kind === 'body';
  const noun = isParagraph ? 'paragraph' : 'bullet';
  const name = `Section ${sectionNumber}, ${noun} ${index + 1}`;

  return (
    <div className={styles.line}>
      <span className={styles.lineMark} aria-hidden="true">
        {isParagraph ? `${index + 1}.` : '•'}
      </span>
      {isParagraph ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`Paragraph ${index + 1}…`} aria-label={name}
          className={`${a.textarea} ${styles.lineInput}`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Bullet point…" aria-label={name}
          className={`${a.input} ${styles.lineInput}`} />
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${noun} ${index + 1}`}
        className={styles.remove}>
        ×
      </button>
    </div>
  );
}

/*
 * One section of the post: a heading, its paragraphs and its bullets.
 *
 * The numbering is the same 01·02·03 the reading view renders, so the order of
 * these blocks is the order a visitor reads — which is why they can be moved.
 */
function SectionEditor({ section, index, total, guard, onField, onLine, onAddLine, onRemoveLine, onMove, onRemove }) {
  const number = String(index + 1).padStart(2, '0');
  const path = `sections.${index}.heading`;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTop}>
        <span className={styles.sectionNumber}>SECTION {number}</span>
        <div className={styles.sectionTools}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            aria-label={`Move section ${number} up`} className={styles.move}>↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
            aria-label={`Move section ${number} down`} className={styles.move}>↓</button>
          <button type="button" onClick={onRemove} aria-label={`Remove section ${number}`}
            className={styles.remove}>×</button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={a.label} htmlFor={fieldId(FID, path)}>Heading *</label>
        <input {...fieldProps(guard.errors, FID, path)}
          value={section.heading}
          onChange={(e) => onField('heading', e.target.value)}
          placeholder="Introduction" className={a.input} />
        <FieldError field={path} guard={guard} />
      </div>

      {['body', 'bullets'].map((kind) => (
        <div key={kind} className={styles.linesBlock}>
          <div className={styles.linesHead}>
            <span className={a.labelLead}>{kind === 'body' ? 'Paragraphs' : 'Bullets'}</span>
            <button type="button" onClick={() => onAddLine(kind)} className={a.btnRow}>
              + ADD {kind === 'body' ? 'PARAGRAPH' : 'BULLET'}
            </button>
          </div>
          {section[kind].length === 0 ? (
            <p className={styles.none}>None yet.</p>
          ) : (
            <div className={styles.lines}>
              {section[kind].map((value, j) => (
                <LineRow key={j} kind={kind} index={j} sectionNumber={number} value={value}
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

/** The server's message, or the plain truth that no server answered. */
const messageFor = (err, fallback) =>
  err?.response
    ? (err.response.data?.message || fallback || `Request failed (HTTP ${err.response.status}).`)
    : 'Cannot reach the server — it may not be running. Your changes have not been saved.';

/**
 * `initialView` — PF-110. The Overview's `+ NEW POST` quick action lands here
 * with the editor already open (Admin.dc.html:1095). Read once, at mount: the
 * panel unmounts on every tab change.
 */
export function AdminBlogPanel({ initialView = 'list' }) {
  const { data: posts = [], isLoading } = useBlogPostAdmin();
  const createPost    = useCreatePost();
  const updatePost    = useUpdatePost();
  const togglePublish = useTogglePublish();
  const deletePost    = useDeletePost();
  const { showFlash } = useAdminFlash();

  const [view,      setView]      = useState(initialView);   // 'list' | 'edit'
  // The post open in the editor, by id; null = a new post.
  const [editingId, setEditingId] = useState(null);
  // Unsaved edits, or null = "showing exactly what is saved". The form is
  // DERIVED from the stored record, so REVERT is `setDraft(null)` and can only
  // ever land on the saved state — never on a blank form, which is what the
  // owner objected to in the old Projects `cancelEdit`.
  const [draft,     setDraft]     = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [saving,    setSaving]    = useState(false);
  // Which button was pressed last — the one that shakes when refused.
  const [pressed,   setPressed]   = useState('publish');
  const guard = useFormGuard(formErrors, FID);

  // ⚠️ SERVER failures are a DIFFERENT CHANNEL from validation. A rejected
  // request or a dead backend has no field to mark; routing one through the
  // guard would print "Cannot reach the server" under the title and count it
  // as a field needing attention (utils/loginError.js exists for this).
  const [serverErrors, setServerErrors] = useState([]);

  const saved = editingId ? posts.find((p) => p._id === editingId) ?? null : null;
  const form  = draft ?? postToForm(saved ?? undefined);
  const dirty = isPostDirty(form, saved);
  const editingDraft = Boolean(saved) && saved.published === false;

  /**
   * Replace the form with `next(current form)`. A FUNCTIONAL update, so a
   * late callback — the tag picker's `onRemoved` lands after an await — edits
   * the form as it is then, not as it was when the click happened.
   */
  const edit = (next) => setDraft((d) => next(d ?? postToForm(saved ?? undefined)));

  /** Open a record (or null for a new post) with a clean slate. */
  const open = (id) => {
    setEditingId(id);
    setDraft(null);
    guard.reset();
    setServerErrors([]);
    setView('edit');
  };

  const backToList = () => {
    setEditingId(null);
    setDraft(null);
    guard.reset();
    setServerErrors([]);
    setView('list');
  };

  /** Back to the last SAVED state of whatever is open — never to blank. */
  const revert = () => {
    setDraft(null);
    guard.reset();
    setServerErrors([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    edit((f) => ({ ...f, [name]: value }));
    // ⚠️ CLEARS the mark, never re-validates — re-running the validator on
    // every keystroke marks the excerpt "too long" while it is being written.
    guard.clearField(name);
  };

  // ── Section state ───────────────────────────────────────────────────
  // Every one of these rebuilds the arrays it touches rather than mutating
  // them in place. React compares by reference, so `sections[i].body[j] = v`
  // would change the data and render nothing.
  const updateSection = (index, mutate) =>
    edit((f) => ({
      ...f,
      sections: f.sections.map((section, i) => (i === index ? mutate(section) : section)),
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
    // against the HEADING — a variable-length list has no single input to
    // mark — so typing a paragraph clears the heading's mark.
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
    edit((f) => ({ ...f, sections: [...f.sections, emptySection()] }));

  const removeSection = (index) =>
    edit((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== index) }));

  const moveSection = (index, direction) =>
    edit((f) => {
      const target = index + direction;
      if (target < 0 || target >= f.sections.length) return f;
      const sections = [...f.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...f, sections };
    });

  // ── Save ────────────────────────────────────────────────────────────
  /**
   * @param publish  true = CREATE POST / PUBLISH / SAVE CHANGES,
   *                 false = SAVE AS DRAFT / SAVE DRAFT
   */
  const submit = async (publish) => {
    setPressed(publish ? 'publish' : 'draft');

    // FIRST, and it returns before anything is sent. `published` here is the
    // INTENT — the button decides which rule set applies, not the record.
    const intent = { ...form, published: publish };
    if (!guard.check(intent)) return;
    setServerErrors([]);
    setSaving(true);

    try {
      const data = formToPayload(intent);
      if (editingId) {
        await updatePost.mutateAsync({ id: editingId, data });
      } else {
        await createPost.mutateAsync(data);
      }
      backToList();
      showFlash(!publish ? 'Draft saved' : editingId ? 'Post updated' : 'Post published');
    } catch (err) {
      setServerErrors([messageFor(err)]);
    } finally {
      setSaving(false);
    }
  };

  // ── The list row's PUBLISH ──────────────────────────────────────────
  /**
   * Owner, 2026-10-07: PUBLISH on an INCOMPLETE draft sends nothing — it opens
   * the editor on that post with the missing fields marked, the same refusal
   * the editor's own PUBLISH gives. A complete draft publishes straight from
   * the row, as before. UNPUBLISH is unchanged.
   *
   * ⚠️ The server refuses an incomplete publish on this route too (PF-115's
   * model rule; togglePublish never ran blogRules). This check is the
   * courtesy; that is the gate.
   */
  const publishFromRow = (post) => {
    if (!post.published) {
      const intent = { ...postToForm(post), published: true };
      if (formErrors(intent).length > 0) {
        open(post._id);
        setPressed('publish');
        guard.check(intent);
        return;
      }
    }
    togglePublish.mutate(post._id, {
      onError: (err) => setServerErrors([messageFor(err, 'Could not change the publish state.')]),
    });
  };

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync(confirmId);
    } catch (err) {
      setServerErrors([messageFor(err, 'Could not delete the post.')]);
    }
    setConfirmId(null);
  };

  // ── Buttons — what they say and when they light up ──────────────────
  // ⚠️ `disabled` is `!dirty`, NEVER `|| invalid` (owner rule 2026-09-25): a
  // button that will not light up cannot explain why.
  // ⚠️ The ONE exception: PUBLISH on an untouched draft. Publishing IS the
  // change there (the PF-113 rule).
  const primaryLabel = !saved ? 'CREATE POST' : editingDraft ? 'PUBLISH' : 'SAVE CHANGES';
  const primaryLit   = dirty || editingDraft;
  const draftLabel   = saved ? 'SAVE DRAFT' : 'SAVE AS DRAFT';
  const showDraft    = !saved || editingDraft;
  const shakeOn = (which) => (guard.shaking && pressed === which ? a.shake : '');

  const confirmTarget = posts.find((p) => p._id === confirmId);

  return (
    <div className={a.stack}>
      <div className={styles.toolbar}>
        {view === 'list' ? (
          <button type="button" onClick={() => open(null)} className={a.btnPrimary}>
            + NEW POST
          </button>
        ) : (
          <button type="button" onClick={backToList} className={a.btnGhost}>
            ← BACK TO LIST
          </button>
        )}
      </div>

      {/* The banner names the SCALE; the detail lives under each field. */}
      {guard.errors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>
            CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
            {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
          </span>
        </div>
      )}

      {serverErrors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{serverErrors.join(' ')}</span>
        </div>
      )}

      {/* ── Editor view ── */}
      {view === 'edit' && (
        <section className={a.panel} aria-labelledby="post-form-title">
          <div className={styles.cardHead}>
            {/* h2: AdminLayout renders the panel name as the page's h1. */}
            <h2 className={styles.cardTitle} id="post-form-title">
              {saved ? 'Edit post' : 'New post'}
            </h2>
            {editingDraft && <span className={a.badgeMuted}>DRAFT</span>}
          </div>

          {/* ⚠️ `noValidate` is mandatory. `#post-title` and `#post-excerpt`
              carry `required`, and without it the browser's own bubble fires
              first and the guard never runs — which is how "Title is required."
              went unreachable for a sprint while its unit test passed. */}
          <form
            className={a.form}
            noValidate
            // A submit (the primary button, or Enter in a field) is always the
            // PUBLISH intent; SAVE AS DRAFT is a type="button" calling submit(false).
            onSubmit={(e) => { e.preventDefault(); submit(true); }}
          >
            <div>
              <label className={a.label} htmlFor={fieldId(FID, 'title')}>Title *</label>
              <input {...fieldProps(guard.errors, FID, 'title')}
                name="title" required placeholder="Blog post title"
                value={form.title} onChange={handleChange} className={a.input} />
              <FieldError field="title" guard={guard} />
            </div>
            <div>
              <label className={a.label} htmlFor={fieldId(FID, 'excerpt')}>Excerpt * (max 300 chars)</label>
              <textarea {...fieldProps(guard.errors, FID, 'excerpt')}
                name="excerpt" required rows={2}
                placeholder="Short description shown in the blog list…"
                value={form.excerpt} onChange={handleChange}
                className={a.textarea} />
              <FieldError field="excerpt" guard={guard} />
            </div>

            {/* ── Sections ── */}
            <div>
              <div className={styles.sectionsHead}>
                <span className={a.labelLead}>Sections *</span>
                <button type="button" onClick={addSection} className={a.btnRow}>
                  + ADD SECTION
                </button>
              </div>
              <div className={styles.sections}>
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
                The text field above stays — it is how you type a one-off tag.
                This picks from the pool that already exists. */}
            <VocabularyPicker
              type="tag"
              selected={form.tags}
              onToggle={(value) => edit((f) => ({ ...f, tags: toggleTag(f.tags, value) }))}
              onRemoved={(value) => {
                // The server stripped this tag from every STORED post. The post
                // open here is unsaved form state no refetch can reach, so it
                // is stripped here too — or the next save re-creates the tag.
                edit((f) => ({ ...f, tags: removeTag(f.tags, value) }));
              }}
              onError={(message) => setServerErrors([message])}
            />

            {/* ── PF-103: the author's reading-time pin ────────────────
                Optional; blank — the normal state — means "compute it".
                `readingTimeMinutes` is derived by the model and never sent. */}
            <div>
              <label className={a.label} htmlFor="post-read-time">
                Reading time override (minutes)
              </label>
              <input id="post-read-time" name="readingTimeOverride" type="number"
                min="1" max="999" inputMode="numeric"
                placeholder="Leave blank to calculate from the content"
                value={form.readingTimeOverride} onChange={handleChange}
                className={a.input} />
              <p className={styles.hint}>
                Leave blank to calculate from the content.
                {saved && ` Currently showing ${saved.readingTimeMinutes} min read.`}
              </p>
            </div>

            <div className={styles.actions}>
              {/* ⚠️ `key` is what makes a SECOND refusal shake again — re-adding
                  a class React already rendered restarts no animation. */}
              <button
                key={`publish-${guard.shakeKey}`}
                type="submit"
                className={`${a.btnPrimary} ${shakeOn('publish')}`}
                onAnimationEnd={guard.onShakeEnd}
                disabled={!primaryLit || saving}
              >
                {saving && pressed === 'publish' ? 'SAVING…' : primaryLabel}
              </button>

              {showDraft && (
                <button
                  key={`draft-${guard.shakeKey}`}
                  type="button"
                  className={`${a.btnOutline} ${shakeOn('draft')}`}
                  onClick={() => submit(false)}
                  onAnimationEnd={guard.onShakeEnd}
                  disabled={!dirty || saving}
                >
                  {saving && pressed === 'draft' ? 'SAVING…' : draftLabel}
                </button>
              )}

              {/* The prototype's CANCEL: leaves the editor, saves nothing.
                  REVERT is the "undo my typing" and keeps the editor open. */}
              <button type="button" onClick={backToList} className={a.btnOutline}>
                CANCEL
              </button>

              {dirty && !saving && (
                <button type="button" className={a.btnGhost} onClick={revert}>
                  REVERT CHANGES
                </button>
              )}
              {/* A marker, deliberately not a navigation blocker. */}
              {dirty && !saving && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
            </div>
          </form>
        </section>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <section className={a.panel} aria-label="All posts">
          {isLoading ? (
            <div className={styles.list} aria-busy="true">
              <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
            </div>
          ) : posts.length === 0 ? (
            <p className={a.emptyState}>
              No blog posts yet. Click &ldquo;+ NEW POST&rdquo; to write your first one.
            </p>
          ) : (
            <ul className={styles.list} role="list">
              {posts.map((post) => (
                <li key={post._id} className={styles.row}>
                  <span className={a.rowBody}>
                    <span className={styles.rowHead}>
                      <span className={a.rowTitle}>{post.title}</span>
                      <span className={post.published ? a.badgeOk : a.badgeMuted}>
                        {post.published ? '● PUBLISHED' : '○ DRAFT'}
                      </span>
                      {/* PF-99: the view count as its own chip — NOT also in
                          the meta line (a test pins it is printed once).
                          Renders nothing at zero, as on the public cards. */}
                      <ViewCount views={post.views} className={styles.views} />
                    </span>
                    <span className={styles.rowMeta}>
                      {/* PF-97: `publishedAt || createdAt`, the date the site
                          shows — not `createdAt` alone. */}
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString()} · {post.readingTimeMinutes} min read
                    </span>
                  </span>
                  <span className={a.rowActions}>
                    <button type="button" className={a.btnRow} onClick={() => publishFromRow(post)}
                      aria-label={`${post.published ? 'Unpublish' : 'Publish'} ${post.title}`}>
                      {post.published ? 'UNPUBLISH' : 'PUBLISH'}
                    </button>
                    <button type="button" className={a.btnRow} onClick={() => open(post._id)}
                      aria-label={`Edit ${post.title}`}>
                      EDIT
                    </button>
                    <button type="button" className={a.btnRowDanger} onClick={() => setConfirmId(post._id)}
                      aria-label={`Delete ${post.title}`}>
                      DELETE
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Delete confirmation — the shared dialog, the prototype's copy
          (Admin.dc.html:1216). Rendered outside the form. */}
      {confirmId && (
        <ConfirmDialog
          title="Delete post?"
          busy={deletePost.isPending}
          onCancel={() => setConfirmId(null)}
          onConfirm={handleDelete}
        >
          This will permanently delete &ldquo;{confirmTarget?.title ?? 'this post'}&rdquo; and
          cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
