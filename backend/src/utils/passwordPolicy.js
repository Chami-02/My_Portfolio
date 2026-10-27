// backend/src/utils/passwordPolicy.js
//
// PF-125 — the ONE rule for a NEW admin password (owner, 2026-10-26). Used by
// the forgot-password reset now, and by PF-124's change password and the
// `npm run admin:password` script.
//
// NIST SP 800-63B-4: at least 15 characters when the password is the only
// thing a sign-in checks (it is here, beside Google), and NO composition rules
// — no "one capital, one digit". A long phrase is the strong password.
//
// The ceiling is bcrypt's: it reads only the first 72 BYTES, so anything past
// that would silently not count. 64 characters is the usual published limit;
// the byte check catches a shorter password made of multi-byte characters.
//
// ⚠️ User.password's schema `minlength` stays 8 — it is the database floor,
// and the existing password keeps working until it is changed. This rule
// applies only where a password is CHOSEN.

const MIN_LENGTH = 15;
const MAX_LENGTH = 64;
const MAX_BYTES  = 72;

/**
 * Why `password` cannot be a new admin password, or null if it can.
 * Characters are counted as the person sees them (an emoji is one).
 */
const passwordProblem = (password) => {
  if (typeof password !== 'string') return 'Password must be text';
  const length = [...password].length;
  if (length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (length > MAX_LENGTH || Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    return `Password must be at most ${MAX_LENGTH} characters`;
  }
  return null;
};

module.exports = { passwordProblem, MIN_LENGTH, MAX_LENGTH };

// ── Strength (PF-124, owner 2026-10-27) ─────────────────────────────────────
//
// Two checks, both from NIST SP 800-63B-4's "blocklist" requirement, and NO
// forced mix of capitals / digits / symbols (the same standard forbids that —
// forced mixes make passwords like "Password1!" that attackers try first):
//
//   1. CONTEXT WORDS — the password may not contain the owner's name, the
//      name part of a login address, or the site's name. NIST names "the name
//      of the service, the username, and derivatives"; Microsoft's password
//      rules refuse the account name and parts of the full name the same way.
//      Matched after undoing the usual look-alike swaps (p4rindr@ = parindra).
//      zxcvbn alone misses this: it multiplies a guess count per PIECE, so
//      "gallage parindra 1" scored 4 of 4 in a measurement here.
//
//   2. zxcvbn (Dropbox's estimator, the zxcvbn-ts port) must score 4 of 4 —
//      at least 10^10 guesses. Measured: every ordinary 15+ character
//      passphrase tried scored 4; "password password" and "parindra
//      portfolio" scored 3 and are refused.
//
// The dictionaries are large, so the checker is built on first use, once.

const MIN_SCORE  = 4;
const SITE_WORDS = ['portfolio'];

let checker;
const zxcvbn = () => {
  if (!checker) {
    const { ZxcvbnFactory } = require('@zxcvbn-ts/core');
    const common = require('@zxcvbn-ts/language-common');
    const en     = require('@zxcvbn-ts/language-en');
    checker = new ZxcvbnFactory({
      translations: en.translations,
      graphs:       common.adjacencyGraphs,
      dictionary:   { ...common.dictionary, ...en.dictionary },
    });
  }
  return checker;
};

// The look-alike swaps people use to "disguise" a word.
const LOOKALIKE = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
/** Lower-case letters only, look-alikes undone: "P4rindr@ 1!" → "parindrai". */
const lettersOf = (text) =>
  text.toLowerCase().replace(/[013457@$!]/g, (c) => LOOKALIKE[c]).replace(/[^a-z]/g, '');

/**
 * The words a password must not be built from, for one account: each login
 * address's name part, each word of the site owner's name, the site's name.
 * Words under 4 letters are dropped — "pc" would refuse half the dictionary.
 */
const contextWords = ({ addresses = [], name = '' } = {}) => [...new Set([
  ...addresses.map((a) => String(a).split('@')[0]),
  ...String(name).split(/[^\p{L}]+/u),
  ...SITE_WORDS,
].map(lettersOf).filter((w) => w.length >= 4))];

const CONTEXT = "Don't build it from your name, your email address or the site's name.";

/**
 * Why `password` is too easy to guess, or null. Assumes the length rule
 * (`passwordProblem`) already passed.
 */
const strengthProblem = (password, words = []) => {
  const letters = lettersOf(password);
  if (words.some((w) => letters.includes(w))) return CONTEXT;

  const { score, feedback } = zxcvbn().check(password, words);
  if (score >= MIN_SCORE) return null;
  return [feedback.warning || 'This password is too easy to guess.', feedback.suggestions[0]]
    .filter(Boolean).join(' ');
};

module.exports.contextWords    = contextWords;
module.exports.strengthProblem = strengthProblem;
module.exports.MIN_SCORE       = MIN_SCORE;
