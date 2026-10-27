const crypto = require('crypto');
const PasswordReset  = require('../models/PasswordReset');
const PasswordChange = require('../models/PasswordChange');

// ── Emailed one-time codes (PF-125, shared with PF-124) ──────────────────────
// The forgot-password reset and the signed-in password change both prove an
// inbox with a six-digit code. Both keep it the same way, in their OWN
// collection (`PasswordReset`, `PasswordChange` — one schema): one row per
// user, only an HMAC of the code, 10 minutes, a few guesses, single use.
//
// Separate collections on purpose: the forgot form is public, so if the two
// shared a row, a stranger asking for reset codes could keep deleting the
// owner's pending change code.

const CODE_TTL_MS  = 10 * 60 * 1000;
const COOLDOWN_MS  = 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * HMAC keyed with the server secret, bound to the user. Without the key a
 * database copy cannot test the million possible codes.
 */
const codeHash = (userId, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}:${code}`).digest('hex');

const sameHash = (a, b) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Has a code been sent to this user within the cooldown? One email a minute
 * per account, so a form cannot flood the inbox (or spend the Gmail quota).
 */
const coolingDown = (Model, userId) =>
  Model.exists({ user: userId, createdAt: { $gt: new Date(Date.now() - COOLDOWN_MS) } });

/**
 * A fresh code for `userId`, sent to `sentTo`. Returns the code to email.
 * A new code replaces the old one: only the newest can ever work. `extra`
 * rides on the row (the change's pending password hash and session family).
 */
const issueCode = async (Model, userId, sentTo, extra = {}) => {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await Model.deleteMany({ user: userId });
  await Model.create({
    user:      userId,
    sentTo,
    codeHash:  codeHash(userId, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    ...extra,
  });
  return code;
};

/**
 * Spends ONE guess at the user's code and returns its row if `code` is right
 * and was sent to `sentTo`; null for every failure (wrong, expired, used up,
 * never sent, another address). The code is NOT used up yet — `claimCode`
 * does that — so a caller can still refuse for another reason and leave it
 * working.
 */
const checkCode = async (Model, userId, sentTo, code) => {
  // Spend the guess ATOMICALLY before comparing: two racing requests cannot
  // both slip under the cap. A row at the cap matches nothing from then on
  // — the code is dead, even the right one — until a new code replaces it
  // or the TTL removes it.
  const row = await Model.findOneAndUpdate(
    { user: userId, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  );
  if (!row || row.expiresAt <= new Date() || row.sentTo !== sentTo) return null;
  return sameHash(row.codeHash, codeHash(userId, code)) ? row : null;
};

/** Single use: of two racing correct requests, only one deletes the row. */
const claimCode = async (Model, row) => Boolean(await Model.findOneAndDelete({ _id: row._id }));

/**
 * Once a password has changed — by any door — every pending code for that
 * user is void: a code checked against the OLD password and history must not
 * set a new one later.
 */
const dropAllCodes = (userId) => Promise.all([
  PasswordReset.deleteMany({ user: userId }),
  PasswordChange.deleteMany({ user: userId }),
]);

module.exports = {
  coolingDown, issueCode, checkCode, claimCode, dropAllCodes,
  MAX_ATTEMPTS,
};
