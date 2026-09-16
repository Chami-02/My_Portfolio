const User     = require('../models/User');
const AppError = require('../utils/AppError');
const {
  issueSession,
  rotateSession,
  revokeSession,
} = require('../services/sessionService');

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

    // 1. Check both fields were provided
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2. Find user — we need password field which is select: false on the schema
    const user = await User.findOne({ email }).select('+password');

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

module.exports = { login, refresh, logout, getMe };
