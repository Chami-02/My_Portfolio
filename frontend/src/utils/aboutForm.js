// frontend/src/utils/aboutForm.js
//
// PF-112 — the About panel's form shape, React-free and directly unit-testable.
// Same split as utils/blogForm.js: the component owns the rendering and the
// staging, these functions own the shape of the data going in and out.

/**
 * Basic info — five fields, transcribed from Admin.dc.html:1009-1013.
 *
 * ⚠️ `email` lives HERE and deliberately not in SOCIAL_FIELDS. The prototype's
 * `socials` array (Admin.dc.html:1014-1018) and DESIGN.md §6.3 both list a
 * sixth social entry for Email, but About.social has no `email` key by a
 * documented decision in the model — the contact address has exactly one home,
 * and two inputs writing one value is how they drift.
 */
export const BASIC_FIELDS = [
  { name: 'name',             label: 'Full name',         placeholder: 'Parindra Gallage' },
  { name: 'title',            label: 'Job title',         placeholder: 'Full-Stack Developer' },
  { name: 'location',         label: 'Location',          placeholder: 'Galle, Sri Lanka' },
  { name: 'email',            label: 'Contact email',     placeholder: 'pcgallege@gmail.com' },
  { name: 'availabilityNote', label: 'Availability note', placeholder: 'Open to junior roles' },
];

export const SOCIAL_FIELDS = [
  { name: 'github',    label: 'GitHub URL',    placeholder: 'https://github.com/Chami-02' },
  { name: 'linkedin',  label: 'LinkedIn URL',  placeholder: 'https://linkedin.com/in/...' },
  { name: 'facebook',  label: 'Facebook URL',  placeholder: 'https://web.facebook.com/...' },
  { name: 'instagram', label: 'Instagram URL', placeholder: 'https://www.instagram.com/...' },
  { name: 'twitter',   label: 'Twitter URL',   placeholder: 'Leave empty — no account yet' },
];

const SOCIAL_KEYS = SOCIAL_FIELDS.map((f) => f.name);

/**
 * A blank form.
 *
 * ⚠️ A FACTORY, NOT A CONSTANT, and the reason is the trap blogForm.js records:
 * a shared object hands every caller the same `bio` array, so one panel pushing
 * a paragraph mutates the "empty" form every later caller receives. The two
 * empty strings match the prototype's two-paragraph bio.
 */
export const emptyAboutForm = () => ({
  name: '', title: '', location: '', email: '', availabilityNote: '',
  bio: ['', ''],
  availableForWork: true,
  social: SOCIAL_KEYS.reduce((acc, k) => ({ ...acc, [k]: '' }), {}),
});

/**
 * Fill a form from the API document.
 *
 * ⚠️ `social` SPREADS THE API's OBJECT LAST, on purpose. Listing the five keys
 * and stopping there once dropped facebook and instagram out of the form — and
 * because the form is what gets submitted, the next save overwrote them with
 * nothing. Any social key the API grows survives a round trip through this
 * panel even before the panel knows how to render it.
 *
 * ⚠️ `availableForWork` uses `?? true`, never `||`. With `||`, a stored `false`
 * would read back as `true` and the very next save would silently re-publish
 * the owner as available.
 */
export const aboutToForm = (about) => {
  const empty = emptyAboutForm();
  if (!about) return empty;

  return {
    name:             about.name             || '',
    title:            about.title            || '',
    location:         about.location          || '',
    email:            about.email            || '',
    availabilityNote: about.availabilityNote || '',
    bio:              about.bio?.length ? [...about.bio] : empty.bio,
    availableForWork: about.availableForWork ?? true,
    social:           { ...empty.social, ...(about.social || {}) },
  };
};

/** What SAVE PROFILE sends to `PUT /api/about`. */
export const formToPayload = (form) => ({
  name:             form.name.trim(),
  title:            form.title.trim(),
  location:         form.location.trim(),
  email:            form.email.trim(),
  availabilityNote: form.availabilityNote.trim(),
  // Blank paragraphs are dropped rather than stored — an empty <p> on the
  // public page is worse than a shorter bio. A bio edited down to nothing
  // still sends [], which the schema accepts.
  bio:              form.bio.map((p) => p.trim()).filter(Boolean),
  availableForWork: Boolean(form.availableForWork),
  social:           Object.fromEntries(
    Object.entries(form.social).map(([k, v]) => [k, (v || '').trim()])
  ),
});

/**
 * Does the staged form differ from what the server holds?
 *
 * Powers the UNSAVED CHANGES marker. Compares the PAYLOAD rather than the raw
 * form, so trailing whitespace someone typed and deleted does not read as an
 * edit.
 *
 * ⚠️ Media is NOT considered here — a picked file lives in component state, not
 * in the form — so the panel ORs this with its own pending slots.
 */
export const isAboutDirty = (form, about) =>
  JSON.stringify(formToPayload(form)) !==
  JSON.stringify(formToPayload(aboutToForm(about)));
