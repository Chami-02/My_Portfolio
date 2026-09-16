const mongoose = require('mongoose');

/**
 * One row per refresh token ever issued (PF-108).
 *
 * The refresh token itself is NEVER stored — only its SHA-256. A database
 * read (backup, Compass, a leaked dump) therefore yields nothing a client can
 * present, the same reasoning as hashing passwords.
 *
 * Rotation: every use of a refresh token revokes this row and creates a
 * successor in the same `family`. A revoked row is kept, not deleted, because
 * it is the evidence reuse-detection needs — see sessionService.rotateSession.
 * Mongo's TTL index on `expiresAt` garbage-collects the row once the token it
 * describes could not be accepted anyway.
 */
const sessionSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    tokenHash: {
      type:     String,
      required: true,
      unique:   true,
    },
    // Shared by every rotation descended from one login. Reuse of a revoked
    // token revokes the whole family — attacker and owner alike.
    family: {
      type:     String,
      required: true,
      index:    true,
    },
    expiresAt: {
      type:     Date,
      required: true,
    },
    revokedAt: {
      type:    Date,
      default: null,
    },
    replacedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Session',
      default: null,
    },
  },
  { timestamps: true }
);

// `expireAfterSeconds: 0` — delete the moment `expiresAt` passes, not some
// fixed interval after it. Mongo's TTL monitor runs every ~60s, so a row can
// outlive its expiry by up to a minute; rotateSession checks the date itself
// and never relies on the row being gone.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
