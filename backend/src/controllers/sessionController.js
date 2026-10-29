const { body }   = require('express-validator');
const User       = require('../models/User');
const AppError   = require('../utils/AppError');
const {
  listSessions, revokeFamily, revokeAllForUser,
} = require('../services/sessionService');

// PF-132 — the Settings Sessions card: every device signed in to the admin,
// and a way to sign any of them out.
//
// Standards:
//   - OWASP ASVS 5.0 V7.5.2 — the user can view and terminate any or all
//     active sessions, having AUTHENTICATED AGAIN first. So both sign-out
//     routes take the current password (owner's choice, 2026-10-29): a
//     borrowed or stolen open laptop cannot throw the real owner out.
//   - NIST SP 800-63B-4 §7 (session management) — ending a session ends it
//     at once: revoking the family kills its access token too (`protect`
//     checks `isFamilyLive`), not 15 minutes later.
//
// A refusal is 400, never 401 (the PF-124 rule): the client treats any 401
// as "this session has ended" and signs out — a mistyped password must not.

const WRONG_PASSWORD = 'Your password is wrong.';
const THIS_DEVICE    = 'That is this device — use Sign out instead.';
const NOT_FOUND      = 'That session has already ended.';

const passwordRule = body('password')
  .isString().withMessage('Password must be text').bail()
  .notEmpty().withMessage('Password is required');

const revokeRules       = [
  passwordRule,
  body('id')
    .isString().withMessage('Session id must be text').bail()
    .notEmpty().withMessage('Session id is required'),
];
const revokeOthersRules = [passwordRule];

const checkPassword = async (req) => {
  const account = await User.findById(req.user._id).select('+password');
  return account.matchPassword(req.body.password);
};

// ── GET /api/auth/sessions ────────────────────────────────────────────────────
// `id` is the session FAMILY. It is no secret from this client — its own
// access token carries `fam` — and it cannot be presented as a credential;
// only a refresh token can, and those are never sent back.
const getSessions = async (req, res, next) => {
  try {
    const rows = await listSessions(req.user._id);
    res.json({
      status: 'success',
      data: rows.map((row) => ({
        id:           row.family,
        current:      row.family === req.auth.family,
        device:       row.device ?? null,
        location:     row.location ?? null,
        signInMethod: row.signInMethod ?? null,
        signedInAs:   row.signedInAs ?? null,
        startedAt:    row.startedAt ?? null,
        lastActiveAt: row.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/sessions/revoke ───────────────────────────────────────────
// One other device. THIS device signs out with the normal Sign out, which
// also clears this browser's tokens; ending it here would leave them behind.
const revokeSessionById = async (req, res, next) => {
  try {
    if (!(await checkPassword(req))) return next(new AppError(WRONG_PASSWORD, 400));
    if (req.body.id === req.auth.family) return next(new AppError(THIS_DEVICE, 400));
    if (!(await revokeFamily(req.user._id, req.body.id))) {
      return next(new AppError(NOT_FOUND, 404));
    }
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/sessions/revoke-others ────────────────────────────────────
// Every device but this one. Always 200 when the password is right — "no
// other sessions" is already the state the caller asked for.
const revokeOtherSessions = async (req, res, next) => {
  try {
    if (!(await checkPassword(req))) return next(new AppError(WRONG_PASSWORD, 400));
    await revokeAllForUser(req.user._id, { except: req.auth.family });
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSessions,
  revokeRules, revokeSessionById,
  revokeOthersRules, revokeOtherSessions,
};
