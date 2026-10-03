import { useState } from 'react';
import {
  useAdminProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useUploadBackground, useRemoveBackground,
} from '../../../hooks/useProjects';
import { useAdminFlash } from '../../../hooks/useAdminFlash';
import { useFormGuard } from '../../../hooks/useFormGuard';
import { useStagedFile } from '../../../hooks/useStagedFile';
import {
  projectToForm, formToPayload, projectFormErrors,
  isProjectDirty, percentToOpacity,
} from '../../../utils/projectForm';
import { toggleTag, removeTag, tagList } from '../../../utils/blogForm';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { imageSpec, formatBytes, messageFor, prepareFile, MAX_UPLOAD_MB } from '../../../utils/mediaFile';
import { DropZone } from '../DropZone';
import { badgeFor } from '../mediaBadge';
import { UploadPill } from '../UploadPill';
import { VocabularyPicker } from '../VocabularyPicker';
import { ConfirmDialog } from '../ConfirmDialog';
import a      from '../../../styles/admin.module.css';
import styles from './AdminProjectsPanel.module.css';

// The portrait's spec, relabelled — same handler limit (MAX_IMAGE_BYTES, 4 MB
// since PF-113 batch 2) and the same magic-byte list on the server (PF-111).
const BACKGROUND_SPEC = imageSpec('Background');

/** The id namespace — every validatable input's id derives from it. */
const FID = 'project';

/** The 2×2 grid. Labels and placeholders: Admin.dc.html:211-226. */
const GRID_FIELDS = [
  { name: 'title',     label: 'Title',      placeholder: 'Project title' },
  { name: 'githubUrl', label: 'GitHub URL', placeholder: 'https://github.com/...' },
  { name: 'liveUrl',   label: 'Live URL',   placeholder: 'https://live-demo.com (optional)' },
  { name: 'order',     label: 'Order',      placeholder: '0', inputMode: 'numeric' },
];

/** The inline message under a field. `role="alert"` so it is announced. */
function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return <p className={a.fieldError} id={errorId(FID, field)} role="alert">{message}</p>;
}

/**
 * The card background block — Admin.dc.html:252-270.
 *
 * ⚠️ NO URL INPUT, deliberately (owner, 2026-10-03). The prototype's
 * `https://image-url.jpg (or upload →)` box cannot work here: PF-111 made
 * `backgroundImage.src` writable ONLY by the upload route, which takes the
 * address and publicId from Cloudinary's own response so a delete can never be
 * aimed by the client. A pasted URL would be stripped by the server on save
 * and silently discarded. Upload is the one way in.
 *
 * Everything STAGES (owner rule, 2026-09-25): a picked file previews from its
 * own blob URL and goes to the server on SAVE; CLEAR on a stored image stages
 * 'remove'. The slider is form state like any other field.
 */
function BackgroundBlock({ stored, staged, opacity, onOpacity, onPick, onReject, onClear, error }) {
  const hasStored = Boolean(stored?.src);
  const stagedFile = staged.file instanceof File ? staged.file : null;
  const pendingRemove = staged.file === 'remove';
  const badge = badgeFor(staged.file, hasStored, 'NONE');

  const src = stagedFile ? staged.previewUrl : pendingRemove ? null : stored?.src || null;

  const meta = stagedFile
    ? [stagedFile.name, formatBytes(stagedFile.size),
        staged.resizedFrom && `resized from ${formatBytes(staged.resizedFrom)}`, 'not saved yet']
        .filter(Boolean).join(' · ')
    : pendingRemove ? 'Will be deleted when you save'
    : hasStored ? 'Uploading a new one permanently deletes this file'
    : 'No image — the card shows its plain surface';

  return (
    <div className={styles.bgBlock}>
      <div className={styles.bgHead}>
        <p className={styles.bgLabel}>
          Card background image — shown behind this project on the home page
        </p>
        <span className={a.spacer} />
        <span className={badge.cls}>{badge.text}</span>
      </div>

      {/* Drag-and-drop (PF-113 batch 2) — the same prepare path as the pill. */}
      <DropZone onFile={onPick} onReject={onReject}>
      <div className={styles.bgRow}>
        {/* The preview runs at the slider's opacity, live — the prototype's
            `bgPreviewOpacity`. Decorative: the meta line says what it shows. */}
        <span
          className={styles.bgPreview}
          aria-hidden="true"
          data-testid="bg-preview"
          style={{
            backgroundImage: src ? `url("${src}")` : 'none',
            opacity: percentToOpacity(opacity),
          }}
        />
        <div className={styles.bgBody}>
          <span className={styles.bgMeta}>{meta}</span>
          <div className={styles.bgActions}>
            <UploadPill
              id="project-background-file"
              className={styles.bgUpload}
              accept={BACKGROUND_SPEC.accept}
              label={hasStored || stagedFile ? '↑ REPLACE IMAGE' : '↑ UPLOAD IMAGE'}
              onPick={onPick}
            />
            {/* CLEAR means "no image after SAVE": it discards a staged pick,
                or stages the removal of a stored one. Undoing a staged removal
                is REVERT's job, as everywhere else in the form. */}
            {(stagedFile || (hasStored && !pendingRemove)) && (
              <button type="button" className={styles.clear} onClick={onClear}>CLEAR</button>
            )}
          </div>
          <div className={styles.opacityRow}>
            <label className={styles.opacityLabel} htmlFor="project-opacity">Image visibility</label>
            {/* 10–100 step 5 is Admin.dc.html:266; percentToOpacity clamps to
                the schema's 0.1–1.0 on the way out, or the save would 400. */}
            <input
              id="project-opacity"
              type="range" min="10" max="100" step="5"
              className={styles.range}
              value={opacity}
              onChange={(e) => onOpacity(Number(e.target.value))}
            />
            <span className={styles.opacityValue} aria-hidden="true">{opacity}%</span>
          </div>
        </div>
      </div>

      </DropZone>

      {/* Reported HERE, beside the button — not in the banner at the top of the
          form, which is off-screen by the time you reach this block. */}
      {error && <p className={a.fieldError} role="alert">{error}</p>}

      <p className={styles.caption}>PNG, JPEG OR WEBP · MAX {MAX_UPLOAD_MB} MB · LARGER PHOTOS ARE RESIZED</p>
    </div>
  );
}

export function AdminProjectsPanel() {
  const { data: projects = [], isLoading } = useAdminProjects();
  const createProject    = useCreateProject();
  const updateProject    = useUpdateProject();
  const deleteProject    = useDeleteProject();
  const uploadBackground = useUploadBackground();
  const removeBackground = useRemoveBackground();
  const { showFlash } = useAdminFlash();

  // ── Which record, and the form DERIVED from it ────────────────────────────
  // `editingId` null = creating. `draft` is null until the first edit, so the
  // fields follow the query until the owner types and stop following it after
  // — About's pattern, which removed a setState-in-effect sync.
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const saved = editingId ? projects.find((p) => p._id === editingId) ?? null : null;
  const form = draft ?? projectToForm(saved);

  const background = useStagedFile();
  const guard = useFormGuard(projectFormErrors, FID);

  const [pickError, setPickError]   = useState(null);   // shown INSIDE the background block
  // True while a picked photo is being resized; SAVE waits for it.
  const [preparing, setPreparing]   = useState(false);
  const [saveErrors, setSaveErrors] = useState([]);
  const [saving, setSaving]         = useState(false);
  // Which button was pressed last — the one that shakes when refused.
  const [pressed, setPressed]       = useState('publish');
  const [confirmId, setConfirmId]   = useState(null);

  const dirty = isProjectDirty(form, saved) || Boolean(background.file);
  const editingDraft = Boolean(saved) && saved.published === false;

  /** Edit a field, and clear (never re-validate) that field's mark. */
  const edit = (patch, field) => {
    setDraft({ ...form, ...patch });
    if (field) guard.clearField(field);
  };

  /**
   * Back to the last SAVED state of whatever is open — never to blank.
   * ⚠️ This is the fix for the old `cancelEdit`, which set the form to EMPTY
   * so a mis-click mid-edit lost the record's content out of the form. And it
   * discards the staged file too: a revert that left a picked image staged is
   * a half-revert, whose tell is SAVE uploading a file the owner discarded.
   */
  const discard = () => {
    setDraft(null);
    background.clear();
    setPickError(null);
    setSaveErrors([]);
    guard.reset();
  };

  /** Open a record (or `null` for a new one) with a clean slate. */
  const open = (id) => {
    discard();
    setEditingId(id);
  };

  const startEdit = (project) => {
    open(project._id);
    // No `behavior` — inherits the root's scroll-behavior, so the
    // reduced-motion override reaches it (the ScrollToHash rule).
    window.scrollTo({ top: 0 });
  };

  // The ONE path for the pill AND a drop (PF-113 batch 2): type check, resize
  // if large, size check. A rejected file does NOT clear what is already
  // staged (PF-112's lesson).
  const pickBackground = async (file) => {
    setPreparing(true);
    try {
      const result = await prepareFile(file, BACKGROUND_SPEC);
      if (result.error) { setPickError(result.error); return; }
      setPickError(null);
      background.stage(result.file, { resizedFrom: result.resizedFrom });
    } catch {
      // prepareFile rethrows only the UNEXPECTED; never let it pass silently.
      setPickError('This file could not be prepared for upload — try another file.');
    } finally {
      setPreparing(false);
    }
  };

  const clearBackground = () => {
    setPickError(null);
    background.stage(background.file instanceof File ? null : 'remove');
  };

  // ── SAVE ──────────────────────────────────────────────────────────────────
  /**
   * @param publish  true = ADD PROJECT / PUBLISH / SAVE CHANGES,
   *                 false = SAVE AS DRAFT / SAVE DRAFT
   *
   * Sequential, record first: the background route needs the project's id,
   * which a new project only has once it is created. A failed upload after a
   * successful create leaves the owner EDITING the new project with the file
   * still staged, so SAVE can simply be pressed again — never a "saved" flash
   * for a half-saved project.
   */
  const submit = async (publish) => {
    setPressed(publish ? 'publish' : 'draft');

    // FIRST, and it returns before anything is sent. `published` here is the
    // INTENT — which rule set applies is decided by the button, not the record.
    if (!guard.check({ ...form, published: publish })) return;

    setPickError(null);
    setSaveErrors([]);
    setSaving(true);

    const failures = [];
    let id = editingId;
    let recordSaved = false;

    try {
      const payload = formToPayload(form, { publish });
      if (id) {
        await updateProject.mutateAsync({ id, data: payload });
      } else {
        id = (await createProject.mutateAsync(payload))._id;
      }
      recordSaved = true;
    } catch (err) {
      failures.push(`Project: ${messageFor(err)}`);
    }

    if (id && background.file) {
      try {
        if (background.file === 'remove') await removeBackground.mutateAsync(id);
        else await uploadBackground.mutateAsync({ id, file: background.file });
        background.clear();
      } catch (err) {
        failures.push(`Background: ${messageFor(err)}`);
      }
    }

    setSaving(false);

    if (failures.length) {
      if (recordSaved) {
        // The record is stored; keep the owner on it (a new project becomes
        // the one being edited) with whatever failed still staged.
        setDraft(null);
        setEditingId(id);
        guard.reset();
      }
      setSaveErrors(recordSaved ? [`${publish ? 'Project' : 'Draft'} saved.`, ...failures] : failures);
      return;
    }

    // Full success: back to a blank "Add new project", as the prototype does
    // after either save (Admin.dc.html:918-936).
    open(null);
    showFlash(!publish ? 'Draft saved' : editingId ? 'Project updated' : 'Project added');
  };

  const handleDelete = async () => {
    const id = confirmId;
    try {
      await deleteProject.mutateAsync(id);
      if (id === editingId) open(null);   // the record being edited is gone
    } catch (err) {
      setSaveErrors([`Delete: ${messageFor(err)}`]);
    }
    setConfirmId(null);
  };

  // ── Buttons — what they say and when they light up ────────────────────────
  // ⚠️ `disabled` is `!dirty`, NEVER `|| invalid` (owner rule 2026-09-25): a
  // button that will not light up cannot explain why.
  // ⚠️ The ONE exception to "dim until dirty": PUBLISH on an untouched draft.
  // Publishing IS the change there; dimming it would make a finished draft
  // impossible to publish without first editing something.
  const primaryLabel = !saved ? 'ADD PROJECT' : editingDraft ? 'PUBLISH' : 'SAVE CHANGES';
  const primaryLit   = dirty || editingDraft;
  const draftLabel   = saved ? 'SAVE DRAFT' : 'SAVE AS DRAFT';
  const showDraft    = !saved || editingDraft;
  const shakeOn = (which) => (guard.shaking && pressed === which ? a.shake : '');

  const confirmTarget = projects.find((p) => p._id === confirmId);

  return (
    <div className={a.stack}>
      <section className={a.panel} aria-labelledby="project-form-title">
        <div className={styles.cardHead}>
          {/* h2: AdminLayout renders the panel name as the page's h1. */}
          <h2 className={styles.cardTitle} id="project-form-title">
            {saved ? 'Edit project' : 'Add new project'}
          </h2>
          {editingDraft && <span className={a.badgeMuted}>DRAFT</span>}
          <span className={a.spacer} />
          {/* Leaves edit mode. The saved record is untouched in the list and
              EDIT brings it straight back; REVERT is the "undo my typing". */}
          {saved && (
            <button type="button" className={styles.cancelEdit} onClick={() => open(null)}>
              CANCEL EDIT
            </button>
          )}
        </div>

        {/* ⚠️ `noValidate` is mandatory: a native `required` fires the
            browser's bubble, which pre-empts onSubmit, so the guard below
            would never run. The old panel's validation was exactly that. */}
        <form
          className={a.form}
          noValidate
          // A submit (the primary button, or Enter in a field) is always the
          // PUBLISH intent; SAVE AS DRAFT is a type="button" calling submit(false).
          onSubmit={(e) => { e.preventDefault(); submit(true); }}
        >
          {guard.errors.length > 0 && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>
                CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
                {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
              </span>
            </div>
          )}

          {/* Server and file failures — a SEPARATE channel from field marks:
              a dead backend has no field to mark (utils/loginError.js). */}
          {saveErrors.length > 0 && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>{saveErrors.join(' ')}</span>
            </div>
          )}

          <div className={a.fieldGrid}>
            {GRID_FIELDS.map(({ name, label, placeholder, inputMode }) => (
              <div key={name}>
                <label className={a.label} htmlFor={`${FID}-${name}`}>{label}</label>
                <input
                  {...fieldProps(guard.errors, FID, name)}
                  className={a.input}
                  name={name}
                  inputMode={inputMode}
                  required={name === 'title' || name === 'githubUrl'}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={(e) => edit({ [name]: e.target.value }, name)}
                />
                <FieldError field={name} guard={guard} />
              </div>
            ))}
          </div>

          <div>
            <label className={a.label} htmlFor={`${FID}-description`}>Description</label>
            <textarea
              {...fieldProps(guard.errors, FID, 'description')}
              className={a.textarea}
              rows={3}
              required
              placeholder="What does this project do? Be honest and specific."
              value={form.description}
              onChange={(e) => edit({ description: e.target.value }, 'description')}
            />
            <FieldError field="description" guard={guard} />
          </div>

          <div>
            <label className={a.label} htmlFor={`${FID}-tech`}>Tech stack (comma separated)</label>
            <input
              {...fieldProps(guard.errors, FID, 'tech')}
              className={a.inputMono}
              placeholder="React, Node.js, MongoDB, Docker"
              value={form.tech}
              onChange={(e) => edit({ tech: e.target.value }, 'tech')}
            />
            <FieldError field="tech" guard={guard} />
          </div>

          {/* The shared `tech` vocabulary (PF-113 — its first consumer). The
              text field above stays, for a one-off; this picks from the pool.
              ⚠️ × is a CASCADING delete across every project, behind the
              server's impact count. */}
          <VocabularyPicker
            type="tech"
            selected={form.tech}
            onToggle={(value) => edit({ tech: toggleTag(form.tech, value) }, 'tech')}
            onRemoved={(value) => {
              // The server stripped it from every STORED project; the one open
              // here is unsaved form state no refetch can reach. Only touch
              // the form if it actually carried the value, so a delete does
              // not make an untouched form dirty.
              if (tagList(form.tech).some((t) => t.toLowerCase() === value.toLowerCase())) {
                edit({ tech: removeTag(form.tech, value) });
              }
            }}
            onError={(message) => setSaveErrors([message])}
          />

          <BackgroundBlock
            stored={saved?.backgroundImage}
            staged={background}
            opacity={form.opacity}
            onOpacity={(opacity) => edit({ opacity })}
            onPick={pickBackground}
            onReject={setPickError}
            onClear={clearBackground}
            error={pickError}
          />

          <label className={a.checkRow}>
            <input
              type="checkbox"
              className={a.checkbox}
              checked={form.featured}
              onChange={(e) => edit({ featured: e.target.checked })}
            />
            <span>Mark as featured project</span>
          </label>

          <div className={styles.saveRow}>
            {/* `key` remounts the button so a SECOND refusal shakes again. */}
            <button
              key={`publish-${guard.shakeKey}`}
              type="submit"
              className={`${a.btnPrimary} ${shakeOn('publish')}`}
              onAnimationEnd={guard.onShakeEnd}
              disabled={!primaryLit || saving || preparing}
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
                disabled={!dirty || saving || preparing}
              >
                {saving && pressed === 'draft' ? 'SAVING…' : draftLabel}
              </button>
            )}

            {dirty && !saving && (
              <button type="button" className={a.btnGhost} onClick={discard}>
                REVERT CHANGES
              </button>
            )}
            {/* A marker, deliberately not a navigation blocker. */}
            {dirty && !saving && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
          </div>
        </form>
      </section>

      <section className={a.panel} aria-labelledby="project-list-title">
        <h2 className={styles.listTitle} id="project-list-title">
          All projects ({projects.length})
        </h2>

        {isLoading ? (
          <div className={styles.list} aria-busy="true">
            <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
          </div>
        ) : projects.length === 0 ? (
          <p className={a.emptyState}>No projects yet. Add one above.</p>
        ) : (
          <ul className={styles.list} role="list">
            {projects.map((p) => (
              <li key={p._id} className={p._id === editingId ? `${a.row} ${a.rowActive}` : a.row}>
                <span className={a.rowBody}>
                  <span className={styles.rowHead}>
                    <span className={a.rowTitle}>{p.title}</span>
                    {p.featured && <span className={a.badge}>★ FEATURED</span>}
                    {p.published === false && <span className={a.badgeMuted}>DRAFT</span>}
                  </span>
                  <span className={a.rowMeta}>{(p.tech || []).join(' · ') || 'No tech yet'}</span>
                </span>
                <span className={a.rowActions}>
                  <button type="button" className={a.btnRow} onClick={() => startEdit(p)}
                    aria-label={`Edit ${p.title}`}>
                    EDIT
                  </button>
                  <button type="button" className={a.btnRowDanger} onClick={() => setConfirmId(p._id)}
                    aria-label={`Delete ${p.title}`}>
                    DELETE
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmId && (
        <ConfirmDialog
          title="Delete project?"
          busy={deleteProject.isPending}
          onCancel={() => setConfirmId(null)}
          onConfirm={handleDelete}
        >
          {/* Admin.dc.html:1105, verbatim apart from the curly quotes. */}
          This will permanently remove &ldquo;{confirmTarget?.title ?? 'this project'}&rdquo; from
          your portfolio and cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
