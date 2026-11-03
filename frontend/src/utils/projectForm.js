// frontend/src/utils/projectForm.js
//
// PF-113 — the Projects panel's form, as plain data. React-free and directly
// unit-testable, matching aboutForm.js / blogForm.js.
//
// `tech` is held as the comma-separated STRING the text input shows, exactly
// like the blog form's `tags`, so the picker and the input edit one value and
// cannot disagree. blogForm.js's `tagList` / `toggleTag` / `removeTag` work on
// that string and are reused rather than copied. `category` is the same shape
// holding at most ONE value (PF-144, the label on the card's picture).
//
// ── PF-144 — a page per project ─────────────────────────────────────────────
// The form gained the project page: `sections` (Blog's editor and Blog's
// section helpers), `category`, `role`, `client`, and `startedOn` / `endedOn` /
// `ongoing` (stored "2025-06", typed in MonthYearField). The opacity slider and
// its helpers are GONE — the picture now sits above the card's text, not
// behind it, so nothing reads `backgroundImage.opacity` any more.

import {
  tagList, sectionsToForm, sectionsPayload, sectionErrors, emptySection as emptyTextSection,
} from './blogForm';
import { isUsableUrl } from './formErrors';
import { compareMonthYear, monthYearProblem } from './monthYear';
import { REQUIRED } from './entryForm';

// The server's maxlengths (models/Project.js).
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;
const MAX_LINE = 80;   // role, client

// ── PF-144 part 2 — pictures inside a section (models/sectionSchema.js) ──
export const MAX_SECTION_IMAGES = 4;
const MAX_CAPTION = 120;

/**
 * A section picture in the FORM is one of two things:
 *   saved   `{ publicId, url, width, height, caption }` — in the ledger already
 *   staged  `{ file, previewUrl, caption, resizedFrom? }` — picked, not sent;
 *           the panel uploads it on SAVE and swaps in the ledger entry.
 * Only saved ones reach the payload, as `{ publicId, caption }` — the server
 * fills in everything else from the ledger.
 */
export const isStagedPicture = (image) => Boolean(image && image.file);

/**
 * What a new project's page starts with (owner, 2026-11-03): the three parts
 * every project page has. A FACTORY — fresh arrays every call (blogForm's
 * emptySection lesson). Headings alone are not an error: a section is only
 * checked once it has text, and empty ones are dropped on save.
 */
export const starterSections = () => [
  { heading: 'Description',      body: [''], bullets: [],   images: [] },
  { heading: 'Key Features',     body: [],   bullets: [''], images: [] },
  { heading: 'Outcome & Impact', body: [''], bullets: [],   images: [] },
];

/** "+ ADD SECTION" — Blog's empty section, plus a project's picture list. */
export const emptySection = () => ({ ...emptyTextSection(), images: [] });

/** Stored sections → form sections, pictures copied (never the cache's own objects). */
const sectionsWithImages = (stored, whenNone) =>
  sectionsToForm(stored, whenNone).map((section, i) => ({
    ...section,
    images: section.images ?? ((stored?.[i]?.images) || []).map((img) => ({
      publicId: img.publicId, url: img.url, width: img.width ?? 0, height: img.height ?? 0,
      caption: img.caption ?? '',
    })),
  }));

/**
 * Form sections → what is sent. Text trimmed and blank lines dropped (Blog's
 * rules); pictures as `{ publicId, caption }`; a section left wholly empty —
 * no heading, text or picture — dropped.
 */
const projectSectionsPayload = (sections = []) =>
  (sections || []).map((section) => {
    const [text] = sectionsPayload([section]);
    return {
      heading: text?.heading ?? '',
      body:    text?.body ?? [],
      bullets: text?.bullets ?? [],
      images:  (section.images || []).filter((img) => !isStagedPicture(img) && img.publicId)
        .map((img) => ({ publicId: img.publicId, caption: String(img.caption ?? '').trim() })),
    };
  }).filter((s) => s.heading || s.body.length || s.bullets.length || s.images.length);

/**
 * A blank form. A FACTORY, not a constant — the same lesson as blogForm's
 * `emptyForm()`: one shared object is one shared mutation away from every
 * "new project" starting with the last one's values.
 *
 * `published` is the STORED state of the record being edited (true for a
 * new one, because a new project is not a draft until SAVE AS DRAFT says so).
 * Which button was pressed is decided at submit, not held here.
 */
export const emptyProjectForm = () => projectToForm(null);

/** A project from the API → the form's shape. `null` gives a blank form. */
export const projectToForm = (project) => ({
  title:       project?.title ?? '',
  description: project?.description ?? '',
  category:    (project?.categories || []).join(', '),
  role:        project?.role ?? '',
  client:      project?.client ?? '',
  startedOn:   project?.startedOn ?? '',
  endedOn:     project?.endedOn ?? '',
  ongoing:     project?.ongoing === true,
  tech:        (project?.tech || []).join(', '),
  githubUrl:   project?.githubUrl ?? '',
  liveUrl:     project?.liveUrl ?? '',
  order:       String(project?.order ?? 0),
  featured:    Boolean(project?.featured),
  // ⚠️ `!== false`, matching the server's `$ne: false`: a project written
  // before PF-113 has no field and IS published.
  published:   project ? project.published !== false : true,
  // A stored project with no sections (only possible before migration 013)
  // opens with NONE rather than the starter set, so opening and saving an
  // untouched record is not an edit.
  sections:    sectionsWithImages(project?.sections, project ? () => [] : starterSections),
});

/**
 * The form → the request body.
 *
 * @param publish  which button was pressed — true for ADD PROJECT / PUBLISH /
 *                 SAVE CHANGES, false for SAVE AS DRAFT / SAVE DRAFT
 *
 * ⚠️ No `backgroundImage`: the picture travels on its own route (PF-111) and
 * since PF-144 nothing about it is edited here.
 *
 * ⚠️ `liveUrl` is sent as `null` when blank — the schema's own default — so a
 * cleared live link is cleared, not stored as ''. An ongoing project sends
 * no end date (the model refuses both).
 */
export const formToPayload = (form, { publish }) => ({
  title:       form.title.trim(),
  description: form.description.trim(),
  categories:  tagList(form.category),
  role:        form.role.trim(),
  client:      form.client.trim(),
  startedOn:   form.startedOn.trim(),
  endedOn:     form.ongoing ? '' : form.endedOn.trim(),
  ongoing:     Boolean(form.ongoing),
  tech:        tagList(form.tech),
  githubUrl:   form.githubUrl.trim(),
  liveUrl:     form.liveUrl.trim() || null,
  order:       Number(form.order) || 0,
  featured:    Boolean(form.featured),
  published:   Boolean(publish),
  sections:    projectSectionsPayload(form.sections),
});

/**
 * What must be fixed before this save is sent. `[{ field, message }]`.
 *
 * Reads `form.published` as the INTENT — the panel passes
 * `{ ...form, published: <button pressed> }`.
 *
 * Two rule sets, the server's (models/Project.js):
 *   DRAFT    → a title (so it can be found in the list), the maxlengths, and
 *              anything that IS filled in must be usable (URLs, dates)
 *   PUBLISH  → all of that, plus summary, GitHub URL, ≥ 1 tech and a page
 *              (≥ 1 section, each with a heading and some text)
 *
 * In SCREEN order — the banner names them in this order and the first one is
 * focused. A skipped required box says "This field is required." (owner,
 * 2026-10-31).
 * ⚠️ A COURTESY, never the gate — every rule here is one the model enforces.
 */
export const projectFormErrors = (form = {}) => {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const publish = form.published !== false;
  const text = (key) => String(form[key] ?? '').trim();

  const title = text('title');
  if (!title) add('title', REQUIRED);
  else if (title.length > MAX_TITLE) add('title', `Title cannot exceed ${MAX_TITLE} characters.`);

  const description = text('description');
  if (!description) {
    if (publish) add('description', REQUIRED);
  } else if (description.length > MAX_DESCRIPTION) {
    add('description', `Summary cannot exceed ${MAX_DESCRIPTION} characters.`);
  }

  if (tagList(form.category).length > 1) add('category', 'A project takes one category.');

  for (const [key, label] of [['role', 'Role'], ['client', 'Client']]) {
    if (text(key).length > MAX_LINE) add(key, `${label} cannot exceed ${MAX_LINE} characters.`);
  }

  const startedOn = text('startedOn');
  const endedOn = form.ongoing ? '' : text('endedOn');
  if (monthYearProblem(startedOn)) add('startedOn', monthYearProblem(startedOn));
  if (monthYearProblem(endedOn)) add('endedOn', monthYearProblem(endedOn));
  else if (startedOn && endedOn && !monthYearProblem(startedOn) && compareMonthYear(endedOn, startedOn) < 0) {
    add('endedOn', 'The end date cannot be before the start date.');
  }

  if (publish) {
    // A staged picture counts here too — SAVE uploads it before sending.
    const hasContent = (form.sections || []).some((s) =>
      sectionsPayload([s]).length > 0 || (s.images || []).length > 0);
    if (!hasContent) {
      // Nothing on screen to point at — reported where the editor starts.
      add('sections', 'Write at least one section — the project page needs a body.');
    }
    errors.push(...sectionErrors(form.sections, { withImages: true }));
  }

  // Pictures — on drafts too: these are the model's limits, not publish rules.
  (form.sections || []).forEach((section, i) => {
    const images = section.images || [];
    const field = `sections.${i}.images`;
    const label = `Section ${String(i + 1).padStart(2, '0')}`;
    if (images.length > MAX_SECTION_IMAGES) add(field, `${label} can show at most ${MAX_SECTION_IMAGES} pictures.`);
    else if (images.some((img) => String(img.caption ?? '').trim().length > MAX_CAPTION)) {
      add(field, `A caption in ${label} is longer than ${MAX_CAPTION} characters.`);
    }
  });

  if (publish && tagList(form.tech).length === 0) {
    add('tech', 'Pick or type at least one technology to publish.');
  }

  const githubUrl = text('githubUrl');
  if (!githubUrl) {
    if (publish) add('githubUrl', REQUIRED);
  } else if (!isUsableUrl(githubUrl)) {
    add('githubUrl', 'Use a full address starting with https://');
  }

  const liveUrl = text('liveUrl');
  if (liveUrl && !isUsableUrl(liveUrl)) add('liveUrl', 'Use a full address starting with https://');

  if (text('order') !== '' && !Number.isFinite(Number(form.order))) {
    add('order', 'Order must be a number.');
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
  // A picked-but-not-sent picture is a change the payload cannot show.
  if ((form.sections || []).some((s) => (s.images || []).some(isStagedPicture))) return true;
  const saved = projectToForm(project);
  return JSON.stringify(formToPayload(form, { publish: saved.published })) !==
         JSON.stringify(formToPayload(saved, { publish: saved.published }));
};
