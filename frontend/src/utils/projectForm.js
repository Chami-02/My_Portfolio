// frontend/src/utils/projectForm.js
//
// PF-113 — the Projects panel's form, as plain data. React-free and directly
// unit-testable, matching aboutForm.js / blogForm.js.
//
// `tech` is held as the comma-separated STRING the text input shows, exactly
// like the blog form's `tags`, so the picker and the input edit one value and
// cannot disagree. blogForm.js's `tagList` / `toggleTag` / `removeTag` work on
// that string and are reused rather than copied.

import { tagList } from './blogForm';
import { isUsableUrl } from './formErrors';

/** The schema's own range for `backgroundImage.opacity` (models/Project.js). */
export const OPACITY_MIN = 0.1;
export const OPACITY_MAX = 1;
/** The schema default — and the public card's fallback (ProjectsSection.jsx). */
export const OPACITY_DEFAULT = 0.75;

// The server's maxlengths (models/Project.js).
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;

/**
 * Slider position → stored opacity. The slider runs 10–100 in steps of 5, the
 * prototype's `type="range" min="10" max="100" step="5"` (Admin.dc.html:266).
 *
 * ⚠️ CLAMPED to the schema's 0.1–1.0. Anything outside 400s the whole save, and
 * the slider is not the only thing that can produce a value — a stored 0.05
 * from a hand-edited database would otherwise round-trip into a refused save.
 * Rounded to two places so 0.35 is sent as 0.35, not 0.35000000000000003.
 */
export const percentToOpacity = (percent) => {
  const n = Number(percent);
  if (!Number.isFinite(n)) return OPACITY_DEFAULT;
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Math.round(n) / 100));
};

/** Stored opacity → slider position, snapped to the slider's step of 5. */
export const opacityToPercent = (opacity) => {
  const n = Number(opacity);
  const safe = Number.isFinite(n) ? Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, n)) : OPACITY_DEFAULT;
  return Math.round((safe * 100) / 5) * 5;
};

/**
 * A blank form. A FACTORY, not a constant — the same lesson as blogForm's
 * `emptyForm()`: one shared object is one shared mutation away from every
 * "new project" starting with the last one's values.
 *
 * `published` is the STORED state of the record being edited (true for a
 * new one, because a new project is not a draft until SAVE AS DRAFT says so).
 * Which button was pressed is decided at submit, not held here.
 */
export const emptyProjectForm = () => ({
  title:       '',
  description: '',
  tech:        '',
  githubUrl:   '',
  liveUrl:     '',
  order:       '0',
  featured:    false,
  published:   true,
  opacity:     opacityToPercent(OPACITY_DEFAULT),
});

/** A project from the API → the form's shape. `null` gives a blank form. */
export const projectToForm = (project) => {
  if (!project) return emptyProjectForm();
  return {
    title:       project.title ?? '',
    description: project.description ?? '',
    tech:        (project.tech || []).join(', '),
    githubUrl:   project.githubUrl ?? '',
    liveUrl:     project.liveUrl ?? '',
    order:       String(project.order ?? 0),
    featured:    Boolean(project.featured),
    // ⚠️ `!== false`, matching the server's `$ne: false`: a project written
    // before PF-113 has no field and IS published.
    published:   project.published !== false,
    opacity:     opacityToPercent(project.backgroundImage?.opacity ?? OPACITY_DEFAULT),
  };
};

/**
 * The form → the request body.
 *
 * @param publish  which button was pressed — true for ADD PROJECT / PUBLISH /
 *                 SAVE CHANGES, false for SAVE AS DRAFT / SAVE DRAFT
 *
 * ⚠️ `backgroundImage` carries ONLY `opacity`. The image itself travels on its
 * own route (PF-111); the server strips `src` / `publicId` from this body
 * anyway, and sending them would only suggest they matter.
 *
 * ⚠️ `liveUrl` is sent as `null` when blank — the schema's own default — so a
 * cleared live link is cleared, not stored as ''.
 */
export const formToPayload = (form, { publish }) => ({
  title:       form.title.trim(),
  description: form.description.trim(),
  tech:        tagList(form.tech),
  githubUrl:   form.githubUrl.trim(),
  liveUrl:     form.liveUrl.trim() || null,
  order:       Number(form.order) || 0,
  featured:    Boolean(form.featured),
  published:   Boolean(publish),
  backgroundImage: { opacity: percentToOpacity(form.opacity) },
});

/**
 * What must be fixed before this save is sent. `[{ field, message }]`.
 *
 * Reads `form.published` as the INTENT — the panel passes
 * `{ ...form, published: <button pressed> }`.
 *
 * Two rule sets, the server's (models/Project.js, PF-113):
 *   DRAFT    → a title (so it can be found in the list), the maxlengths, and
 *              any URL that IS filled in must be a usable one
 *   PUBLISH  → all of that, plus description, GitHub URL and ≥ 1 tech
 *
 * ⚠️ A COURTESY, never the gate — every rule here is one the model enforces.
 */
export const projectFormErrors = (form = {}) => {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const publish = form.published !== false;

  const title = String(form.title || '').trim();
  const description = String(form.description || '').trim();
  const githubUrl = String(form.githubUrl || '').trim();
  const liveUrl = String(form.liveUrl || '').trim();

  if (!title) add('title', publish ? 'Title is required.' : 'A draft needs at least a title.');
  else if (title.length > MAX_TITLE) add('title', `Title cannot exceed ${MAX_TITLE} characters.`);

  if (!githubUrl) {
    if (publish) add('githubUrl', 'GitHub URL is required to publish.');
  } else if (!isUsableUrl(githubUrl)) {
    add('githubUrl', 'Use a full address starting with https://');
  }

  if (liveUrl && !isUsableUrl(liveUrl)) add('liveUrl', 'Use a full address starting with https://');

  if (String(form.order ?? '').trim() !== '' && !Number.isFinite(Number(form.order))) {
    add('order', 'Order must be a number.');
  }

  if (!description) {
    if (publish) add('description', 'Description is required to publish.');
  } else if (description.length > MAX_DESCRIPTION) {
    add('description', `Description cannot exceed ${MAX_DESCRIPTION} characters.`);
  }

  if (publish && tagList(form.tech).length === 0) {
    add('tech', 'Pick or type at least one technology to publish.');
  }

  return errors;
};

/**
 * Does the form differ from what the server holds?
 *
 * Compared through the PAYLOAD, so whitespace typed and deleted does not read
 * as an edit. `publish` is pinned to the stored state so the comparison is of
 * content only. Media is NOT considered — a picked file lives in component
 * state — so the panel ORs this with its staged slot, as About does.
 *
 * ⚠️ About CHANGE, never VALIDITY: an invalid form is dirty, because SAVE must
 * be pressable for the guard to refuse it and say why.
 */
export const isProjectDirty = (form, project) => {
  const saved = projectToForm(project);
  return JSON.stringify(formToPayload(form, { publish: saved.published })) !==
         JSON.stringify(formToPayload(saved, { publish: saved.published }));
};
