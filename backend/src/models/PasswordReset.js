const mongoose = require('mongoose');

/**
 * One pending "forgot password" code (PF-125).
 *
 * At most ONE row per user (`user` is unique): asking for a new code deletes
 * the old row, so only the newest code can ever work.
 *
 * The code itself is never stored — only an HMAC of it keyed with the
 * server's secret (see `codeHash` in services/passwordCodes.js). A six-digit code has
 * only a million values, so a plain SHA-256 would fall to a database read
 * in seconds; without the key, the hash is worthless.
 *
 * `attempts` counts guesses at THIS code; at the cap the row matches nothing
 * any more, so a code can be guessed at only a few times in total, whatever
 * the rate limiter allows per IP.
 *
 * PF-124's signed-in change keeps its codes in `PasswordChange`, built on
 * this same schema — see services/passwordCodes.js for why they are apart.
 */
const passwordResetSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  sentTo:    { type: String, required: true },   // the login address the code went to
  codeHash:  { type: String, required: true },
  attempts:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },  // the resend cooldown reads this
  expiresAt: { type: Date, required: true },
  // PF-124, change codes only: the NEW password, already bcrypt-hashed at
  // step one (after every check passed), and the session family that asked —
  // step two needs only the code, and only from that session.
  pendingHash: { type: String },
  family:      { type: String },
});

// Same TTL shape as Session and OAuthFlow — Mongo garbage-collects expired
// rows, but the controller checks `expiresAt` itself and never relies on the
// row being gone.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
