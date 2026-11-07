const mongoose = require('mongoose');

/**
 * "This visitor has already been counted today" (PF-145). `_id` is the day's
 * scrambled code (visitController `scramble`). PF-153: a visitor's row also holds
 * their network's scrambled code, for the daily limit, and a read's row holds
 * neither: its `_id` is scrambled from the code and the post. Deleted within 2 days — the privacy page promises that, so the expiry
 * is asserted in visits.test.js.
 */
const visitorDaySchema = new mongoose.Schema(
  {
    _id:       { type: String },
    expiresAt: { type: Date, required: true },
    source:    { type: String },
  },
  { versionKey: false },
);

visitorDaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
visitorDaySchema.index({ source: 1 }, { sparse: true });

module.exports = mongoose.model('VisitorDay', visitorDaySchema);
