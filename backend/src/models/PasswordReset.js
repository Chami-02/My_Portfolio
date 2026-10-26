const mongoose = require('mongoose');

/**
 * One pending "forgot password" code (PF-125).
 *
 * At most ONE row per user (`user` is unique): asking for a new code deletes
 * the old row, so only the newest code can ever work.
 *
 * The code itself is never stored — only an HMAC of it keyed with the
 * server's secret (see `codeHash` in authController). A six-digit code has
 * only a million values, so a plain SHA-256 would fall to a database read
 * in seconds; without the key, the hash is worthless.
 *
 * `attempts` counts wrong guesses at THIS code; the controller deletes the
 * row at the cap, so a code can be guessed at only a few times in total,
 * whatever the rate limiter allows per IP.
 */
const passwordResetSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  sentTo:    { type: String, required: true },   // the login address the code went to
  codeHash:  { type: String, required: true },
  attempts:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },  // the resend cooldown reads this
  expiresAt: { type: Date, required: true },
});

// Same TTL shape as Session and OAuthFlow — Mongo garbage-collects expired
// rows, but the controller checks `expiresAt` itself and never relies on the
// row being gone.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
