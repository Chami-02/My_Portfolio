const rateLimit = require('express-rate-limit');

/**
 * Applied to ALL routes in app.js.
 * Allows 100 requests per IP per 15-minute window.
 *
 * ⚠️ SKIPPED ENTIRELY UNDER `NODE_ENV=test`, and that is load-bearing for
 * CI rather than a convenience.
 *
 * The Playwright suite drives the real frontend against a real backend from
 * ONE IP. A homepage load fires four queries — blog, projects, skills and
 * about (Contact) — and TanStack Query's `retry: 1` makes a rejected request
 * cost two, so 100 requests is a budget of roughly 25 homepage loads for a
 * 72-test suite. Exhaustion was structural, not marginal: runs logged 27-32
 * `429`s each.
 *
 * What made it survive a whole sprint is that a 429 is INVISIBLE to most of
 * the suite — every section renders its error state and nothing asserted the
 * data, so the run stayed green while large parts of the page were blank.
 * It only became a red job when PF-106's spec needed a link that exists only
 * on a successful fetch.
 *
 * ⚠️ And the local run does NOT reproduce it. `express-rate-limit`'s window
 * opens on the first request and resets 15 minutes later. CI starts the
 * backend fresh, so the whole 4-minute suite sits inside one window that
 * never rolls; locally the server has usually been up a while and a boundary
 * often falls mid-run, silently refilling the budget. Identical suite, green
 * or red depending on server uptime — which is why the 429 count drifted
 * between runs and why "it passes locally" proved nothing.
 *
 * The predicate is `NODE_ENV` rather than a new env var deliberately:
 * `backend/.env.e2e` and the CI e2e job BOTH already set `NODE_ENV=test`, so
 * one line covers local and CI with nothing to keep in sync. A
 * `RATE_LIMIT_MAX` would have needed setting in two places, and the one that
 * gets forgotten fails silently — exactly the shape of the bug being fixed.
 *
 * Production and development are untouched; the limit visitors get is
 * unchanged.
 *
 * ⚠️ Consequence, accepted: Jest also runs with `NODE_ENV=test`, so the
 * global limiter is now unreachable from the backend suite. That costs
 * nothing today — no test asserted 429 behaviour before this change either.
 * A future test that wants to exercise it must call `rateLimit` directly
 * rather than going through `app`.
 */
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,  // 15 minutes in milliseconds
  max:            100,              // Max requests per IP per window
  standardHeaders: true,           // Send RateLimit-* headers to client
  legacyHeaders:  false,
  skip:           () => process.env.NODE_ENV === 'test',
  message: {
    status:  'fail',
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
});

/**
 * Stricter limiter for the login endpoint.
 * Allows only 10 login attempts per IP per 15 minutes.
 * Used in authRoutes.js (Sprint 6, PF-34).
 *
 * ⚠️ NOT skipped in test, deliberately. `e2e/admin.spec.js` logs in a
 * handful of times against a cap of 10 and has never tripped it, so there is
 * no problem to solve — and a brute-force ceiling is worth keeping live in
 * the one suite that drives the real login form.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: {
    status:  'fail',
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
});

module.exports = { globalLimiter, authLimiter };
