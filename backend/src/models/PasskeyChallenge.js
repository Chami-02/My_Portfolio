const mongoose = require('mongoose');

/**
 * The server's half of one passkey attempt (PF-140). WebAuthn §13.4.3: the
 * challenge is made on the server and stored there until the operation
 * finishes. Functions here share no memory, so it lives in MongoDB, and it is
 * SINGLE USE: read with `findOneAndDelete`, like `OAuthFlow`.
 *
 * Whose attempt is it?
 *   - 'login': nobody is signed in yet, so the row is tied to the BROWSER that
 *     asked. `bindingHash` is the SHA-256 of a short-lived httpOnly cookie.
 *   - 'register': tied to the signed-in user AND this session family.
 *
 * The challenge itself is no secret (the browser is given it), so it is stored
 * as it is: the library compares it with what the device signed.
 */
const passkeyChallengeSchema = new mongoose.Schema({
  purpose:     { type: String, required: true, enum: ['login', 'register'] },
  challenge:   { type: String, required: true },
  bindingHash: { type: String, unique: true, sparse: true },
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  family:      { type: String, index: true },
  expiresAt:   { type: Date, required: true },
});

// Same TTL shape as OAuthFlow: Mongo garbage-collects expired rows, but the
// controller checks `expiresAt` itself and never relies on the row being gone.
passkeyChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasskeyChallenge', passkeyChallengeSchema);
