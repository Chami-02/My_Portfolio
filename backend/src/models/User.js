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
    role: {
      type:    String,
      enum:    ['admin'],
      default: 'admin',
    },
  },
  { timestamps: true }
);

// ── Pre-save hook: hash password before storing ────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if the password field was just set/changed
  if (!this.isModified('password')) return next();
  // Cost factor 12 = ~200ms on modern hardware (intentionally slow)
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare plain text with hashed password ──────────────
userSchema.methods.matchPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);