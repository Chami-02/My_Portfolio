const crypto   = require('crypto');
const { body } = require('express-validator');
const { waitUntil } = require('@vercel/functions');
const User          = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const AppError      = require('../utils/AppError');
const mailer        = require('../services/mailer');
const { renderAlert }       = require('../services/alertEmail');
const { isBreached }        = require('../services/breachedPasswords');
const { revokeAllForUser }  = require('../services/sessionService');
const { passwordProblem }   = require('../utils/passwordPolicy');
const { requestLocation }   = require('../utils/requestLocation');

// ══ Forgot password (PF-125) ═════════════════════════════════════════════════
//
//   forgot { email } ─► 200, always the same ─► (background) code emailed
//   reset  { email, code, password } ─► new password, every session revoked
//
// Shaped by the OWASP Forgot Password Cheat Sheet:
//   - the SAME answer, in the same time, for any address — nobody can use
//     this form to learn which addresses sign in here;
//   - a random six-digit code, single use, 10 minutes, only its HMAC stored;
//   - few guesses per code (MAX_ATTEMPTS) on top of the per-IP limiters;
//   - NO lockout of the account: both admin addresses are public, so a
//     lockout would let anyone lock the owner out;
//   - a reset signs out every session and signs nobody in — the owner signs
//     in with the new password — and a "password changed" email follows.

const CODE_TTL_MS  = 10 * 60 * 1000;
const COOLDOWN_MS  = 60 * 1000;
const MAX_ATTEMPTS = 5;

const FORGOT_MESSAGE =
  'If that address can sign in here, a reset code is on its way. It expires in 10 minutes.';
// One sentence for every way a code can fail — wrong, expired, used, never
// sent, or a different address. Each distinction would be an oracle.
const BAD_CODE = 'That code is wrong or has expired. Check it, or request a new one.';
const BREACHED = 'This password has appeared in a data leak. Choose a different one.';

/**
 * HMAC keyed with the server secret, bound to the user. Without the key a
 * database copy cannot test the million possible codes.
 */
const codeHash = (userId, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}:${code}`).digest('hex');

const sameHash = (a, b) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

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

    // Cooldown: one email a minute per account, so the public form cannot
    // flood the owner's inbox (or spend the Gmail quota).
    const recent = await PasswordReset.exists({
      user: user._id, createdAt: { $gt: new Date(Date.now() - COOLDOWN_MS) },
    });
    if (recent) return;

    if (!mailer.isConfigured()) {
      console.warn('[PF-125] Mail is not configured — no reset code sent');
      return;
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    // A new code replaces the old one: only the newest can ever work.
    await PasswordReset.deleteMany({ user: user._id });
    await PasswordReset.create({
      user:      user._id,
      sentTo,
      codeHash:  codeHash(user._id, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

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

    // Spend a guess ATOMICALLY before comparing: two racing requests cannot
    // both slip under the cap. A row at the cap matches nothing from then on
    // — the code is dead, even the right one — until a new code replaces it
    // or the TTL removes it.
    const row = await PasswordReset.findOneAndUpdate(
      { user: user._id, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    );
    if (!row || row.expiresAt <= new Date() || row.sentTo !== typed) {
      return next(new AppError(BAD_CODE, 400));
    }
    if (!sameHash(row.codeHash, codeHash(user._id, code))) {
      return next(new AppError(BAD_CODE, 400));
    }

    // The leak check only AFTER the code is right: a stranger guessing codes
    // never makes this server call out. A leaked password leaves the code
    // alive (one guess spent), so the owner just picks another.
    if (await isBreached(password)) return next(new AppError(BREACHED, 400));

    // Single use: of two racing correct requests, only one deletes the row.
    const claimed = await PasswordReset.findOneAndDelete({ _id: row._id });
    if (!claimed) return next(new AppError(BAD_CODE, 400));

    // save(), NEVER an update query: only save() runs the hashing hook.
    const account = await User.findById(user._id).select('+password');
    account.password = password;
    await account.save();
    await revokeAllForUser(user._id);

    waitUntil(notifyChanged(account, row.sentTo, requestLocation(req)));
    res.json({ status: 'success', message: 'Password changed. Sign in with your new password.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  forgotRules, forgotPassword,
  resetRules, resetPassword,
  MAX_ATTEMPTS,
};
