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

/**
 * Limiter for `POST /api/auth/refresh` (PF-108).
 *
 * ⚠️ Deliberately NOT `authLimiter`. A refresh is not a guess at a password;
 * it happens silently every time a 15-minute access token dies during
 * normal use, and a working session would lock itself out against a cap of
 * 10. A refresh token cannot be brute-forced at any rate this server could
 * serve (32 random bytes), so the cap here is about abuse of the endpoint,
 * not credential stuffing. 60 per 15 minutes is four times what one tab
 * refreshing on schedule could ever need.
 *
 * Live under `NODE_ENV=test` like `authLimiter` and for the same reason: the
 * behaviour is asserted directly in the backend suite.
 */
const refreshLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  'fail',
    message: 'Too many session refreshes. Please wait 15 minutes before trying again.',
  },
});

/**
 * Limiter for the three Google sign-in routes (PF-119), shared between them.
 *
 * Its own policy, not `authLimiter`: a Google sign-in is not a password
 * guess — the proof happens at Google — and one attempt costs THREE requests
 * here (start, callback, exchange), so 10 would allow barely three tries.
 * 30 per 15 minutes is ten sign-ins. What it bounds is abuse: every `start`
 * writes a row, and every `callback` makes an outbound call to Google.
 *
 * Live under `NODE_ENV=test` like `authLimiter` and `refreshLimiter`, and
 * asserted directly in the backend suite.
 */
const googleLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  'fail',
    message: 'Too many Google sign-in attempts. Please wait 15 minutes before trying again.',
  },
});

/**
 * Limiter for the public contact form, `POST /api/contact` (PF-120).
 *
 * Before this the form had only `globalLimiter`: one IP could store about 100
 * messages every 15 minutes, and PF-123 turns every stored message into an
 * EMAIL, which a free mail quota would not survive. 5 per hour is more than
 * any real visitor sends.
 *
 * `skipFailedRequests`: only a message that was actually STORED counts. A 400
 * (empty field, bad address) stores nothing and sends nothing, so it should
 * not cost a visitor who is fixing a typo one of their five.
 *
 * Live under `NODE_ENV=test` like the other per-route limiters. The suites
 * stay inside it: contact.test.js stores three messages, E2E stores one.
 */
const contactLimiter = rateLimit({
  windowMs:           60 * 60 * 1000,
  max:                5,
  skipFailedRequests: true,
  standardHeaders:    true,
  legacyHeaders:      false,
  message: {
    status:  'fail',
    message: 'You have sent several messages already. Please try again in an hour.',
  },
});

/**
 * Limiters for the forgot-password routes (PF-125).
 *
 * `forgotLimiter` — `POST /api/auth/password/forgot`. Every accepted request
 * may send an email, so this bounds mail (with the per-account 60 s cooldown
 * in the controller). 5 per 15 minutes is more than a real reset ever needs.
 *
 * `resetLimiter` — `POST /api/auth/password/reset`, where a code is guessed.
 * Each code also dies after 5 wrong guesses (the controller), so this cap is
 * about one IP cycling through fresh codes, not one code.
 *
 * Neither is `authLimiter`: a reset is its own door, and sharing a budget
 * would let a few failed sign-ins block the very reset they lead to.
 * Both live under `NODE_ENV=test`, asserted directly in the backend suite.
 */
const forgotLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  'fail',
    message: 'Too many reset requests. Please wait 15 minutes before trying again.',
  },
});

const resetLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  'fail',
    message: 'Too many reset attempts. Please wait 15 minutes before trying again.',
  },
});

module.exports = { globalLimiter, authLimiter, refreshLimiter, googleLimiter, contactLimiter, forgotLimiter, resetLimiter };
