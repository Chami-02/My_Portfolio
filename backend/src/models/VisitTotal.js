const mongoose = require('mongoose');

/**
 * One running total: one day × one dimension × one value (PF-145), e.g.
 * `{ day: '2026-11-04', dim: 'country', key: 'LK', count: 12 }`.
 *
 *   counted per view     views, path, hour
 *   per visitor per day  visitors, country, city, device, browser, referrer
 *   per click            click
 *
 * ⚠️ Flat rows, not a document per day holding maps. A map's key becomes a
 * dotted `$inc` path, so a city or a referrer with a dot in it ("St. Louis",
 * "linkedin.com") would write to the wrong place. It also keeps the privacy
 * promise in the data's shape: each row holds ONE dimension, so nothing joins a
 * country to a page to rebuild one person's visit.
 *
 * `day` is a Sri Lanka date (see visitController). These rows have no expiry —
 * the privacy page says so.
 */
const visitTotalSchema = new mongoose.Schema(
  {
    day:   { type: String, required: true },
    dim:   { type: String, required: true },
    key:   { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

visitTotalSchema.index({ day: 1, dim: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('VisitTotal', visitTotalSchema);
