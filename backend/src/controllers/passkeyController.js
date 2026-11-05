const crypto    = require('crypto');
const mongoose  = require('mongoose');
const { body }  = require('express-validator');
const { parse: parseCookies } = require('cookie');
const { waitUntil } = require('@vercel/functions');
const User      = require('../models/User');
const Passkey   = require('../models/Passkey');
const PasskeyChallenge = require('../models/PasskeyChallenge');
const AppError  = require('../utils/AppError');
const mailer    = require('../services/mailer');
const passkeys  = require('../services/passkeyService');
const { renderAlert } = require('../services/alertEmail');
const { issueSession, hashToken, signedInAddress } = require('../services/sessionService');
const { recordEvent, afterSignIn, NOT_YOU_STEPS, adminAction } = require('../services/signInLog');
const { deviceLabel }     = require('../utils/deviceLabel');
const { requestLocation } = require('../utils/requestLocation');
const { WRONG_PASSWORD, passwordRule, checkPassword } = require('../utils/passwordCheck');
const { sendSession, signInDetails } = require('./authController');

// ══ Passkeys (PF-140) ════════════════════════════════════════════════════════
//
//   sign in:  login/options ─► the device signs ─► login/verify ─► session
//   add:      register/options (password) ─► the device makes a key ─► register/verify
//
// A sign-in ends in the same `issueSession` + `sendSession` as every other door.
//
// Adding or removing needs the password, and both email an alert (OWASP MFA
// Cheat Sheet: re-authenticate with an existing factor, notify out of band): a
// borrowed open laptop must not be able to plant a way back in. A refusal to a
// signed-in admin is 400, never 401 (the PF-124 rule): the client treats any 401
// as "this session has ended".

const FLOW_COOKIE = 'pf_passkey';
const COOKIE_PATH = '/api/auth/passkey/login';

/** Plenty for an owner, and it stops the list and each prompt growing without limit. */
const MAX_PASSKEYS = 10;

const UNAVAILABLE = "Passkey sign-in isn't available right now. Please sign in with your password or Google.";
const REFUSED     = "We couldn't sign you in with that passkey. Please try again, or use your password or Google.";
const TOO_SLOW    = 'That took too long. Please try again.';
const NOT_ADDED   = "We couldn't add that passkey. Please try again.";
const ALREADY     = 'That passkey is already on your account.';
const TOO_MANY    = `You already have ${MAX_PASSKEYS} passkeys. Remove one first.`;
const GONE        = 'That passkey has already been removed.';

// A signed answer from a device: an object naming its passkey. An array or an
// `id` that isn't text never reaches a query.
const credentialRule = (name, message) =>
  body(name).custom((v) => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof v.id === 'string' && v.id.length > 0)
    .withMessage(message);

const registerOptionsRules = [passwordRule];
const registerVerifyRules  = [credentialRule('credential', NOT_ADDED)];
const loginRules = [credentialRule('', REFUSED)];
const removeRules = [
  passwordRule,
  body('id').isString().withMessage(GONE).bail().notEmpty().withMessage(GONE),
];

// Plain data only: `publicKey` never leaves the server.
const rowOf = (passkey) => ({
  id:         passkey._id,
  label:      passkey.label ?? null,
  synced:     passkey.synced,
  addedAt:    passkey.createdAt,
  lastUsedAt: passkey.lastUsedAt,
});

// ── POST /api/auth/passkey/login/options ──────────────────────────────────────
const loginOptions = async (req, res, next) => {
  try {
    const rp = passkeys.relyingParty();
    if (!rp) return next(new AppError(UNAVAILABLE, 503));

    const options = await passkeys.loginOptions(rp);
    const binding = crypto.randomBytes(32).toString('base64url');
    await PasskeyChallenge.create({
      purpose:     'login',
      challenge:   options.challenge,
      bindingHash: hashToken(binding),
      expiresAt:   new Date(Date.now() + passkeys.CHALLENGE_TTL_MS),
    });

    // Ties this attempt to THIS browser, as `pf_oauth` does for Google. The
    // site and the API are one site since PF-146, so `Strict` still reaches here.
    res.cookie(FLOW_COOKIE, binding, {
      httpOnly: true,
      secure:   req.secure,
      sameSite: 'strict',
      path:     COOKIE_PATH,
      maxAge:   passkeys.CHALLENGE_TTL_MS,
    });
    res.json({ status: 'success', options });
  } catch (err) {
    next(err);
  }
};

/**
 * Who does this signed answer belong to, once checked? The passkey, or null.
 * The counter moves only if nobody else moved it first, so of two racing uses
 * of a device that counts, one is refused. (A device reporting 0 stays at 0.)
 */
const checkLogin = async (req, flow, rp) => {
  const credential = req.body;
  const passkey = await Passkey.findOne({ credentialId: { $eq: credential.id } });
  if (!passkey) return null;

  const result = await passkeys.verifyLogin(rp, credential, flow.challenge, passkey);
  if (!result) return null;

  const { modifiedCount } = await Passkey.updateOne(
    { _id: passkey._id, counter: passkey.counter },
    { $set: {
      counter:    result.authenticationInfo.newCounter,
      synced:     result.authenticationInfo.credentialDeviceType === 'multiDevice',
      lastUsedAt: new Date(),
    } },
  );
  return modifiedCount === 1 ? passkey : null;
};

// ── POST /api/auth/passkey/login/verify ───────────────────────────────────────
// Every refusal reads the same, and is logged the way a wrong password is.
const loginVerify = async (req, res, next) => {
  try {
    const rp = passkeys.relyingParty();
    if (!rp) return next(new AppError(UNAVAILABLE, 503));

    const binding = parseCookies(req.headers.cookie || '')[FLOW_COOKIE];
    res.clearCookie(FLOW_COOKIE, { path: COOKIE_PATH });

    // Spent here, right or wrong: one challenge, one try.
    const flow = typeof binding === 'string'
      ? await PasskeyChallenge.findOneAndDelete({ purpose: 'login', bindingHash: hashToken(binding) })
      : null;
    if (!flow || flow.expiresAt <= new Date()) return next(new AppError(TOO_SLOW, 400));

    const passkey = await checkLogin(req, flow, rp);
    const user = passkey && await User.findById(passkey.user);
    if (!user || !passkeys.handleMatches(req.body, user)) {
      await recordEvent(req, { user, kind: 'sign-in', outcome: 'failed', method: 'passkey' });
      return next(new AppError(REFUSED, 401));
    }

    // No address was typed, so it names the account's main one.
    const session = await issueSession(user, {
      signedInAs:   user.email,
      signInMethod: 'passkey',
      ...signInDetails(req),
    });
    const event = await recordEvent(req, {
      user, kind: 'sign-in', outcome: 'ok', method: 'passkey', address: user.email,
    });
    waitUntil(afterSignIn(user, event));
    sendSession(req, res, session, user);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/passkeys ────────────────────────────────────────────────────
const listPasskeys = async (req, res, next) => {
  try {
    const rows = await Passkey.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 });
    res.json({ status: 'success', data: rows.map(rowOf) });
  } catch (err) {
    next(err);
  }
};

/** Background, after the response: a failed email never fails the change. */
const sendChangeAlert = async (req, { subject, intro, label }) => {
  if (!mailer.isConfigured()) return;
  try {
    const sentTo = await signedInAddress(req);
    await mailer.send({
      to: [...new Set([req.user.email, sentTo])],
      subject,
      ...renderAlert({
        tone:    'warning',
        title:   subject,
        intro,
        details: [
          ['Passkey', label ?? 'Unnamed passkey'],
          ['Signed in as', sentTo],
          ['Device', deviceLabel(req.get('user-agent'))],
          ...(requestLocation(req) ? [['From', `${requestLocation(req)} (approx.)`]] : []),
        ],
        note:   'If this was you, there is nothing to do.',
        steps:  NOT_YOU_STEPS,
        action: adminAction(),
      }),
    });
  } catch (err) {
    // code + message only: the error object carries the transport (PF-123).
    console.error(`[PF-140] Passkey email failed: ${err.code || ''} ${err.message}`);
  }
};

// ── POST /api/auth/passkey/register/options ───────────────────────────────────
const registerOptions = async (req, res, next) => {
  try {
    const rp = passkeys.relyingParty();
    if (!rp) return next(new AppError(UNAVAILABLE, 503));

    if (!(await checkPassword(req))) {
      await recordEvent(req, { user: req.user, kind: 'passkey-add', outcome: 'failed', address: req.user.email });
      return next(new AppError(WRONG_PASSWORD, 400));
    }

    const existing = await Passkey.find({ user: req.user._id }).select('credentialId transports').lean();
    if (existing.length >= MAX_PASSKEYS) return next(new AppError(TOO_MANY, 400));

    const options = await passkeys.registerOptions(rp, req.user, existing);
    // One attempt per session at a time: a second press replaces the first.
    await PasskeyChallenge.deleteMany({ purpose: 'register', family: req.auth.family });
    await PasskeyChallenge.create({
      purpose:   'register',
      challenge: options.challenge,
      user:      req.user._id,
      family:    req.auth.family,
      expiresAt: new Date(Date.now() + passkeys.CHALLENGE_TTL_MS),
    });
    res.json({ status: 'success', options });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/passkey/register/verify ────────────────────────────────────
const registerVerify = async (req, res, next) => {
  try {
    const rp = passkeys.relyingParty();
    if (!rp) return next(new AppError(UNAVAILABLE, 503));

    const flow = await PasskeyChallenge.findOneAndDelete({
      purpose: 'register', user: req.user._id, family: req.auth.family,
    });
    if (!flow || flow.expiresAt <= new Date()) return next(new AppError(TOO_SLOW, 400));

    const result = await passkeys.verifyRegistration(rp, req.body.credential, flow.challenge);
    if (!result) return next(new AppError(NOT_ADDED, 400));

    const { credential, credentialDeviceType } = result.registrationInfo;
    let passkey;
    try {
      passkey = await Passkey.create({
        user:         req.user._id,
        credentialId: credential.id,
        publicKey:    Buffer.from(credential.publicKey),
        counter:      credential.counter,
        transports:   credential.transports,
        synced:       credentialDeviceType === 'multiDevice',
        label:        deviceLabel(req.get('user-agent')),
      });
    } catch (err) {
      if (err.code === 11000) return next(new AppError(ALREADY, 400));
      throw err;
    }

    await recordEvent(req, { user: req.user, kind: 'passkey-add', outcome: 'ok', address: req.user.email });
    waitUntil(sendChangeAlert(req, {
      subject: 'A passkey was added to your admin',
      intro:   'Someone signed in to your admin added a passkey. It can now sign in to the Portfolio CMS without a password.',
      label:   passkey.label,
    }));
    res.status(201).json({ status: 'success', data: rowOf(passkey) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/passkeys/remove ────────────────────────────────────────────
// Scoped to the account in the QUERY, so another account's id matches nothing.
const removePasskey = async (req, res, next) => {
  try {
    if (!(await checkPassword(req))) {
      await recordEvent(req, { user: req.user, kind: 'passkey-remove', outcome: 'failed', address: req.user.email });
      return next(new AppError(WRONG_PASSWORD, 400));
    }

    const removed = mongoose.isValidObjectId(req.body.id)
      ? await Passkey.findOneAndDelete({ _id: { $eq: req.body.id }, user: req.user._id })
      : null;
    if (!removed) return next(new AppError(GONE, 404));

    await recordEvent(req, { user: req.user, kind: 'passkey-remove', outcome: 'ok', address: req.user.email });
    waitUntil(sendChangeAlert(req, {
      subject: 'A passkey was removed from your admin',
      intro:   'Someone signed in to your admin removed a passkey. It can no longer sign in. Your device may still list it until you delete it there too.',
      label:   removed.label,
    }));
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  MAX_PASSKEYS,
  loginOptions, loginRules, loginVerify,
  listPasskeys,
  registerOptionsRules, registerOptions,
  registerVerifyRules, registerVerify,
  removeRules, removePasskey,
};
