const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false,  // Never return password in queries by default
    },
    // PF-119 — further addresses that sign in to THIS account. One admin, one
    // password, several doors (owner, 2026-10-12): `email` is the address the
    // panel shows; each entry here is accepted by password AND Google sign-in.
    loginEmails: {
      type:    [{ type: String, lowercase: true, trim: true }],
      default: [],
    },
    // PF-119 — the Google accounts that have signed in, one per address.
    // `sub` is Google's permanent account id; an address is bound to the first
    // `sub` that proves it and refused to any other, so an address that ever
    // changed hands at Google cannot take this account over.
    googleIdentities: {
      type:    [{ _id: false, sub: String, email: String }],
      default: [],
      select:  false,
    },
    role: {
      type:    String,
      enum:    ['admin'],
      default: 'admin',
    },
    // PF-124 — the hashes of the passwords BEFORE the current one, newest
    // first, at most HISTORY_KEPT. With the current password that blocks the
    // last 5 (PCI DSS v4.0 §8.3.7 asks for the last 4). Only bcrypt hashes,
    // never a fast hash: an old password is often still in use elsewhere.
    // Written ONLY by setPassword(), which refuses a document loaded without it.
    passwordHistory: {
      type:    [{ _id: false, hash: String, changedAt: Date }],
      default: [],
      select:  false,
    },
    passwordChangedAt: { type: Date },
    // PF-133 — set when the CURRENT password turned up in a known data leak
    // at sign-in (services/signInLog.js). The admin shows a banner until the
    // password changes; setPassword() clears it.
    passwordLeakedAt: { type: Date },
  },
  { timestamps: true }
);

// PF-119 — the primary address is never also an alias; a duplicate would make
// "which addresses sign in" ambiguous in the one place that must not be.
userSchema.pre('validate', function () {
  if (this.loginEmails?.includes(this.email)) {
    this.invalidate('loginEmails', 'A login email cannot repeat the primary email');
  }
});

/**
 * Every address that signs in to an account. One query for both doors —
 * password login and Google — so they can never disagree about who the
 * admin is. Anything that is not a non-empty string matches nothing (an
 * array would otherwise slip through as a Mongo operand).
 *
 * ⚠️ No `.toLowerCase()` / `.trim()` here, deliberately: Mongoose runs the
 * paths' own `lowercase` and `trim` setters on QUERY values too, for `email`
 * and for each `loginEmails` element. A hand-written normalisation was dead
 * code — mutation-tested, it changed nothing (PF-119).
 */
userSchema.statics.findByLoginEmail = function (email) {
  if (typeof email !== 'string' || email.trim() === '') return this.findOne({ _id: null });
  return this.findOne({ $or: [{ email }, { loginEmails: email }] });
};

/** The previous passwords kept besides the current one: the last 5 in all. */
const HISTORY_KEPT = 4;

// Cost factor 12 = ~200ms on modern hardware (intentionally slow)
const BCRYPT_COST = 12;

/** A bcrypt hash of `plain` — the ONE place a password is hashed. */
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);

// ── Pre-save hook: hash password before storing ────────────────────────────
userSchema.pre('save', async function () {
  // Only hash if the password field was just set/changed
  if (!this.isModified('password')) return;
  // PF-124: the signed-in change hashes the new password at step one and
  // keeps the hash beside its code — step two sets it as it is.
  if (this.$locals.passwordIsHash) {
    this.$locals.passwordIsHash = false;
    return;
  }
  this.password = await User.hashPassword(this.password);
});

/**
 * PF-124 — the ONE way to change an existing user's password: the current
 * hash moves into `passwordHistory` (newest first, HISTORY_KEPT kept) and
 * `passwordChangedAt` is stamped. `{ hashed: true }` when `password` is
 * already a bcrypt hash (from `hashPassword`).
 *
 * ⚠️ Throws unless the document was loaded WITH `+password +passwordHistory`:
 * without them the history would be silently replaced by an empty one.
 */
userSchema.methods.setPassword = function (password, { hashed = false } = {}) {
  if (!this.isSelected('password') || !this.isSelected('passwordHistory')) {
    throw new Error('setPassword needs the user loaded with +password +passwordHistory');
  }
  if (this.password) {
    this.passwordHistory = [
      { hash: this.password, changedAt: this.passwordChangedAt ?? this.updatedAt ?? new Date() },
      ...this.passwordHistory,
    ].slice(0, HISTORY_KEPT);
  }
  this.password = password;
  this.passwordChangedAt = new Date();
  this.passwordLeakedAt = undefined;
  this.$locals.passwordIsHash = hashed;
};

/**
 * PF-124 — is `plain` the current password or one of the HISTORY_KEPT before
 * it? `current`, when the caller has just PROVED the current password, is
 * compared as text — one bcrypt run saved. Stops at the first match.
 * Needs `+password +passwordHistory`, like setPassword.
 */
userSchema.methods.usedRecently = async function (plain, { current } = {}) {
  if (current !== undefined ? plain === current : await this.matchPassword(plain)) return true;
  for (const { hash } of this.passwordHistory) {
    if (await bcrypt.compare(plain, hash)) return true;
  }
  return false;
};

// ── Instance method: compare plain text with hashed password ──────────────
userSchema.methods.matchPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

const User = mongoose.model('User', userSchema);
User.HISTORY_KEPT = HISTORY_KEPT;
module.exports = User;
