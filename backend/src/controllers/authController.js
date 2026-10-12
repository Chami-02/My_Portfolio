const crypto    = require('crypto');
const { parse: parseCookies } = require('cookie');
const User      = require('../models/User');
const OAuthFlow = require('../models/OAuthFlow');
const AppError  = require('../utils/AppError');
const {
  issueSession,
  rotateSession,
  revokeSession,
  hashToken,
} = require('../services/sessionService');
const google    = require('../services/googleAuth');

// One shape for every response that hands the client a session — login and
// refresh — so the frontend has a single place that stores it.
const sessionPayload = (session, user) => ({
  status:           'success',
  accessToken:      session.accessToken,
  refreshToken:     session.refreshToken,
  accessExpiresAt:  session.accessExpiresAt,
  refreshExpiresAt: session.refreshExpiresAt,
  data: {
    id:    user._id,
    email: user.email,
    role:  user.role,
  },
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Check both fields were provided — as STRINGS. `!email` lets an array
    // through, and an array is a Mongo operand, not an address.
    if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2. Find user by ANY of its login addresses (PF-119: one admin, two
    // addresses, one password) — we need password, which is select: false
    const user = await User.findByLoginEmail(email).select('+password');

    // 3. Check user exists AND password matches
    // We check both in one condition to prevent user enumeration attacks
    // (never tell the attacker which one was wrong)
    if (!user || !(await user.matchPassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 4. Start a session — PF-108: the ONE place a session is born, shared
    // with Google sign-in (PF-119). No bare `token` in the body any more.
    const session = await issueSession(user);
    res.json(sessionPayload(session, user));
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// Rotates the presented refresh token. Not behind `protect`: the access token
// is expected to be dead by the time this is called.
const refresh = async (req, res, next) => {
  try {
    const { user, ...session } = await rotateSession(req.body?.refreshToken);
    res.json(sessionPayload(session, user));
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Revokes the session family. Always 200 — a client that has lost its token
// has nothing to do with an error here except retry the same thing.
const logout = async (req, res, next) => {
  try {
    await revokeSession(req.body?.refreshToken);
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the currently logged-in user (from the JWT, set on req.user by
// protect middleware) plus when the access token behind this request dies —
// the client cannot read that from an opaque header on its own.
const getMe = (req, res) => {
  res.json({
    status: 'success',
    sessionExpiresAt: new Date(req.auth.exp * 1000).toISOString(),
    data: {
      id:    req.user._id,
      email: req.user.email,
      role:  req.user.role,
    },
  });
};

// ══ Google sign-in (PF-119) ══════════════════════════════════════════════════
//
//   start ─► Google ─► callback ─► SPA /admin/login#handoff=… ─► exchange
//
// The redirect legs are top-level navigations, so they answer with redirects
// back to the login page, never JSON: `#google_error=<reason>` on failure.
// The reason is deliberately coarse — `not_allowed` never says WHICH check
// refused, the same rule as "Invalid email or password".

const FLOW_TTL_MS    = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 60 * 1000;
const FLOW_COOKIE    = 'pf_oauth';
const COOKIE_PATH    = '/api/auth/google';

const randomToken = () => crypto.randomBytes(32).toString('base64url');

/** Read at call time; no trailing slash, so `${frontend}/admin/login` is exact. */
const frontendUrl = () => (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

/**
 * Only a path inside the admin panel. Anything else — another host, a
 * protocol-relative `//evil.com`, the public site, `/administrator` — falls
 * back to the dashboard. The value ends up in the SPA's `navigate()`, so a
 * string that STARTS with `/admin` followed by `/`, `?`, `#` or nothing can
 * only ever be a path on this site; the anchored pattern is the whole check.
 */
const safeReturnTo = (value) =>
  typeof value === 'string' && /^\/admin(?:[/?#]|$)/.test(value) ? value : '/admin';

const toLogin = (res, fragment) =>
  res.redirect(302, `${frontendUrl()}/admin/login#${fragment}`);

const failTo = (res, reason) => toLogin(res, `google_error=${reason}`);

// ── GET /api/auth/google/start ───────────────────────────────────────────────
const googleStart = async (req, res, next) => {
  try {
    // Fails CLOSED. With no frontend to return to there is nowhere to redirect,
    // so that one case is a plain 503.
    if (!frontendUrl()) {
      return next(new AppError('Google sign-in is not configured.', 503));
    }
    if (!google.isConfigured()) return failTo(res, 'unavailable');

    const state   = randomToken();
    const nonce   = randomToken();
    const binding = randomToken();
    const { codeVerifier, codeChallenge } = await google.createPkce();

    await OAuthFlow.create({
      stateHash:   hashToken(state),
      bindingHash: hashToken(binding),
      nonceHash:   hashToken(nonce),
      codeVerifier,
      returnTo:    safeReturnTo(req.query.returnTo),
      expiresAt:   new Date(Date.now() + FLOW_TTL_MS),
    });

    // Binds the flow to THIS browser: the callback must come back with the
    // same cookie. First-party (the browser is ON the API's host for both
    // legs), so this is not the cross-site cookie PF-108 measured dead — and
    // `Lax` is exactly what a top-level GET back from Google carries.
    res.cookie(FLOW_COOKIE, binding, {
      httpOnly: true,
      secure:   req.secure,
      sameSite: 'lax',
      path:     COOKIE_PATH,
      maxAge:   FLOW_TTL_MS,
    });
    res.redirect(302, google.buildAuthUrl({ state, nonce, codeChallenge }));
  } catch (err) {
    next(err);
  }
};

/**
 * Who is this Google account allowed to be? Returns the User, or null.
 *
 * NEVER creates one: `User.role` is read by no route, so any account that
 * exists is a full admin — the User collection IS the allowlist.
 *
 * The address must be one of the admin's login addresses, and each address
 * is bound to the first Google account (`sub`) that proves it. A different
 * Google account presenting a bound address is refused.
 */
const resolveGoogleUser = async ({ sub, email }) => {
  const user = await User.findByLoginEmail(email).select('+googleIdentities');
  if (!user) {
    // The one refusal worth a server log: on a correct deployment it is a
    // stranger, but on a production that never ran migration 009 it is the
    // OWNER, and the browser is told only `not_allowed`.
    console.warn('google sign-in: verified email matches no admin login address — has migration 009 run?');
    return null;
  }

  // A `sub` already bound to some OTHER account cannot become this one.
  const bySub = await User.exists({ _id: { $ne: user._id }, 'googleIdentities.sub': sub });
  if (bySub) return null;

  const bound = user.googleIdentities.find((i) => i.email === email);
  if (bound) return bound.sub === sub ? user : null;

  // First sign-in from this address: bind it. The `$ne` makes the bind
  // atomic — of two racing first sign-ins, one binds and the other is
  // checked against what it bound.
  const result = await User.updateOne(
    { _id: user._id, 'googleIdentities.email': { $ne: email } },
    { $push: { googleIdentities: { sub, email } } }
  );
  if (result.modifiedCount === 1) return user;

  const fresh = await User.findById(user._id).select('+googleIdentities');
  return fresh.googleIdentities.some((i) => i.email === email && i.sub === sub) ? fresh : null;
};

// ── GET /api/auth/google/callback ────────────────────────────────────────────
const googleCallback = async (req, res, next) => {
  try {
    if (!frontendUrl()) {
      return next(new AppError('Google sign-in is not configured.', 503));
    }
    const { state, code, error } = req.query;
    const binding = parseCookies(req.headers.cookie || '')[FLOW_COOKIE];
    res.clearCookie(FLOW_COOKIE, { path: COOKIE_PATH });

    // `typeof` and not truthiness: `?state=a&state=b` arrives as an array.
    const flow = typeof state === 'string'
      ? await OAuthFlow.findOneAndDelete({ stateHash: hashToken(state) })
      : null;

    // The user pressed Cancel at Google. Their flow (deleted above) is spent.
    if (typeof error === 'string') return failTo(res, 'cancelled');

    if (!flow || flow.expiresAt <= new Date()) return failTo(res, 'expired');
    if (typeof binding !== 'string' || hashToken(binding) !== flow.bindingHash) {
      return failTo(res, 'failed');
    }
    if (typeof code !== 'string' || !code) return failTo(res, 'failed');

    let identity;
    try {
      identity = await google.verifyCode({
        code,
        codeVerifier: flow.codeVerifier,
        nonceMatches: (nonce) => hashToken(nonce) === flow.nonceHash,
      });
    } catch (err) {
      if (err instanceof google.GoogleSignInError) {
        return failTo(res, err.reason === 'unverified' ? 'not_allowed' : err.reason);
      }
      throw err;
    }

    const user = await resolveGoogleUser(identity);
    if (!user) return failTo(res, 'not_allowed');

    const handoff = randomToken();
    await OAuthFlow.create({
      handoffHash: hashToken(handoff),
      user:        user._id,
      returnTo:    flow.returnTo,
      expiresAt:   new Date(Date.now() + HANDOFF_TTL_MS),
    });
    // In the FRAGMENT: never sent to a server, so never in an access log or
    // a Referer header.
    toLogin(res, `handoff=${handoff}`);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/google/exchange ───────────────────────────────────────────
// The one-time handoff for a real session — the SAME session password login
// starts, through the same `issueSession`.
const googleExchange = async (req, res, next) => {
  try {
    const code = req.body?.code;
    if (typeof code !== 'string' || !code) {
      return next(new AppError('Sign-in code required.', 400));
    }

    const handoff = await OAuthFlow.findOneAndDelete({ handoffHash: hashToken(code) });
    if (!handoff || handoff.expiresAt <= new Date()) {
      return next(new AppError('This sign-in has expired. Please sign in again.', 401));
    }

    const user = await User.findById(handoff.user);
    if (!user) {
      return next(new AppError('This sign-in has expired. Please sign in again.', 401));
    }

    const session = await issueSession(user);
    res.json({ ...sessionPayload(session, user), returnTo: safeReturnTo(handoff.returnTo) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login, refresh, logout, getMe,
  googleStart, googleCallback, googleExchange,
  safeReturnTo,
};
