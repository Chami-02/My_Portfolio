const mongoose      = require('mongoose');
const PasswordReset = require('./PasswordReset');

/**
 * One pending "change password" code (PF-124) — the signed-in change in
 * Settings. The SAME schema as PasswordReset (one row per user, HMAC only,
 * TTL), in its own collection so a public forgot-password request can never
 * replace or block a change code. Why: services/passwordCodes.js.
 */
module.exports = mongoose.model('PasswordChange', PasswordReset.schema.clone());
