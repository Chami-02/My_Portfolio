const { escapeRegex, searchCondition } = require('./searchTerms');

// PF-144 — the `$match` for the public project list, /projects.
//
// The same contract as Blog's buildMatch (utils/blogQuery.js), on Project's
// own fields, so the two search boxes behave alike:
//   ?q=        every WORD, anywhere in the record (separators optional —
//              utils/searchTerms.js): title, summary, role, client, category,
//              tech, every section and every picture caption.
//   ?tech=     one value or several (`?tech=React&tech=Docker`), ANDed.
//   ?category= one value (a project has at most one).
// Each filter value is an ANCHORED, case-insensitive regex, so "React"
// does not also match "React Native". Every input is escaped: the
// visitor's text is data, not a pattern.

/** A string, or the strings in an array; trimmed; blanks and 'All' dropped. */
const values = (input) =>
  (Array.isArray(input) ? input : [input])
    .filter((v) => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v && v.toLowerCase() !== 'all');

const exactly = (v) => new RegExp(`^${escapeRegex(v)}$`, 'i');

/**
 * @param {object} opts
 * @param {object} opts.base       the visibility filter (public or admin)
 * @param {string} [opts.q]
 * @param {string|string[]} [opts.tech]
 * @param {string|string[]} [opts.category]
 */
function buildProjectMatch({ base = {}, q, tech, category } = {}) {
  const and = [
    ...values(tech).map((t) => ({ tech: exactly(t) })),
    // Only the FIRST category counts — a project carries one.
    ...values(category).slice(0, 1).map((c) => ({ categories: exactly(c) })),
  ];

  // Word by word, separators optional (utils/searchTerms.js).
  const search = searchCondition(q, [
    'title', 'description', 'role', 'client', 'categories', 'tech',
    'sections.heading', 'sections.body', 'sections.bullets', 'sections.images.caption',
  ]);
  if (search) and.push(...search.$and);

  return and.length ? { ...base, $and: and } : { ...base };
}

module.exports = { buildProjectMatch };
