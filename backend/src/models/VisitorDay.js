const mongoose = require('mongoose');

/**
 * "This visitor has already been counted today" (PF-145). `_id` is the day's
 * scrambled code (visitController `scramble`) and nothing else about them is
 * here. Deleted within 2 days — the privacy page promises that, so the expiry
 * is asserted in visits.test.js.
 */
const visitorDaySchema = new mongoose.Schema(
  {
    _id:       { type: String },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

visitorDaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VisitorDay', visitorDaySchema);
