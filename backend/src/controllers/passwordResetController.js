const { body } = require('express-validator');
const { waitUntil } = require('@vercel/functions');
const User          = require('../models/User');
const PasswordReset  = require('../models/PasswordReset');
const PasswordChange = require('../models/PasswordChange');
const Session        = require('../models/Session');
const AppError      = require('../utils/AppError');
const mailer        = require('../services/mailer');
const { renderAlert }       = require('../services/alertEmail');
const { newPasswordProblem } = require('../services/newPassword');
const { revokeAllForUser }  = require('../services/sessionService');
const { passwordProblem }   = require('../utils/passwordPolicy');
const {
  coolingDown, issueCode, checkCode, claimCode, dropAllCodes, MAX_ATTEMPTS,
} = require('../services/passwordCodes');
const { requestLocation }   = require('../utils/requestLocation');

// ══ Forgot password (PF-125) ═════════════════════════════════════════════════
//
//   forgot { email } ─► 200, always the same ─► (background) code emailed
//   reset  { email, code, password } ─► new password, every session revoked
//
// Shaped by the OWASP Forgot Password Cheat Sheet:
//   - the SAME answer, in the same time, for any address — nobody can use
//     this form to learn which addresses sign in here;
//   - a random six-digit code, single use, 10 minutes, only its HMAC stored,
//     few guesses (services/passwordCodes.js) on top of the per-IP limiters;
//   - NO lockout of the account: both admin addresses are public, so a
//     lockout would let anyone lock the owner out;
//   - a reset signs out every session and signs nobody in — the owner signs
//     in with the new password — and a "password changed" email follows.

const FORGOT_MESSAGE =
  'If that address can sign in here, a reset code is on its way. It expires in 10 minutes.';
// One sentence for every way a code can fail — wrong, expired, used, never
// sent, or a different address. Each distinction would be an oracle.
const BAD_CODE = 'That code is wrong or has expired. Check it, or request a new one.';

// `isString().bail()` first on every field: an array would otherwise pass
// the later checks and reach a query as an operand. No `normalizeEmail()` —
// it rewrites Gmail addresses (drops dots), and the address must match the
// stored one exactly as typed (the schema's setters lower-case and trim).
const emailRule = body('email')
  .isString().withMessage('Email must be text').bail()
  .trim()
  .notEmpty().withMessage('Email is required')
  .isLength({ max: 254 }).withMessage('Email is too long');

const forgotRules = [emailRule];

const resetRules = [
  emailRule,
  body('code')
    .isString().withMessage('Code must be text').bail()
    .trim()
    .matches(/^\d{6}$/).withMessage('The code is the 6 digits from the email'),
  body('password')
    .isString().withMessage('Password must be text'),
];

/** The details rows every alert shares: which address, and roughly where. */
const detailsFor = (address, where) => [
  ['Address', address],
  ...(where ? [['From', `${where} (approx.)`]] : []),
];

/**
 * The background half of `forgot`. Never throws: the 200 has already gone.
 * Everything that differs between a known and an unknown address happens
 * HERE, after the response — so the response cannot tell them apart.
 */
const sendResetCode = async (email, where) => {
  try {
    const user = await User.findByLoginEmail(email);
    if (!user) return;

    // The address exactly as stored — never the typed spelling.
    const typed  = email.trim().toLowerCase();
    const sentTo = [user.email, ...user.loginEmails].find((a) => a === typed);

    if (await coolingDown(PasswordReset, user._id)) return;

    if (!mailer.isConfigured()) {
      console.warn('[PF-125] Mail is not configured — no reset code sent');
      return;
    }

    const code = await issueCode(PasswordReset, user._id, sentTo);

    await mailer.send({
      to:      sentTo,
      subject: `Your admin password reset code: ${code}`,
      ...renderAlert({
        tone:      'info',
        title:     'Your password reset code',
        intro:     'Enter this code on the reset page to choose a new admin password. It expires in 10 minutes and works once.',
        highlight: code,
        details:   detailsFor(sentTo, where),
        note:      "If this wasn't you, ignore this email — your password has not changed.",
      }),
    });
  } catch (err) {
    // code + message only: the error object carries the transport (PF-123).
    console.error(`[PF-125] Reset code email failed: ${err.code || ''} ${err.message}`);
  }
};

/**
 * To the address that reset AND the MAIN address (owner, 2026-10-27): a reset
 * through the second address always reaches the main inbox too, so if someone
 * got into the second inbox, the main one still hears of it. A reset through
 * the main address goes to the main address only — no copy to the second.
 */
const notifyChanged = async (user, sentTo, where) => {
  if (!mailer.isConfigured()) return;
  try {
    await mailer.send({
      to:      [...new Set([user.email, sentTo])],
      subject: `Your admin password was changed using ${sentTo}`,
      ...renderAlert({
        tone:    'warning',
        title:   'Your admin password was changed',
        intro:   `The password was reset with a code sent to ${sentTo}. It is the ONE password for every admin address, and every device that was signed in has been signed out.`,
        details: detailsFor(sentTo, where),
        note:    "If this wasn't you, reset your password again at once — and check who can read that inbox.",
      }),
    });
  } catch (err) {
    console.error(`[PF-125] Password-changed email failed: ${err.code || ''} ${err.message}`);
  }
};

// ── POST /api/auth/password/forgot ────────────────────────────────────────────
const forgotPassword = (req, res) => {
  // In the background: Vercel keeps the function alive until it settles,
  // and off Vercel it just runs. The visitor's answer never waits for it.
  waitUntil(sendResetCode(req.body.email, requestLocation(req)));
  res.json({ status: 'success', message: FORGOT_MESSAGE });
};

// ── POST /api/auth/password/reset ─────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;

    // The length rule first — a refusal here spends no guess.
    const problem = passwordProblem(password);
    if (problem) return next(new AppError(problem, 400));

    const user = await User.findByLoginEmail(email);
    if (!user) return next(new AppError(BAD_CODE, 400));
    const typed = email.trim().toLowerCase();

    const row = await checkCode(PasswordReset, user._id, typed, code);
    if (!row) return next(new AppError(BAD_CODE, 400));

    // Strength, reuse and leak only AFTER the code is right (PF-124):
    //   - a stranger guessing codes never makes this server call out;
    //   - strength reads the ACCOUNT's own words and reuse its history, so an
    //     earlier refusal would tell a stranger that the address is real.
    // A refusal leaves the code alive (one guess spent): pick another.
    const account = await User.findById(user._id).select('+password +passwordHistory');
    const weak = await newPasswordProblem(account, password);
    if (weak) return next(new AppError(weak, 400));

    if (!(await claimCode(PasswordReset, row))) return next(new AppError(BAD_CODE, 400));

    // save(), NEVER an update query: only save() runs the hashing hook.
    account.setPassword(password);
    await account.save();
    await dropAllCodes(user._id);
    await revokeAllForUser(user._id);

    waitUntil(notifyChanged(account, row.sentTo, requestLocation(req)));
    res.json({ status: 'success', message: 'Password changed. Sign in with your new password.' });
  } catch (err) {
    next(err);
  }
};

// ══ Change password, signed in (PF-124) ══════════════════════════════════════
//
//   change/code { currentPassword, password } ─► every check, then the code is
//                                                emailed to signedInAs (in the
//                                                background) and the NEW
//                                                password's hash waits with it
//   change      { code } ─► that hash becomes the password; every OTHER
//                           session is revoked
//
// Proved twice (owner, 2026-10-13): the current password (OWASP: re-sign-in
// before a password change, so an unlocked laptop is not enough) AND a code
// to the inbox this login used. Both routes sit behind `protect`, so unlike
// forgot there is nothing to hide: each refusal says exactly what is wrong.
//
// ⚠️ A refusal is 400, never 401 — api.js treats a 401 as "the session is
// over" and would sign the owner out for a typo.
//
// SPEED (owner, 2026-10-27: "SEND CODE takes a considerable time"). Measured:
// each bcrypt run ~200 ms, the leak check ~160 ms, Gmail's connect + TLS alone
// ~1.1 s — all one after another, and Vercel's free tier has ONE CPU, so
// running bcrypt in parallel buys nothing there. The fix is doing less:
//   - the email goes in the BACKGROUND, as forgot's does;
//   - "new ≠ current" compares TEXT — the current password was just proved;
//   - the leak check runs during the bcrypt work (newPasswordProblem);
//   - the new password is hashed ONCE, in the background before the email,
//     and the hash waits beside the code (the pending-change pattern), so
//     step two needs only the code and runs no bcrypt at all. The code is
//     bound to the session that asked.

const WRONG_CURRENT = 'Your current password is wrong.';
const MAIL_OFF      = "Email isn't set up on the server, so no code can be sent. Use npm run admin:password instead.";
const COOLING_DOWN  = 'A code was sent less than a minute ago. Wait a moment, then ask again.';

const changeCodeRules = [
  body('currentPassword')
    .isString().withMessage('Current password must be text').bail()
    .notEmpty().withMessage('Current password is required'),
  body('password')
    .isString().withMessage('Password must be text'),
];
const changeRules = [
  body('code')
    .isString().withMessage('Code must be text').bail()
    .trim()
    .matches(/^\d{6}$/).withMessage('The code is the 6 digits from the email'),
];

/**
 * The address THIS login used — the code's only destination. Same rule as
 * `/auth/me`: a label is trusted only while it is still one of the account's
 * addresses, else the primary.
 */
const signedInAddress = async (req) => {
  const session = await Session.findOne({ family: req.auth.family, revokedAt: null })
    .select('signedInAs');
  const used = session?.signedInAs;
  return [req.user.email, ...req.user.loginEmails].includes(used) ? used : req.user.email;
};

/**
 * The background half of change/code. Never throws: the 200 has gone.
 *   1. hash the new password and park it on the code's row (~200 ms of bcrypt
 *      the owner no longer waits for);
 *   2. only THEN email the code — so step two can never arrive before the
 *      hash it sets.
 * Any failure deletes the row: no cooldown on a code that never arrived, and
 * RESEND works at once.
 */
const sendChangeCode = async (userId, password, sentTo, code, where) => {
  try {
    const pendingHash = await User.hashPassword(password);
    await PasswordChange.updateOne({ user: userId }, { $set: { pendingHash } });
    await mailer.send({
      to:      sentTo,
      subject: `Your admin password change code: ${code}`,
      ...renderAlert({
        tone:      'info',
        title:     'Your password change code',
        intro:     'Enter this code in Settings to finish changing your admin password. It expires in 10 minutes and works once.',
        highlight: code,
        details:   detailsFor(sentTo, where),
        note:      "If this wasn't you, someone is signed in to your admin and knows your password — reset it at once with \"Forgot password?\" on the sign-in page.",
      }),
    });
  } catch (err) {
    // code + message only: the error object carries the transport (PF-123).
    console.error(`[PF-124] Change code could not be sent: ${err.code || ''} ${err.message}`);
    await PasswordChange.deleteMany({ user: userId }).catch(() => {});
  }
};

// ── POST /api/auth/password/change/code ───────────────────────────────────────
const requestChangeCode = async (req, res, next) => {
  try {
    const { currentPassword, password } = req.body;
    const account = await User.findById(req.user._id).select('+password +passwordHistory');
    if (!(await account.matchPassword(currentPassword))) return next(new AppError(WRONG_CURRENT, 400));

    const problem = passwordProblem(password)
      ?? await newPasswordProblem(account, password, { current: currentPassword });
    if (problem) return next(new AppError(problem, 400));

    if (!mailer.isConfigured()) return next(new AppError(MAIL_OFF, 503));
    if (await coolingDown(PasswordChange, req.user._id)) return next(new AppError(COOLING_DOWN, 429));

    const sentTo = await signedInAddress(req);
    const code   = await issueCode(PasswordChange, req.user._id, sentTo, { family: req.auth.family });

    waitUntil(sendChangeCode(req.user._id, password, sentTo, code, requestLocation(req)));
    res.json({ status: 'success', sentTo, message: `A code is on its way to ${sentTo}. It expires in 10 minutes.` });
  } catch (err) {
    next(err);
  }
};

/** To the MAIN address and the one signed in with — the same pair as a reset. */
const notifyChangedInSettings = async (user, signedInAs, where) => {
  if (!mailer.isConfigured()) return;
  try {
    await mailer.send({
      to:      [...new Set([user.email, signedInAs])],
      subject: 'Your admin password was changed in Settings',
      ...renderAlert({
        tone:    'warning',
        title:   'Your admin password was changed',
        intro:   `The password was changed in Settings while signed in as ${signedInAs}. It is the ONE password for every admin address, and every other device that was signed in has been signed out.`,
        details: detailsFor(signedInAs, where),
        note:    "If this wasn't you, reset your password at once with \"Forgot password?\" on the sign-in page.",
      }),
    });
  } catch (err) {
    console.error(`[PF-124] Password-changed email failed: ${err.code || ''} ${err.message}`);
  }
};

// ── POST /api/auth/password/change ────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const sentTo = await signedInAddress(req);
    const row = await checkCode(PasswordChange, req.user._id, sentTo, req.body.code);
    // Only the session that asked may finish: another signed-in device of the
    // same account cannot spend this code.
    if (!row || row.family !== req.auth.family || !row.pendingHash) {
      return next(new AppError(BAD_CODE, 400));
    }
    if (!(await claimCode(PasswordChange, row))) return next(new AppError(BAD_CODE, 400));

    // save(), NEVER an update query — setPassword keeps the history.
    const account = await User.findById(req.user._id).select('+password +passwordHistory');
    account.setPassword(row.pendingHash, { hashed: true });
    await account.save();
    await dropAllCodes(req.user._id);
    // Every OTHER device signs out; this one keeps its session (OWASP).
    await revokeAllForUser(req.user._id, { except: req.auth.family });

    waitUntil(notifyChangedInSettings(account, sentTo, requestLocation(req)));
    res.json({ status: 'success', message: 'Password changed. Every other device was signed out.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  forgotRules, forgotPassword,
  resetRules, resetPassword,
  changeCodeRules, requestChangeCode,
  changeRules, changePassword,
  MAX_ATTEMPTS,
};
