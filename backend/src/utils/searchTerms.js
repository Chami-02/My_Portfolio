// PF-144 — a forgiving search box, shared by /blog and /projects.
//
// Owner, 2026-11-03: "full stack" found nothing while "full-stack" did. The
// box used to look for the visitor's text as ONE exact piece. Now:
//
//   1. The text is split into WORDS, and every word must appear somewhere in
//      the record, in any order ("docker react" finds a record with both).
//   2. Separators do not matter: space, `-`, `_`, `.` and `/` are treated
//      alike AND may be missing, so "full stack", "fullstack" and "Full_Stack"
//      all find "full-stack", and "nodejs" finds "Node.js".
//   3. Case-insensitive, and every character escaped — the visitor's text is
//      DATA, never a pattern (OWASP: injection / ReDoS).
//
// How (2): inside a word, an optional run of separators is allowed between
// every two characters — `f[\s\-_./]*u[\s\-_./]*l…`. Each optional run sits
// between two LITERAL characters, so the pattern cannot backtrack
// catastrophically; the length caps below bound its size as well.
//
//   4. PF-138 (owner, 2026-11-03): ONE spelling mistake is forgiven in a word
//      of 5–12 letters — "dokcer" finds Docker, "reactt" React, "nodjs"
//      Node.js. No search engine (Atlas Search): the in-memory test database
//      cannot run one, and these few lines run on any MongoDB.
//
// How (4): the word's exact pattern, OR one variant per position (a classic
// "edit distance 1" match, Damerau–Levenshtein):
//   - `…ab(?:X)?(?:c)?de…` at position c (X = any letter) covers a wrong
//     letter (X only), a missing one (X then c), an extra one (neither);
//   - `…abdce…` covers two neighbours swapped.
// Separators stay optional inside every variant too ("nodjs" finds
// "Node.js"). Each variant holds ONE optional pair, and every gap follows a
// required letter, so it cannot backtrack catastrophically; FUZZY_MAX bounds
// the pattern's size (~2n² pieces).
// Short words stay exact — one mistake in "css" would match half the site.

/**
 * Escape regex metacharacters so a search term is matched LITERALLY (moved
 * here from blogQuery.js in PF-144). Without it a visitor typing `c++` or `(`
 * sends an invalid or pathological pattern straight into the query.
 */
function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SEPARATORS = /[\s\-_./]+/;
const GAP = '[\\s\\-_./]*';
/** Any one character that is not a separator — the "wrong or extra letter". */
const LETTER = '[^\\s\\-_./]';

/** Bounds on what a visitor can make the server compile and run. */
const MAX_QUERY = 100;
const MAX_WORDS = 8;

/** Words this long (in letters) forgive one mistake; longer ones stay exact. */
const FUZZY_MIN = 5;
const FUZZY_MAX = 12;

/**
 * Pattern source matching `word` with at most one mistake (see 4 above).
 * @param {string[]} chars the word's characters
 * @returns {string}
 */
function oneMistake(chars) {
  // Every gap FOLLOWS a letter that must be there, so two gaps can never
  // share a run of separators — the trap that made a first version take
  // seconds on a line of "- - - -" (measured, PF-138).
  const lit = (list) => list.map((c) => escapeRegex(c) + GAP).join('');
  const variants = [];
  chars.forEach((ch, i) => {
    const middle = `(?:${LETTER}${GAP})?(?:${escapeRegex(ch)}${GAP})?`;
    variants.push(lit(chars.slice(0, i)) + middle + lit(chars.slice(i + 1)));
    const next = chars[i + 1];
    if (next !== undefined && next.toLowerCase() !== ch.toLowerCase()) {
      variants.push(lit([...chars.slice(0, i), next, ch, ...chars.slice(i + 2)]));
    }
  });
  return variants.join('|');
}

/** One word → its RegExp: separators optional, and one mistake if long enough. */
function wordRegex(word) {
  const chars = [...word];
  const exact = chars.map(escapeRegex).join(GAP);
  const fuzzy = chars.length >= FUZZY_MIN && chars.length <= FUZZY_MAX;
  return new RegExp(fuzzy ? `${exact}|${oneMistake(chars)}` : exact, 'i');
}

/**
 * The visitor's text → one case-insensitive RegExp per word; [] when there is
 * nothing to search for.
 * @param {unknown} q
 * @returns {RegExp[]}
 */
function searchRegexes(q) {
  if (typeof q !== 'string') return [];
  return q.slice(0, MAX_QUERY)
    .split(SEPARATORS)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .map(wordRegex);
}

/**
 * The `$match` condition: every word must match at least one of `fields`.
 * Returns null when there is nothing to search for.
 * @param {unknown} q
 * @param {string[]} fields
 */
function searchCondition(q, fields) {
  const words = searchRegexes(q);
  if (words.length === 0) return null;
  return { $and: words.map((rx) => ({ $or: fields.map((f) => ({ [f]: rx })) })) };
}

module.exports = {
  escapeRegex, searchRegexes, searchCondition, MAX_QUERY, MAX_WORDS, FUZZY_MIN, FUZZY_MAX,
};
