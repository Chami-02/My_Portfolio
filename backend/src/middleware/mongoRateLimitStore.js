const connectDB = require('../config/db');
const RateLimit = require('../models/RateLimit');

/**
 * An express-rate-limit v8 Store that keeps its counts in MongoDB (PF-141).
 *
 * Why not the default memory store: on Vercel the API is several instances,
 * each with its own memory, and a cold start empties it. A memory count of
 * "10 logins per 15 minutes" was 10 per instance, per restart — an attacker
 * spread over three instances got 30. Every instance reads and writes the
 * same row here, so the cap is the cap (OWASP API4:2023; NIST SP 800-63B-4
 * §3.2.2 "limit failed authentication attempts").
 *
 * Why not `rate-limit-mongo`: it brings its own `mongodb` driver, and ours is
 * held at ~7.5.0 (NODE-7832). This is one model and one atomic upsert.
 *
 * ONE instance per limiter, each with its own prefix: express-rate-limit
 * refuses a shared store (ERR_ERL_STORE_REUSE), and the prefix keeps two
 * limiters that count the same IP on one request in separate rows
 * (ERR_ERL_DOUBLE_COUNT).
 */
class MongoStore {
  constructor(name) {
    this.prefix = `${name}:`;
    // Counts live in the database, not on this object — tells
    // express-rate-limit's validations the store is shared.
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async get(key) {
    await connectDB();
    const row = await RateLimit.findById(this.prefix + key).lean();
    if (!row || row.resetAt <= new Date()) return undefined;
    return { totalHits: row.hits, resetTime: row.resetAt };
  }

  /**
   * ONE round trip, atomic: concurrent requests from different instances can
   * never read the same count and both write count + 1.
   *
   * The window is decided by the DATABASE's clock (`$$NOW`), not this
   * instance's, so instances with skewed clocks agree on when it closes. A
   * missing or closed window starts again at 1. Both `$cond`s read the row as
   * it was before this update — a `$set` stage evaluates against its input.
   */
  async increment(key) {
    // The global limiter runs BEFORE app.js's connectDB() middleware, and
    // connections are made with `bufferCommands: false` — a query on a
    // not-yet-open connection throws instead of waiting.
    await connectDB();

    const open = { $gt: ['$resetAt', '$$NOW'] };
    const update = [{
      $set: {
        hits:    { $cond: [open, { $add: ['$hits', 1] }, 1] },
        resetAt: { $cond: [open, '$resetAt', { $add: ['$$NOW', this.windowMs] }] },
      },
    }];
    const options = { upsert: true, returnDocument: 'after', updatePipeline: true };

    let row;
    try {
      row = await RateLimit.findOneAndUpdate({ _id: this.prefix + key }, update, options).lean();
    } catch (err) {
      // Two FIRST requests for a key can both try to insert; the loser gets a
      // duplicate key. The row exists now, so the same update succeeds.
      if (err.code !== 11000) throw err;
      row = await RateLimit.findOneAndUpdate({ _id: this.prefix + key }, update, options).lean();
    }

    return { totalHits: row.hits, resetTime: row.resetAt };
  }

  // Used by `skipFailedRequests` (contactLimiter): un-count a request once its
  // response turns out to be a failure — only inside the window it was counted in.
  async decrement(key) {
    await connectDB();
    await RateLimit.updateOne(
      { _id: this.prefix + key, $expr: { $gt: ['$resetAt', '$$NOW'] } },
      { $inc: { hits: -1 } },
    );
  }

  async resetKey(key) {
    await connectDB();
    await RateLimit.deleteOne({ _id: this.prefix + key });
  }
}

module.exports = MongoStore;
