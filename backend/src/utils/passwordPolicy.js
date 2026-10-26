// backend/src/utils/passwordPolicy.js
//
// PF-125 — the ONE rule for a NEW admin password (owner, 2026-10-26). Used by
// the forgot-password reset now, and by PF-124's change password and the
// `npm run admin:password` script.
//
// NIST SP 800-63B-4: at least 15 characters when the password is the only
// thing a sign-in checks (it is here, beside Google), and NO composition rules
// — no "one capital, one digit". A long phrase is the strong password.
//
// The ceiling is bcrypt's: it reads only the first 72 BYTES, so anything past
// that would silently not count. 64 characters is the usual published limit;
// the byte check catches a shorter password made of multi-byte characters.
//
// ⚠️ User.password's schema `minlength` stays 8 — it is the database floor,
// and the existing password keeps working until it is changed. This rule
// applies only where a password is CHOSEN.

const MIN_LENGTH = 15;
const MAX_LENGTH = 64;
const MAX_BYTES  = 72;

/**
 * Why `password` cannot be a new admin password, or null if it can.
 * Characters are counted as the person sees them (an emoji is one).
 */
const passwordProblem = (password) => {
  if (typeof password !== 'string') return 'Password must be text';
  const length = [...password].length;
  if (length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (length > MAX_LENGTH || Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    return `Password must be at most ${MAX_LENGTH} characters`;
  }
  return null;
};

module.exports = { passwordProblem, MIN_LENGTH, MAX_LENGTH };
