const mongoose = require('mongoose');

/**
 * The short-lived server-side state of one Google sign-in (PF-119).
 *
 * A row lives in exactly one of two phases, and each is SINGLE USE — read
 * with `findOneAndDelete`, so a value can never be redeemed twice:
 *
 *   1. FLOW (10 minutes) — created by `GET /api/auth/google/start`, consumed
 *      by the callback. Holds what the callback must check Google's answer
 *      against: the `state` that came back, the browser-binding cookie, the
 *      `nonce` inside the ID token, and the PKCE verifier the code exchange
 *      needs.
 *   2. HANDOFF (60 seconds) — created by the callback once the admin is
 *      identified, consumed by `POST /api/auth/google/exchange`. With Bearer
 *      transport a redirect cannot carry a session into the SPA (PF-108), so
 *      the browser gets this one-time code instead and trades it for one.
 *
 * Like `Session.tokenHash`, every value a client presents is stored only as
 * its SHA-256 — a database read yields nothing that can be replayed. The PKCE
 * verifier is the exception: it must be sent to Google as-is, and it is
 * worthless without the authorization code Google sends only to the browser.
 */
const oauthFlowSchema = new mongoose.Schema({
  // Phase 1
  stateHash:    { type: String, unique: true, sparse: true },
  bindingHash:  { type: String },
  nonceHash:    { type: String },
  codeVerifier: { type: String },
  // Phase 2
  handoffHash:  { type: String, unique: true, sparse: true },
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Both — where the admin was going when they were sent to sign in.
  returnTo:     { type: String, default: '/admin' },
  expiresAt:    { type: Date, required: true },
});

// Same TTL shape as Session — Mongo garbage-collects expired rows, but the
// controller checks `expiresAt` itself and never relies on the row being gone.
oauthFlowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OAuthFlow', oauthFlowSchema);
