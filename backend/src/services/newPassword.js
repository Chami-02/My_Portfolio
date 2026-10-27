const About = require('../models/About');
const User  = require('../models/User');
const { contextWords, strengthProblem } = require('../utils/passwordPolicy');
const { isBreached } = require('./breachedPasswords');

// ── Every check a NEW password must pass, after the length rule (PF-124) ─────
// One function for the three doors that choose a password — the Settings
// change, the forgot-password reset and `npm run admin:password` — so none of
// them can skip a rule. In order, and the FIRST problem is the answer:
//
//   1. strength — no name / address / site words, zxcvbn 4 of 4 (NIST SP
//      800-63B-4 blocklist; no forced character mix, which NIST forbids);
//   2. reuse    — not the current password or one of the 4 before it
//      (PCI DSS v4.0 §8.3.7 asks for 4; we block the last 5);
//   3. leak     — not in a known breach (NIST; Have I Been Pwned, k-anonymity).
//
// The reuse check (bcrypt, CPU) and the leak check (network) run at the same
// time; the answer still follows the order above.

const REUSED = `You've used this password recently. Choose one that isn't one of your last ${User.HISTORY_KEPT + 1}.`;
const BREACHED = 'This password has appeared in a data leak. Choose a different one.';

/**
 * Why `password` cannot replace `account`'s password, or null.
 * `account` must be loaded with `+password +passwordHistory`. `current` is
 * the current password when the caller has just proved it (see usedRecently).
 */
const newPasswordProblem = async (account, password, { current } = {}) => {
  const about = await About.findOne().select('name').lean();
  const words = contextWords({ addresses: [account.email, ...account.loginEmails], name: about?.name });

  const weak = strengthProblem(password, words);
  if (weak) return weak;

  const [reused, breached] = await Promise.all([
    account.usedRecently(password, { current }),
    isBreached(password),
  ]);
  if (reused) return REUSED;
  if (breached) return BREACHED;
  return null;
};

module.exports = { newPasswordProblem, REUSED, BREACHED };
