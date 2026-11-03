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
// Not done: spelling-mistake tolerance ("dokcer"). That needs a search engine
// (Atlas Search), which the in-memory test database cannot run.

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

/** Bounds on what a visitor can make the server compile and run. */
const MAX_QUERY = 100;
const MAX_WORDS = 8;

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
    .map((word) => new RegExp([...word].map(escapeRegex).join(GAP), 'i'));
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

module.exports = { escapeRegex, searchRegexes, searchCondition, MAX_QUERY, MAX_WORDS };
