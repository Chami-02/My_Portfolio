// PF-143 — the admin forms of Education and Certificates: record ⇄ form ⇄
// payload, and the courtesy checks (the model's rules are the gate). Each
// list's form is a flat object of strings; `published` is the button's
// INTENT, never a form field (Projects' pattern).
import { compareMonthYear, monthYearProblem } from './monthYear';

const HTTPS = /^https:\/\/[^\s/]+\.[^\s]+$/i;

const text = (v) => String(v ?? '').trim();

/** Under a skipped required box (owner, 2026-10-31). */
export const REQUIRED = 'This field is required.';

/** Push `field`'s problem when `value` is longer than `max`. */
const tooLong = (add, field, label, value, max) => {
  if (value.length > max) add(field, `${label} cannot exceed ${max} characters.`);
};

// ── Certificates ─────────────────────────────────────────────────────────────

const CERT_KEYS = ['title', 'issuer', 'issued', 'expires', 'credentialId', 'verifyUrl'];

export const certificateToForm = (cert) =>
  Object.fromEntries(CERT_KEYS.map((k) => [k, cert?.[k] ?? '']));

export const certificatePayload = (form, { publish }) => ({
  ...Object.fromEntries(CERT_KEYS.map((k) => [k, text(form[k])])),
  published: Boolean(publish),
});

export const certificateFormErrors = (form = {}) => {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const publish = form.published !== false;
  const v = Object.fromEntries(CERT_KEYS.map((k) => [k, text(form[k])]));

  if (!v.title) add('title', REQUIRED);
  else tooLong(add, 'title', 'Title', v.title, 150);

  if (!v.issuer) { if (publish) add('issuer', 'Issuer is required to publish.'); }
  else tooLong(add, 'issuer', 'Issuer', v.issuer, 100);

  if (!v.issued) { if (publish) add('issued', 'Add the year it was issued to publish.'); }
  else if (monthYearProblem(v.issued)) add('issued', monthYearProblem(v.issued));

  if (monthYearProblem(v.expires)) add('expires', monthYearProblem(v.expires));
  else if (v.expires && v.issued && !monthYearProblem(v.issued) && compareMonthYear(v.expires, v.issued) < 0) {
    add('expires', 'The expiry cannot be before the issue date.');
  }

  tooLong(add, 'credentialId', 'Credential ID', v.credentialId, 100);

  if (v.verifyUrl && !HTTPS.test(v.verifyUrl)) add('verifyUrl', 'Use a full address starting with https://');

  return errors;
};

// ── Education ────────────────────────────────────────────────────────────────

const EDU_KEYS = ['school', 'degree', 'fieldOfStudy', 'start', 'end', 'grade', 'activities', 'description', 'website'];

export const educationToForm = (entry) => Object.fromEntries(EDU_KEYS.map((k) => [k, entry?.[k] ?? '']));

export const educationPayload = (form, { publish }) => ({
  ...Object.fromEntries(EDU_KEYS.map((k) => [k, text(form[k])])),
  published: Boolean(publish),
});

export const educationFormErrors = (form = {}) => {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const v = Object.fromEntries(EDU_KEYS.map((k) => [k, text(form[k])]));

  // School, start and end: required on EVERY save, drafts too (owner, 2026-10-31).
  if (!v.school) add('school', REQUIRED);
  else tooLong(add, 'school', 'School', v.school, 120);

  tooLong(add, 'degree', 'Degree', v.degree, 120);   // optional (owner, 2026-10-31)

  tooLong(add, 'fieldOfStudy', 'Field of study', v.fieldOfStudy, 120);

  if (!v.start) add('start', REQUIRED);
  else if (monthYearProblem(v.start)) add('start', monthYearProblem(v.start));

  if (!v.end) add('end', REQUIRED);
  else if (monthYearProblem(v.end)) add('end', monthYearProblem(v.end));
  else if (v.start && !monthYearProblem(v.start) && compareMonthYear(v.end, v.start) < 0) {
    add('end', 'The end cannot be before the start.');
  }

  tooLong(add, 'grade', 'Grade', v.grade, 80);
  tooLong(add, 'activities', 'Activities and societies', v.activities, 500);
  tooLong(add, 'description', 'Description', v.description, 1000);

  if (v.website && !HTTPS.test(v.website)) add('website', 'Use a full address starting with https://');

  return errors;
};

// ── Both ─────────────────────────────────────────────────────────────────────

/** True when the form differs from the saved record (or from blank, for a new one). */
export const isEntryDirty = (form, saved, { toForm, toPayload }) => {
  const base = toForm(saved);
  return JSON.stringify(toPayload(form, { publish: false })) !==
         JSON.stringify(toPayload(base, { publish: false }));
};

/** An `ids` list in the new order, with `id` moved by `delta` (−1 up, +1 down). */
export const moveId = (ids, id, delta) => {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = ids.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

/** `id` dropped BEFORE position `index` of `ids` (index = length → the end). */
export const dropId = (ids, id, index) => {
  const without = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(index - (ids.indexOf(id) < index ? 1 : 0), without.length));
  return [...without.slice(0, at), id, ...without.slice(at)];
};
