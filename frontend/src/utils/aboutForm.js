// frontend/src/utils/aboutForm.js
//
// PF-112 — the About panel's form shape, React-free and directly unit-testable.
// Same split as utils/blogForm.js: the component owns the rendering and the
// staging, these functions own the shape of the data going in and out.

// ⚠️ The URL and email predicates are IMPORTED, not re-written here. Both
// mirror a backend validator (About.js's `urlValidator`, aboutRules' `isEmail`)
// and several forms need them, so a local copy is how one drifts a version
// behind the server it is supposed to mirror.
import { isUsableUrl, isUsableEmail } from './formErrors';

/**
 * `socialExtra.label`'s ceiling, from the model's own
 * `maxlength: [40, 'A link name cannot exceed 40 characters']`.
 *
 * ⚠️ A CONSTANT because the message interpolates it — two places to change one
 * number is how a form ends up refusing 41 characters while telling you the
 * limit is 50.
 */
const MAX_LINK_LABEL = 40;

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
  { name: 'location',         label: 'Location',          placeholder: 'Galle, Sri Lanka' },
  { name: 'email',            label: 'Contact email',     placeholder: 'pcgallege@gmail.com' },
  { name: 'availabilityNote', label: 'Availability note', placeholder: 'Open to junior roles' },
];

/*
 * ⚠️ `name` and `title` were REMOVED from this list in PF-112, owner decision
 * 2026-09-25, and the reason is worth keeping because the obvious reading of it
 * is wrong.
 *
 * They are NOT absent from the public site. The hero prints the name as a
 * two-line styled heading (HeroSection.jsx), the footer and the splash print it
 * again, and the job title appears in the splash, the footer and a hero role
 * pill. All SIX are hardcoded literals. So editing either field here changed
 * nothing anywhere, which is what made them look pointless.
 *
 * The owner's rule is what settles it: location, email and the availability note
 * change with a career; a name does not. So the three that move are wired to the
 * site and the two that do not are dropped from the form.
 *
 * ⚠️ The SCHEMA keeps both, and `formToPayload` simply omits them. That is safe
 * because `updateAbout` does `$set: safe` — it writes only the keys it is given,
 * so an omitted field keeps its stored value rather than being cleared.
 */

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
  location: '', email: '', availabilityNote: '',
  bio: ['', ''],
  availableForWork: true,
  social: SOCIAL_KEYS.reduce((acc, k) => ({ ...acc, [k]: '' }), {}),
  // PF-112 — custom social rows, `{ label, url }` each.
  socialExtra: [],
  // The About section's four stat cards, `{ label, value }` each. Same shape
  // and same rules as socialExtra: both halves required, order preserved.
  stats: [],
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
    location:         about.location         || '',
    email:            about.email            || '',
    availabilityNote: about.availabilityNote || '',
    bio:              about.bio?.length ? [...about.bio] : empty.bio,
    availableForWork: about.availableForWork ?? true,
    social:           { ...empty.social, ...(about.social || {}) },
    // ⚠️ Each row is COPIED, not aliased. Without the inner spread the form's
    // rows would be the same objects the query cache holds, so typing in a
    // custom link would mutate cached data in place — and REVERT, which
    // re-derives from that same cache, would then "restore" the edit.
    socialExtra:      (about.socialExtra || []).map((r) => ({
      label: r.label || '', url: r.url || '',
    })),
    // ⚠️ Copied row by row, for the same reason as socialExtra above: without
    // the inner spread these are the objects the query cache holds, so typing in
    // a stat would mutate cached data in place and REVERT — which re-derives
    // from that same cache — would "restore" the edit.
    stats:            (about.stats || []).map((r) => ({
      label: r.label || '', value: r.value || '',
    })),
  };
};

/** What SAVE PROFILE sends to `PUT /api/about`. */
export const formToPayload = (form) => ({
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
  // ⚠️ A row needs BOTH halves to survive — the schema marks each `required`,
  // so one incomplete row 400s the whole save and takes every other edit on the
  // form down with it.
  //
  // ⚠️ THE OLD NOTE HERE SAID an unfinished row is "the normal state, not an
  // error worth blocking SAVE over". That is REVERSED as of 2026-09-25, owner
  // decision: a row only exists because it was added with `+ ADD LINK`, so an
  // empty one is unfinished work rather than a blank value, and
  // `aboutFormErrors` now refuses the save until it is filled in or removed
  // with its ×. This filter stays as the last line of defence — nothing
  // incomplete should ever reach it now.
  socialExtra:      (form.socialExtra || [])
    .map((r) => ({ label: (r.label || '').trim(), url: (r.url || '').trim() }))
    .filter((r) => r.label && r.url),
  // ⚠️ Same rule and same reversal — see the note above.
  stats:            (form.stats || [])
    .map((r) => ({ label: (r.label || '').trim(), value: (r.value || '').trim() }))
    .filter((r) => r.label && r.value),
});

/**
 * Everything that must be FIXED before `PUT /api/about` is worth sending.
 *
 * Returns `[{ field, message }]` — the shape `utils/formErrors.js` defines and
 * `useFormGuard` consumes, so each message can be printed under the input it
 * belongs to rather than in a list at the top of the form.
 *
 * ⚠️ A COURTESY, NEVER THE GATE. Every rule below mirrors one the server
 * already enforces (`aboutRules` and `About.js`'s own validators, which run on
 * every write path including the seed). The point is to be told about a typo by
 * the field it is in instead of by a 400.
 *
 * ⚠️ WHAT IS DELIBERATELY *NOT* AN ERROR, because the site handles each:
 *   - a blank `email`      → the public site falls back to its literal
 *   - a blank `social.*`   → the icon is HIDDEN (About.js's rule since PF-60)
 *   - an empty `bio`       → no paragraphs render
 *   - an empty `stats`     → the four built-in cards render
 */
export const aboutFormErrors = (form = {}) => {
  const errors = [];

  const email = (form.email || '').trim();
  if (email && !isUsableEmail(email)) {
    errors.push({ field: 'email', message: 'That email address looks off.' });
  }

  // ── The five FIXED social keys ───────────────────────────────────────────
  // ⚠️ AN EMPTY ONE IS NEVER AN ERROR, and this is the half of the rule that is
  // easiest to break while "tightening" validation. Owner, 2026-09-25: "there
  // is a twitter Url and its empty its ok… it is the only thing with a empty
  // block so thats fine." These are schema keys with defaults — the key cannot
  // cease to exist, and clearing the value is the ONLY way to remove the icon
  // from the footer. Refusing a blank one here would make `socialEntries()`'s
  // "an empty URL renders nothing" rule unreachable from the panel.
  SOCIAL_KEYS.forEach((key) => {
    const value = (form.social?.[key] || '').trim();
    if (value && !isUsableUrl(value)) {
      errors.push({
        field:   `social.${key}`,
        message: 'Enter a full URL, starting with https://',
      });
    }
  });

  // ── Custom link rows — the OPPOSITE rule, in the same card ───────────────
  // A row exists only because `+ ADD LINK` created it, and its × is how that is
  // undone. Blank or half-filled, it is unfinished work and the save waits.
  (form.socialExtra || []).forEach((row, i) => {
    const label = (row?.label || '').trim();
    const url   = (row?.url || '').trim();

    if (!label && !url) {
      // Reported against the NAME input, because that is the first one in the
      // row and the guard focuses whatever the first error names.
      errors.push({
        field:   `socialExtra.${i}.label`,
        message: 'Fill this link in, or remove the row with its ×.',
      });
      return;
    }

    if (!label) {
      errors.push({ field: `socialExtra.${i}.label`, message: 'Add a name to save this link.' });
    } else if (label.length > MAX_LINK_LABEL) {
      errors.push({
        field:   `socialExtra.${i}.label`,
        message: `A link name cannot exceed ${MAX_LINK_LABEL} characters.`,
      });
    }

    if (!url) {
      errors.push({ field: `socialExtra.${i}.url`, message: 'Add a URL to save this link.' });
    } else if (!isUsableUrl(url)) {
      errors.push({
        field:   `socialExtra.${i}.url`,
        message: 'Enter a full URL, starting with https://',
      });
    }
  });

  // ── Stat rows — the owner's original example, same rule as the links ─────
  (form.stats || []).forEach((row, i) => {
    const label = (row?.label || '').trim();
    const value = (row?.value || '').trim();

    if (!label && !value) {
      errors.push({
        field:   `stats.${i}.label`,
        message: 'Fill this stat in, or remove the row with its ×.',
      });
      return;
    }

    if (!label) errors.push({ field: `stats.${i}.label`, message: 'Add a label to save this stat.' });
    if (!value) errors.push({ field: `stats.${i}.value`, message: 'Add a value to save this stat.' });
  });

  return errors;
};

/**
 * The form as the DIRTY CHECK sees it: the payload, plus the rows the payload
 * throws away.
 *
 * ⚠️ THIS EXISTS BECAUSE COMPARING PAYLOADS COULD NOT SEE AN ADDED ROW.
 * `formToPayload` drops any incomplete stat or link, so a row the owner had
 * just created — blank, or with a label and no value — compared EQUAL to no row
 * at all. Three consequences, and they are the defect the owner reported:
 *
 *   - SAVE stayed dim, so there was nothing to press
 *   - with nothing to press, there was no way to be told what was wrong
 *   - and the row vanished on the next render from the query cache
 *
 * So the incomplete rows are appended, trimmed, for comparison only. They are
 * still never SENT — `formToPayload` remains the thing that builds the request.
 */
const dirtyShape = (form) => ({
  ...formToPayload(form),
  // Trimmed, so whitespace typed and deleted still does not read as an edit —
  // the property the payload comparison was chosen for in the first place.
  pendingExtra: (form.socialExtra || [])
    .map((r) => ({ label: (r.label || '').trim(), url: (r.url || '').trim() }))
    .filter((r) => !(r.label && r.url)),
  pendingStats: (form.stats || [])
    .map((r) => ({ label: (r.label || '').trim(), value: (r.value || '').trim() }))
    .filter((r) => !(r.label && r.value)),
});

/**
 * Does the staged form differ from what the server holds?
 *
 * Powers the UNSAVED CHANGES marker and whether SAVE is pressable.
 *
 * ⚠️ Dirtiness is about CHANGE, never about VALIDITY. An invalid form is dirty
 * — that is the whole point, because SAVE has to be pressable for the guard to
 * refuse it and say why. Disabling SAVE when something is wrong was the
 * behaviour that made this unreportable.
 *
 * ⚠️ Media is NOT considered here — a picked file lives in component state, not
 * in the form — so the panel ORs this with its own pending slots.
 */
export const isAboutDirty = (form, about) =>
  JSON.stringify(dirtyShape(form)) !==
  JSON.stringify(dirtyShape(aboutToForm(about)));
