// frontend/src/utils/messageSearch.js
//
// PF-115 — searching the admin Messages panel (owner, 2026-10-07: "i could be
// able to search any term in the message and that message should come up").
//
// ── WHY IN THE BROWSER, NOT ON THE SERVER ───────────────────────────────
// The panel already holds every message — `GET /api/contact` returns the lot,
// and each is at most 1,000 characters. Filtering what is in hand is instant
// and costs nothing; a request per keystroke would spend the 100-per-15-min
// rate-limit budget and add a round trip to every letter typed.
//
// ── THE RULES ───────────────────────────────────────────────────────────
//   1. Case-insensitive, and runs of whitespace count as one space.
//   2. The query is split into WORDS, and a message matches only if it
//      contains EVERY word (AND) somewhere in its name, email or text.
//      AND, not OR — the same call /blog's tag filter made (PF-105): OR
//      barely filters, because almost every message shares some word.
//   3. SUBSTRING matching, so `dock` finds `Docker` while you are still
//      typing it.
//   4. ⚠️ NO RegExp is ever built from the query. `c++`, `(urgent)` or `.*`
//      are plain text here; a regex built from them would throw on some and
//      match everything on others.
//
// React-free and directly unit-testable, like every file in `src/utils/`.

const normalise = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ');

/** The words of a query — lowercased, empties dropped. `[]` means "no search". */
export const searchWords = (query) => normalise(query).split(' ').filter(Boolean);

/** Does this message contain every word? An empty word list matches everything. */
export const messageMatches = (message, words) => {
  if (words.length === 0) return true;
  const haystack = normalise(`${message.name ?? ''} ${message.email ?? ''} ${message.message ?? ''}`);
  return words.every((word) => haystack.includes(word));
};

/**
 * The messages that match `query`, in the order given (the server's: unread
 * first, then newest). Returns the same array when there is no query.
 */
export const searchMessages = (messages, query) => {
  const words = searchWords(query);
  if (words.length === 0) return messages;
  return messages.filter((m) => messageMatches(m, words));
};

/**
 * Split `text` into `[{ text, match }]` runs so the panel can wrap each match
 * in a `<mark>` — rendered as TEXT by React, never as HTML, so a message
 * carrying `<script>` stays inert.
 *
 * Joining every `text` back together always reproduces the input exactly:
 * matching runs on a lowercased copy, but the slices are cut from the
 * original, so the visitor's own casing is what is shown.
 *
 * Overlapping matches (`do` and `dock` in one query) merge into one run.
 */
export const highlightParts = (text, words) => {
  const source = String(text ?? '');
  if (!source || words.length === 0) return [{ text: source, match: false }];

  const lower = source.toLowerCase();
  // Mark every character that falls inside any occurrence of any word.
  const marked = new Array(source.length).fill(false);
  for (const word of words) {
    let from = lower.indexOf(word);
    while (from !== -1) {
      for (let i = from; i < from + word.length; i += 1) marked[i] = true;
      from = lower.indexOf(word, from + 1);
    }
  }

  const parts = [];
  let start = 0;
  for (let i = 1; i <= source.length; i += 1) {
    if (i === source.length || marked[i] !== marked[start]) {
      parts.push({ text: source.slice(start, i), match: marked[start] });
      start = i;
    }
  }
  return parts;
};

/** Which tab a message belongs in. ALL holds everything, starred included. */
export const MESSAGE_TABS = [
  { key: 'all',     label: 'ALL',     test: () => true },
  { key: 'unread',  label: 'UNREAD',  test: (m) => !m.read },
  { key: 'starred', label: 'STARRED', test: (m) => Boolean(m.starred) },
];
