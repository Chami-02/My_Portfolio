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

// ── Pre-save hook: hash password before storing ────────────────────────────
userSchema.pre('save', async function () {
  // Only hash if the password field was just set/changed
  if (!this.isModified('password')) return;
  // Cost factor 12 = ~200ms on modern hardware (intentionally slow)
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Instance method: compare plain text with hashed password ──────────────
userSchema.methods.matchPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
