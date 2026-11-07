const VisitTotal = require('../models/VisitTotal');

const DIMS_KEYED_BY_PATH = ['path', 'read'];

/**
 * PF-153 — a page's address changed, so its totals go with it. Added to any row
 * the new address already has (a post renamed back), one row per day.
 *
 * Never throws: the rename is saved by now, and a total left under the old
 * address must not turn that save into an error. The log names what to fix.
 */
const moveTotals = async (oldPath, newPath) => {
  if (oldPath === newPath) return;
  try {
    const rows = await VisitTotal
      .find({ dim: { $in: DIMS_KEYED_BY_PATH }, key: oldPath })
      .select('day dim count')
      .lean();
    if (rows.length === 0) return;
    await VisitTotal.bulkWrite(rows.flatMap(({ _id, day, dim, count }) => [
      { updateOne: { filter: { day, dim, key: newPath }, update: { $inc: { count } }, upsert: true } },
      { deleteOne: { filter: { _id } } },
    ]));
  } catch (err) {
    console.error(`[PF-153] Totals not moved from ${oldPath} to ${newPath}: ${err.message}`);
  }
};

module.exports = { moveTotals };
