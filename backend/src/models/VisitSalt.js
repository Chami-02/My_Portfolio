const mongoose = require('mongoose');

/**
 * The random secret that scrambles visitors' codes for one day (PF-145).
 * `_id` is the Sri Lanka date. A stored row rather than something derived from
 * a config secret, because this one can be DELETED: once it is gone, nobody —
 * including someone holding a database copy — can recreate an old day's code
 * from an address. Lives as long as the codes it made.
 */
const visitSaltSchema = new mongoose.Schema(
  {
    _id:       { type: String },
    salt:      { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

visitSaltSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VisitSalt', visitSaltSchema);
