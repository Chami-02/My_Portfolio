// frontend/src/utils/formErrors.js
//
// The shape every admin panel's validation speaks, and the two helpers that
// keep a field's INPUT and its ERROR addressed by the same string.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Owner requirement, 2026-09-25: a save that cannot go through must refuse,
// shake the button, and mark the offending field IN PLACE rather than printing
// a sentence at the top of the form. Marking a field means the validator and
// the JSX have to agree on which field is which — and a mismatch there is
// silent, because an error nobody can match to an input simply renders nowhere.
// One vocabulary, defined once, is what stops that.
//
// React-free and directly unit-testable, matching the rest of utils/.
//
// ⚠️ THIS IS A COURTESY LAYER, NEVER THE GATE. The server validates everything
// independently — the model's own validators run on every write path including
// the seed. This exists so the owner is told about a typo by the field it is
// in, rather than by a 400.

/**
 * An error is `{ field, message }`.
 *
 * `field` is a PATH STRING, and the dotted form is load-bearing for rows:
 *
 *     'email'                → a plain field
 *     'social.github'        → a fixed key inside an object
 *     'socialExtra.0.url'    → the URL of the FIRST custom link
 *     'sections.2.heading'   → the heading of the THIRD blog section
 *
 * ⚠️ The INDEX is part of the path, so two incomplete rows produce two
 * distinct errors and each marks its own inputs. A validator that returned one
 * error per FIELD NAME would mark every row when one was wrong.
 */

/** The first error for a field, or undefined. */
export const errorFor = (errors, field) =>
  (errors || []).find((e) => e.field === field)?.message;

/** Is this field currently in error? Sugar, because it reads better in JSX. */
export const hasError = (errors, field) => errorFor(errors, field) !== undefined;

/**
 * A DOM id for a field, and for the element describing it.
 *
 * ⚠️ Derived from the same path string the error carries, never hand-written
 * beside it. The alternative — an `id` typed into the JSX and a `field` typed
 * into the validator — is two sources of truth for one identity, and when they
 * drift the error is simply invisible: `aria-describedby` points at nothing,
 * `focusFirst` finds nothing, and every test that checks "an error is reported"
 * still passes, because the error object is there. Only a test that looks for
 * the MESSAGE IN THE DOM would catch it.
 *
 * Dots are not legal in an HTML id in practice (they are valid, but they break
 * `querySelector` and CSS selectors without escaping), so they become dashes.
 *
 *     fieldId('about', 'socialExtra.0.url')  →  'about-socialExtra-0-url'
 */
export const fieldId = (prefix, field) => `${prefix}-${String(field).replace(/\./g, '-')}`;

/** The id of the <p> describing that field. */
export const errorId = (prefix, field) => `${fieldId(prefix, field)}-error`;

/**
 * Every prop an invalid-capable input needs, in one spread.
 *
 * ⚠️ `aria-invalid` is what the STYLESHEET keys on — `admin.module.css` styles
 * `.input[aria-invalid='true']` rather than offering an `.inputInvalid` class.
 * That is deliberate: with a class, the red border and the screen-reader state
 * are two separate things to remember and one of them gets forgotten. Here
 * there is nothing to forget, and a field that LOOKS wrong is guaranteed to
 * ANNOUNCE wrong.
 *
 * ⚠️ `aria-describedby` is undefined rather than '' when the field is clean.
 * An empty string still creates the attribute, pointing at no element, which
 * some screen readers announce as a blank description.
 */
export const fieldProps = (errors, prefix, field) => {
  const message = errorFor(errors, field);
  return {
    id: fieldId(prefix, field),
    'aria-invalid': message ? 'true' : undefined,
    'aria-describedby': message ? errorId(prefix, field) : undefined,
  };
};

// ── Shared predicates ───────────────────────────────────────────────────────
// Kept here rather than in each panel's own form module because they mirror
// BACKEND validators that several models share, and a second copy is how one
// of them drifts a version behind.

/**
 * The model's `urlValidator` (backend/src/models/About.js), transcribed.
 *
 * ⚠️ `^https?://.+\..+` — deliberately loose, and deliberately NOT `new URL()`.
 * `new URL('https://x')` parses happily, and the server would then refuse it;
 * a client check that accepts what the server rejects is worse than no check,
 * because it moves the error from the field to a banner.
 */
export const isUsableUrl = (value) => /^https?:\/\/.+\..+/i.test(String(value || '').trim());

/**
 * The same loose pattern ContactSection uses, and the same reasoning: anything
 * stricter starts rejecting addresses that work. `isEmail()` on the server is
 * the real check.
 */
export const isUsableEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

/** A row is "untouched" only when EVERY one of its values is blank. */
export const rowIsBlank = (row, keys) =>
  keys.every((k) => !String(row?.[k] ?? '').trim());
