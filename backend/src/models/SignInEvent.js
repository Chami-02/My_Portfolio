const mongoose = require('mongoose');

/**
 * One row per security event on the admin account (PF-133) — the Settings
 * Sessions card's "Recent activity" and the daily digest read it.
 *
 *   kind     'sign-in' | 'reset-request' | 'password-reset' | 'password-change'
 *            | 'backup-download' | 'backup-restore'   (PF-135 — high-value
 *            actions are logged too: OWASP Logging, ASVS 5.0 V16. `failed` =
 *            the password re-check refused it.)
 *   outcome  'ok' | 'failed'
 *
 * A failed sign-in or a reset request for an address that matches NO account
 * has no `user` — those rows are still the owner's to see (someone is trying
 * addresses), so `/auth/sign-ins` shows them beside the account's own.
 *
 * `address` is what was TYPED (or the Google address), lower-cased and cut to
 * the longest valid address — never a password. `device` is the short label
 * and `location` the approximate place, the same two the Sessions card shows
 * (utils/deviceLabel.js, utils/requestLocation.js); never the raw User-Agent.
 *
 * `digestedAt` / `digestRun` belong to the daily digest (cron/digest): a
 * failed row is claimed once, by one run.
 */
const RETENTION_DAYS = 90;

const signInEventSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    kind:     { type: String, required: true, enum: ['sign-in', 'reset-request', 'password-reset', 'password-change', 'backup-download', 'backup-restore'] },
    outcome:  { type: String, required: true, enum: ['ok', 'failed'] },
    method:   { type: String, enum: ['password', 'google'] },
    address:  { type: String, maxlength: 254 },
    device:   { type: String },
    location: { type: String },
    digestedAt: { type: Date, default: null },
    digestRun:  { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// The card's query: one account's rows plus the no-account ones, newest first.
signInEventSchema.index({ user: 1, createdAt: -1 });
// Kept 90 days (GitHub's security log keeps the same), then Mongo deletes it —
// the collection cannot outgrow the free tier's storage on its own.
signInEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

const SignInEvent = mongoose.model('SignInEvent', signInEventSchema);
SignInEvent.RETENTION_DAYS = RETENTION_DAYS;
module.exports = SignInEvent;
