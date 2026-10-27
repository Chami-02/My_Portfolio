const mongoose = require('mongoose');

/**
 * One row per rate-limit counter: one limiter × one client key (PF-141).
 *
 * Every limiter in middleware/rateLimiter.js keeps its counts HERE, through
 * middleware/mongoRateLimitStore.js, instead of in the memory of the instance
 * that served the request. On Vercel the API runs as several instances, each
 * with its own memory, and a cold start forgets everything — so a memory count
 * of "10 per 15 minutes" was really "10 per instance, per restart". One shared
 * collection makes the advertised cap the enforced one.
 *
 * `_id` is `<limiter prefix>:<client key>` (e.g. `auth:203.0.113.7`) so the
 * hot path is a single primary-key upsert, and two limiters counting the same
 * IP never share a row.
 */
const rateLimitSchema = new mongoose.Schema(
  {
    _id:     { type: String },
    hits:    { type: Number, required: true },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// Same TTL shape as Session and OAuthFlow — Mongo garbage-collects closed
// windows, but the store compares `resetAt` itself and never relies on the row
// being gone (the TTL sweep runs about once a minute).
rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RateLimit', rateLimitSchema);
