// frontend/src/utils/passwordStrength.js
//
// PF-124 follow-up — the client's copy of the server's strength rule
// (backend/src/utils/passwordPolicy.js), for the live meter. A COURTESY: the
// server decides. Two parts, as there:
//
//   1. CONTEXT WORDS — no owner name, address name or site name in it
//      (NIST SP 800-63B-4 blocklist), look-alike swaps undone;
//   2. zxcvbn (Dropbox's estimator) must score 4 of 4.
//
// No forced mix of capitals / digits / symbols: NIST forbids requiring one.
//
// ⚠️ zxcvbn's dictionaries are large, so `loadStrengthChecker` imports them
// only when a new-password field is first typed in. The home and login pages
// never download them (asserted against the build).

export const MIN_SCORE = 4;
const SITE_WORDS = ['portfolio'];

const LOOKALIKE = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
/** Lower-case letters only, look-alikes undone: "P4rindr@ 1!" → "parindrai". */
export const lettersOf = (text) =>
  text.toLowerCase().replace(/[013457@$!]/g, (c) => LOOKALIKE[c]).replace(/[^a-z]/g, '');

/** The same words the server builds: address name parts, name words, the site. */
export const contextWords = ({ addresses = [], name = '' } = {}) => [...new Set([
  ...addresses.map((a) => String(a).split('@')[0]),
  ...String(name).split(/[^\p{L}]+/u),
  ...SITE_WORDS,
].map(lettersOf).filter((w) => w.length >= 4))];

export const CONTEXT = "Don't build it from your name, your email address or the site's name.";

/** True when the password contains one of `words` — the context rule alone. */
export const usesContextWord = (password, words) => {
  const letters = lettersOf(password);
  return words.some((w) => letters.includes(w));
};

let loading;

/**
 * Resolves to `check(password, words)` → `{ score, problem }`: `score` 0–4
 * (0 when a context word is used), `problem` the sentence to show, or null
 * when the password passes. Loaded once; later calls share it.
 */
export function loadStrengthChecker() {
  loading ??= Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ]).then(([{ ZxcvbnFactory }, common, en]) => {
    const zxcvbn = new ZxcvbnFactory({
      translations: en.translations,
      graphs:       common.adjacencyGraphs,
      dictionary:   { ...common.dictionary, ...en.dictionary },
    });
    return (password, words = []) => {
      if (usesContextWord(password, words)) return { score: 0, problem: CONTEXT };
      const { score, feedback } = zxcvbn.check(password, words);
      if (score >= MIN_SCORE) return { score, problem: null };
      return {
        score,
        problem: [feedback.warning || 'This password is too easy to guess.', feedback.suggestions[0]]
          .filter(Boolean).join(' '),
      };
    };
  });
  return loading;
}
