import { useState } from 'react';
import {
  useAdminProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useUploadBackground, useRemoveBackground, useUploadSectionImage,
} from '../../../hooks/useProjects';
import { useAdminFlash } from '../../../hooks/useAdminFlash';
import { useFormGuard } from '../../../hooks/useFormGuard';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useStagedFile } from '../../../hooks/useStagedFile';
import {
  projectToForm, formToPayload, projectFormErrors, isProjectDirty, emptySection, isStagedPicture,
} from '../../../utils/projectForm';
import { toggleTag, removeTag, tagList, hasTag } from '../../../utils/blogForm';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { imageSpec, formatBytes, messageFor, prepareFile, MAX_UPLOAD_MB } from '../../../utils/mediaFile';
import { DropZone } from '../DropZone';
import { badgeFor } from '../mediaBadge';
import { UploadPill } from '../UploadPill';
import { VocabularyPicker } from '../VocabularyPicker';
import { SectionsEditor } from '../SectionsEditor';
import { SectionPictures } from '../SectionPictures';
import { MonthYearField } from '../MonthYearField';
import { ConfirmDialog } from '../ConfirmDialog';
import { LoadError }     from '../LoadError';
import a      from '../../../styles/admin.module.css';
import styles from './AdminProjectsPanel.module.css';

// The portrait's spec, relabelled — same handler limit (MAX_IMAGE_BYTES, 4 MB
// since PF-113 batch 2) and the same magic-byte list on the server (PF-111).
const BACKGROUND_SPEC = imageSpec('Picture');

/** The id namespace — every validatable input's id derives from it. */
const FID = 'project';

/**
 * Every validatable field's name for the refused-save banner — "Title,
 * Summary need attention" (owner, 2026-10-31: the banner NAMES the fields).
 * Section headings are named by their own number.
 */
const LABELS = {
  title: 'Title', description: 'Summary', category: 'Category', role: 'Role', client: 'Client',
  startedOn: 'Start date', endedOn: 'End date', sections: 'Sections', tech: 'Tech stack',
  githubUrl: 'GitHub URL', liveUrl: 'Live URL', order: 'Order',
};
const labelFor = (field) => {
  const section = /^sections\.(\d+)\./.exec(field);
  return section ? `Section ${String(Number(section[1]) + 1).padStart(2, '0')}` : LABELS[field];
};

/** The two link fields and the order, in a grid. Placeholders: Admin.dc.html:211-226. */
const GRID_FIELDS = [
  { name: 'githubUrl', label: 'GitHub URL', placeholder: 'https://github.com/...', required: true },
  { name: 'liveUrl',   label: 'Live URL',   placeholder: 'https://live-demo.com' },
  { name: 'order',     label: 'Order',      placeholder: '0', inputMode: 'numeric' },
];

/** A label, with " *" when the field is required to publish. */
function Label({ htmlFor, children, required }) {
  return <label className={`${a.label} ${required ? styles.required : ''}`} htmlFor={htmlFor}>{children}</label>;
}

/** The inline message under a field. `role="alert"` so it is announced. */
function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return <p className={a.fieldError} id={errorId(FID, field)} role="alert">{message}</p>;
}

/**
 * The project's picture — Admin.dc.html:252-270's background block. Since
 * PF-144 it is the picture at the TOP of the card and on the project's page,
 * no longer behind the text, so the prototype's "Image visibility" slider is
 * gone (owner, 2026-11-03: a card over a picture could not be read).
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
function BackgroundBlock({ stored, staged, onPick, onReject, onClear, error }) {
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
    : 'No picture — the card shows a plain panel';

  return (
    <div className={styles.bgBlock}>
      <div className={styles.bgHead}>
        <p className={styles.bgLabel}>
          Project picture — shown at the top of its card and on its page
        </p>
        <span className={a.spacer} />
        <span className={badge.cls}>{badge.text}</span>
      </div>

      {/* Drag-and-drop (PF-113 batch 2) — the same prepare path as the pill. */}
      <DropZone onFile={onPick} onReject={onReject}>
      <div className={styles.bgRow}>
        {/* Decorative: the meta line says what it shows. */}
        <span
          className={styles.bgPreview}
          aria-hidden="true"
          data-testid="bg-preview"
          style={{ backgroundImage: src ? `url("${src}")` : 'none' }}
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
  const projectsQuery = useAdminProjects();
  const { data: projects = [], isLoading } = projectsQuery;
  // Failed AND nothing to show. A background refetch that fails keeps the
  // last good `data` and still sets isError — that list is fine to show.
  const isError = projectsQuery.isError && projectsQuery.data === undefined;
  const createProject    = useCreateProject();
  const updateProject    = useUpdateProject();
  const deleteProject    = useDeleteProject();
  const uploadBackground = useUploadBackground();
  const removeBackground = useRemoveBackground();
  const uploadSectionImage = useUploadSectionImage();
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

  /** The sections editor's FUNCTIONAL update (it may land after a re-render). */
  const editSections = (update) => {
    setDraft((d) => {
      const current = d ?? projectToForm(saved);
      return { ...current, sections: update(current.sections) };
    });
    guard.clearField('sections');
  };

  /**
   * Back to the last SAVED state of whatever is open — never to blank.
   * ⚠️ This is the fix for the old `cancelEdit`, which set the form to EMPTY
   * so a mis-click mid-edit lost the record's content out of the form. And it
   * discards the staged file too: a revert that left a picked image staged is
   * a half-revert, whose tell is SAVE uploading a file the owner discarded.
   */
  const discard = () => {
    // Staged section pictures preview from blob URLs — free them.
    (draft?.sections || []).forEach((s) => (s.images || []).forEach((img) => {
      if (isStagedPicture(img)) URL.revokeObjectURL(img.previewUrl);
    }));
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
    if (!guard.check({ ...form, published: publish })) return false;

    setPickError(null);
    setSaveErrors([]);
    setSaving(true);

    const failures = [];
    let id = editingId;
    let recordSaved = false;

    // ── PF-144: section pictures — the public site only ever sees the
    // FINISHED state. Staged pictures upload into the project's ledger first
    // (shown nowhere), then ONE save names them. A NEW project with pictures
    // is created as a DRAFT first (the upload needs its id), and only that
    // final save applies the button pressed.
    let working = form;
    const staged = form.sections.some((sec) => (sec.images || []).some(isStagedPicture));
    let step = 'Project';
    try {
      if (!id) {
        id = (await createProject.mutateAsync(formToPayload(form, { publish: staged ? false : publish })))._id;
        recordSaved = true;
      }
      if (staged) {
        step = 'Picture';
        for (let i = 0; i < working.sections.length; i += 1) {
          for (let j = 0; j < (working.sections[i].images || []).length; j += 1) {
            const img = working.sections[i].images[j];
            if (!isStagedPicture(img)) continue;
            const entry = await uploadSectionImage.mutateAsync({ id, file: img.file });
            URL.revokeObjectURL(img.previewUrl);
            // Swap the uploaded one in at once, so a later failure never
            // uploads it twice — the retry sends only what is still staged.
            working = {
              ...working,
              sections: working.sections.map((sec, si) => (si !== i ? sec : {
                ...sec,
                images: sec.images.map((im, ij) => (ij !== j ? im : { ...entry, caption: img.caption ?? '' })),
              })),
            };
          }
        }
        step = 'Project';
      }
      if (editingId || staged) {
        await updateProject.mutateAsync({ id, data: formToPayload(working, { publish }) });
      }
      recordSaved = true;
    } catch (err) {
      failures.push(`${step}: ${messageFor(err)}`);
      // Keep what DID upload, so SAVE again sends only the rest.
      if (working !== form) setDraft(working);
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
        if (working === form) setDraft(null);
        setEditingId(id);
        guard.reset();
      }
      // A new project with pictures was created as a DRAFT and stays one
      // until the save that names its pictures succeeds.
      const savedAs = publish && !(staged && !editingId) ? 'Project' : 'Draft';
      setSaveErrors(recordSaved ? [`${savedAs} saved.`, ...failures] : failures);
      return false;
    }

    // Full success: back to a blank "Add new project", as the prototype does
    // after either save (Admin.dc.html:918-936).
    open(null);
    showFlash(!publish ? 'Draft saved' : editingId ? 'Project updated' : 'Project added');
    return true;
  };

  // ── PF-118 batch 2 — the unsaved-changes guard ────────────────────────────
  // What the dialog's SAVE does is the SAFE save for the record's state: a NEW
  // project is saved as a DRAFT (invisible publicly — the owner meant to finish
  // it, not to publish it from a "you're leaving" prompt); an existing project
  // keeps whatever it already is, so a live one stays live and a draft stays a
  // draft.
  const keepsLive = Boolean(saved) && saved.published !== false;
  const requestLeave = useUnsavedChanges({
    dirty,
    save: () => submit(keepsLive),
    saveLabel: !saved ? 'SAVE AS DRAFT' : keepsLive ? 'SAVE CHANGES' : 'SAVE DRAFT',
    what: saved ? `“${saved.title}”` : 'your new project',
  });

  // ── The list row's PUBLISH / UNPUBLISH (owner, 2026-10-14) ────────────────
  /**
   * Blog's row toggle (AdminBlogPanel `publishFromRow`), for projects:
   *   • a live project → UNPUBLISH: it becomes a draft, hidden from the site.
   *   • a COMPLETE draft → PUBLISH, straight from the row.
   *   • an INCOMPLETE draft sends nothing — it opens the editor with the
   *     missing fields marked, the same refusal the editor's PUBLISH gives.
   * Only `published` is sent. ⚠️ The server's document-level draft rule is the
   * gate (projectController.updateProject); this check is the courtesy.
   * Admin-only and instant, like Blog's — the row is the whole action.
   */
  const publishFromRow = async (project) => {
    const publish = project.published === false;
    if (publish) {
      const intent = { ...projectToForm(project), published: true };
      if (projectFormErrors(intent).length > 0) {
        requestLeave(() => {
          open(project._id);
          setPressed('publish');
          guard.check(intent);
          window.scrollTo({ top: 0 });
        });
        return;
      }
    }
    try {
      await updateProject.mutateAsync({ id: project._id, data: { published: publish } });
      showFlash(publish ? 'Project published' : 'Project unpublished');
    } catch (err) {
      setSaveErrors([`${publish ? 'Publish' : 'Unpublish'}: ${messageFor(err)}`]);
    }
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

  // The banner NAMES the fields (owner, 2026-10-31), each once — a section
  // can carry two messages on one heading.
  const named = [...new Set(guard.errors.map((e) => labelFor(e.field)))];
  const problemCount = named.length;
  const problemList = named.every(Boolean) ? named.join(', ') : `${guard.errors.length} fields`;

  /** A one-line text box, its label and its message. */
  const textField = (name, label, { placeholder, required, mono, inputMode } = {}) => (
    <div key={name}>
      <Label htmlFor={`${FID}-${name}`} required={required}>{label}</Label>
      <input
        {...fieldProps(guard.errors, FID, name)}
        className={mono ? a.inputMono : a.input}
        name={name}
        inputMode={inputMode}
        required={required}
        placeholder={placeholder}
        value={form[name]}
        onChange={(e) => edit({ [name]: e.target.value }, name)}
      />
      <FieldError field={name} guard={guard} />
    </div>
  );

  const monthField = (name, label) => (
    <div>
      <MonthYearField
        label={label}
        value={form[name]}
        field={fieldProps(guard.errors, FID, name)}
        onChange={(value) => edit({ [name]: value }, name)}
      />
      <FieldError field={name} guard={guard} />
    </div>
  );

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
            <button type="button" className={styles.cancelEdit} onClick={() => requestLeave(() => open(null))}>
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
                CHECK THE CHANGES AGAIN — {problemList}{' '}
                {problemCount === 1 ? 'needs' : 'need'} attention.
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

          <p className={styles.requiredNote}><span aria-hidden="true">*</span> Indicates required to publish</p>

          {textField('title', 'Title', { placeholder: 'Project title', required: true })}

          <div>
            <Label htmlFor={`${FID}-description`} required>Summary — two lines on the card</Label>
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

          {/* PF-144 — the label on the card's picture: ONE value from the
              `category` list, optional. Picking another REPLACES it. */}
          <div>
            <p className={a.label} id={`${FID}-category-label`}>Category</p>
            <VocabularyPicker
              type="category"
              single
              selected={form.category}
              field={{ ...fieldProps(guard.errors, FID, 'category'), 'aria-labelledby': `${FID}-category-label` }}
              onToggle={(value) => edit({ category: hasTag(form.category, value) ? '' : value }, 'category')}
              onRemoved={(value) => {
                if (hasTag(form.category, value)) edit({ category: '' });
              }}
              onError={(message) => setSaveErrors([message])}
            />
            <FieldError field="category" guard={guard} />
          </div>

          <div className={a.fieldGrid}>
            {textField('role', 'Role', { placeholder: 'Solo developer' })}
            {textField('client', 'Client / for whom', { placeholder: 'University project' })}
          </div>

          {/* "FEB 2024 – PRESENT": a start, and an end OR Ongoing. */}
          <div className={styles.dateRow}>
            {monthField('startedOn', 'Started')}
            <div>
              {!form.ongoing && monthField('endedOn', 'Finished')}
              <label className={`${a.checkRow} ${styles.ongoing}`}>
                <input
                  type="checkbox"
                  className={a.checkbox}
                  checked={form.ongoing}
                  onChange={(e) => edit({ ongoing: e.target.checked }, 'endedOn')}
                />
                <span>Ongoing — shows “PRESENT”</span>
              </label>
            </div>
          </div>

          {/* PF-144 — the project's own page, in Blog's editor. */}
          <SectionsEditor fid={FID} sections={form.sections} guard={guard}
            emptySection={emptySection} onChange={editSections}
            aboveBody={(section, i) => (
              <SectionPictures
                fid={FID}
                index={i}
                images={section.images || []}
                guard={guard}
                onChange={(update) => editSections((list) => list.map((sec, k) =>
                  (k === i ? { ...sec, images: update(sec.images || []) } : sec)))}
              />
            )} />

          <div>
            <Label htmlFor={`${FID}-tech`} required>Tech stack (comma separated)</Label>
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

          <div className={a.fieldGrid}>
            {GRID_FIELDS.map(({ name, label, placeholder, inputMode, required }) =>
              textField(name, label, { placeholder, inputMode, required }))}
          </div>

          <BackgroundBlock
            stored={saved?.backgroundImage}
            staged={background}
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
          {/* No count while there is nothing to count — a loading or failed
              list is not a list of zero (PF-117). */}
          All projects{!isLoading && !isError && ` (${projects.length})`}
        </h2>

        {isLoading ? (
          <div className={styles.list} aria-busy="true">
            <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
          </div>
        ) : isError ? (
          <LoadError what="YOUR PROJECTS" query={projectsQuery} />
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
                  <button type="button" className={a.btnRow} onClick={() => publishFromRow(p)}
                    aria-label={`${p.published === false ? 'Publish' : 'Unpublish'} ${p.title}`}>
                    {p.published === false ? 'PUBLISH' : 'UNPUBLISH'}
                  </button>
                  <button type="button" className={a.btnRow} onClick={() => requestLeave(() => startEdit(p))}
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
