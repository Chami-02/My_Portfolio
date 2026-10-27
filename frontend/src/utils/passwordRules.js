// frontend/src/utils/passwordRules.js
//
// The client's copy of the new-password rule, shared by the forgot-password
// page (PF-125) and the Settings change form (PF-124). A COURTESY that saves a
// round trip — the server enforces it (backend/src/utils/passwordPolicy.js),
// plus the leaked-password check only it can make.

export const MIN_LENGTH = 15;

/** The per-account resend cooldown, as on the server (services/passwordCodes.js). */
export const RESEND_SECS = 60;

/** Characters as the reader sees them — an emoji is one, as on the server. */
export const lengthOf = (text) => [...text].length;

/** The change form (PF-124) when nothing has been typed. */
export const EMPTY_CHANGE = Object.freeze({ currentPassword: '', password: '', confirm: '', code: '' });

/**
 * The Settings change form's own checks, for `useFormGuard`. Step `passwords`
 * asks for the code; step `code` sends it. Order = the fields' order on
 * screen, so the guard focuses the first one.
 *
 * `strength` is `usePasswordStrength`'s result: its `problem` refuses the new
 * password; null (nothing typed, or the checker still loading) refuses
 * nothing here — the server makes the same check either way.
 */
export function passwordChangeErrors({ step, strength, ...form }) {
  if (step === 'code') {
    return /^\d{6}$/.test(form.code.trim())
      ? []
      : [{ field: 'code', message: 'Enter the 6-digit code from the email.' }];
  }

  const errors = [];
  if (!form.currentPassword) {
    errors.push({ field: 'currentPassword', message: 'Enter your current password.' });
  }
  if (lengthOf(form.password) < MIN_LENGTH) {
    errors.push({ field: 'password', message: `Too short — at least ${MIN_LENGTH} characters.` });
  } else if (form.password === form.currentPassword) {
    errors.push({ field: 'password', message: 'Must be different from your current password.' });
  } else if (strength?.problem) {
    errors.push({ field: 'password', message: strength.problem });
  }
  if (form.confirm !== form.password) {
    errors.push({ field: 'confirm', message: "The two passwords don't match." });
  }
  return errors;
}
