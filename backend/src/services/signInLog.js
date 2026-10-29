const SignInEvent = require('../models/SignInEvent');
const User        = require('../models/User');
const mailer      = require('./mailer');
const { renderAlert } = require('./alertEmail');
const { isBreached }  = require('./breachedPasswords');
const { deviceLabel }     = require('../utils/deviceLabel');
const { requestLocation } = require('../utils/requestLocation');

// ── The security event log (PF-133) ──────────────────────────────────────────
// OWASP Logging Cheat Sheet / ASVS 5.0 V16: record every authentication
// success AND failure, password resets and changes — who (the address), when,
// from where — and never a secret. The owner reads it in Settings → Sessions.
//
// Two halves:
//   - `recordEvent` is AWAITED by the route. One small insert, made on every
//     path alike (known address, unknown address, wrong password), so it adds
//     the same few milliseconds to each and the timing still tells nothing.
//     It NEVER throws: a log that cannot be written must not stop a sign-in.
//   - `afterSignIn` runs in the BACKGROUND (waitUntil) after a successful
//     sign-in: the new-device email and the leak check. The owner never waits
//     for Gmail or Have I Been Pwned.

/**
 * "NOT YOU? DO THIS NOW" (owner, 2026-10-29) — the same three steps in the
 * new-sign-in email and the daily digest, and a button to the admin.
 */
const NOT_YOU_STEPS = [
  'Change your password: Settings → Password.',
  "Sign out any device you don't recognise: Settings → Sessions.",
  "Can't sign in? Use \"Forgot password?\" on the sign-in page.",
];
/**
 * The emails' button to the admin. Without FRONTEND_URL the url is a bare
 * `/admin`, which renderAlert drops (web addresses only) — the steps stay.
 */
const adminAction = () => ({
  label: 'OPEN ADMIN',
  url:   `${(process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/admin`,
});

/** A sign-in from the same device AND place within this many days is not new. */
const NEW_DEVICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Typed text as it is kept: a string, trimmed, lower-cased, at most 254. */
const cleanAddress = (value) =>
  (typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : undefined);

/**
 * @param {import('express').Request} req
 * @param {{ user?: object|null, kind: string, outcome: 'ok'|'failed', method?: string, address?: string }} event
 * @returns {Promise<object|null>} the row, or null if it could not be written
 */
const recordEvent = async (req, { user, kind, outcome, method, address }) => {
  try {
    return await SignInEvent.create({
      user:     user?._id ?? null,
      kind,
      outcome,
      method,
      address:  cleanAddress(address),
      device:   deviceLabel(req.get('user-agent')),
      location: requestLocation(req) ?? undefined,
    });
  } catch (err) {
    console.error(`[PF-133] Sign-in event not recorded: ${err.message}`);
    return null;
  }
};

/**
 * Has this account signed in from the same device and place in the last 30
 * days — not counting `event` itself? A missing place matches a missing place
 * (Mongo's `null` matches an absent field), so off Vercel the device decides.
 */
const seenBefore = (event) =>
  SignInEvent.exists({
    _id:      { $ne: event._id },
    user:     event.user,
    kind:     'sign-in',
    outcome:  'ok',
    device:   event.device ?? null,
    location: event.location ?? null,
    createdAt: { $gte: new Date(Date.now() - NEW_DEVICE_DAYS * DAY_MS) },
  });

/**
 * The "new sign-in" email (owner, 2026-10-29: new devices only — what Google
 * and GitHub do; an email for every sign-in teaches the reader to ignore them).
 * To the MAIN address and the one used, the same pair as every account alert.
 */
const alertIfNewDevice = async (user, event) => {
  if (!mailer.isConfigured() || await seenBefore(event)) return;
  const method = event.method === 'google' ? 'Google' : 'Password';
  await mailer.send({
    to:      [...new Set([user.email, event.address])],
    subject: `New sign-in to your admin: ${event.device}`,
    ...renderAlert({
      tone:    'warning',
      title:   'New sign-in to your admin',
      intro:   `Someone signed in to the Portfolio CMS as ${event.address} from a device or place not seen in the last ${NEW_DEVICE_DAYS} days.`,
      details: [
        ['Address', event.address],
        ['Device', event.device],
        ['Method', method],
        ...(event.location ? [['From', `${event.location} (approx.)`]] : []),
      ],
      note:   'If this was you, there is nothing to do.',
      steps:  NOT_YOU_STEPS,
      action: adminAction(),
    }),
  });
};

/**
 * NIST SP 800-63B-4: no scheduled password expiry — change it on EVIDENCE of
 * compromise. The password is in hand at sign-in, so ask Have I Been Pwned
 * (k-anonymity, fails open: `null` changes nothing). The flag is written only
 * while the account still has the hash that signed in — a password changed
 * meanwhile is never marked by a check of the old one.
 */
const checkLeak = async (user, password) => {
  const leaked = await isBreached(password);
  if (leaked === null) return;
  await User.updateOne(
    { _id: user._id, password: user.password },
    leaked ? { $set: { passwordLeakedAt: new Date() } } : { $unset: { passwordLeakedAt: 1 } },
  );
};

/**
 * Background work after a successful sign-in. Never throws: the response has
 * gone. `password` only for a password sign-in (`user` loaded with
 * `+password`); Google sign-ins have none to check.
 */
const afterSignIn = async (user, event, { password } = {}) => {
  await Promise.all([
    event && alertIfNewDevice(user, event).catch((err) => {
      // code + message only: the error object carries the transport (PF-123).
      console.error(`[PF-133] New sign-in email failed: ${err.code || ''} ${err.message}`);
    }),
    password && checkLeak(user, password).catch((err) => {
      console.error(`[PF-133] Leak check at sign-in failed: ${err.message}`);
    }),
  ]);
};

module.exports = { recordEvent, afterSignIn, NEW_DEVICE_DAYS, NOT_YOU_STEPS, adminAction };
