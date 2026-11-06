const mongoose = require('mongoose');

/**
 * "This visitor opened a page in the last few minutes" (PF-149), behind the
 * Analytics panel's ON THE SITE NOW. `_id` is the day's scrambled code, the same
 * one as VisitorDay, and nothing else about them is here. The privacy page
 * promises about 5 minutes.
 *
 * ⚠️ Count with `expiresAt > now`, never the plain row count: Mongo's TTL sweep
 * runs about once a minute, so an expired row can still be here.
 */
const liveVisitorSchema = new mongoose.Schema(
  {
    _id:       { type: String },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

liveVisitorSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LiveVisitor', liveVisitorSchema);
