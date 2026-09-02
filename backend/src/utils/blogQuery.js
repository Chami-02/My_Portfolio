// backend/src/utils/blogQuery.js
//
// PF-96 — THE single definition of how blog posts are matched and ordered.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────
// Before PF-96 the ordering rule was written twice and the two copies
// disagreed:
//
//   blogController.js   .sort({ createdAt: -1 })          (no tiebreak)
//   BlogSection.jsx     createdAt desc, then _id ascending
//
// `createdAt` is the wrong key for either of them. `seed.js` writes all
// four posts in ONE `insertMany`, and `timestamps: true` stamps that batch
// from the driver's clock — measured over five fresh seeds, three batches
// straddled a millisecond boundary and produced two distinct stamps. That
// is enough for the database to consider them ordered and not enough for
// the order to mean anything, so the `_id` tiebreak never engaged and the
// LATEST POST badge landed on the third-oldest post.
//
// PF-95 made `publishedAt` real per-post data, months apart. This file is
// where "newest first" is now defined, once, for every caller.
//
// ── WHY AN AGGREGATION AND NOT `.sort()` ────────────────────────────────
// `publishedAt` defaults to `null`, so a plain
// `.sort({ publishedAt: -1, createdAt: -1 })` is not equivalent: MongoDB
// orders `null` BELOW every real date. That is not a legacy-data edge
// case — it is the default for every post the admin panel creates, so a
// brand-new post would sort LAST while its card displayed today's date.
//
// `$ifNull` collapses the two fields into one sort key BEFORE sorting, so
// a null `publishedAt` falls back to `createdAt` and takes the position
// its own displayed date implies. `BlogSection.jsx` already DISPLAYS
// `publishedAt || createdAt`; this makes the order read the same value, so
// a post can never appear in a position its printed date contradicts.
//
// Rejected: stamping `publishedAt` at publish time and keeping the plain
// indexed sort. Better domain modelling, but it does not remove the need
// for the fallback — every row already in the database still holds `null`
// until it is edited, so reads would need `$ifNull` anyway and the app
// would carry two mechanisms instead of one. Recorded, not built.
//
// ── COST, ACCEPTED ──────────────────────────────────────────────────────
// A computed sort key cannot use an index, so the `$sort` is in-memory.
// At four posts this is irrelevant; MongoDB's 100 MB in-memory sort limit
// is thousands of posts away. `Blog.js`'s index still serves the `$match`.
// If this collection ever grows past a few thousand posts, backfill
// `publishedAt` for every row and switch to a plain indexed sort.
// ────────────────────────────────────────────────────────────────────────

/** Field name the pipeline sorts on. Stripped before the response. */
const SORT_KEY = '_sortDate';

/**
 * Escape regex metacharacters so a search term is matched LITERALLY.
 *
 * Without this a visitor typing `c++` or `(` sends an invalid or
 * pathological pattern straight into the query — a crash at best, a
 * catastrophic-backtracking stall at worst. The user's text is data, not
 * a pattern.
 */
function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the `$match` for a post list.
 *
 * Search semantics are transcribed from the design's own filter,
 * `docs/design/Blog.dc.html:537-546`:
 *
 *     const tagOk = tag === 'All' || p.tags.includes(tag);
 *     if (!tagOk) return false;
 *     if (!q) return true;
 *     return (p.title + ' ' + p.excerpt + ' ' + p.tags.join(' '))
 *              .toLowerCase().includes(q);
 *
 * So: tag AND query; the query is a case-insensitive SUBSTRING over
 * title, excerpt and tags — deliberately NOT section body text, even
 * though the prototype's placeholder says "tools". The design is the
 * authority for behaviour a visitor can observe.
 *
 * @param {object}  opts
 * @param {boolean} opts.publishedOnly  false for the admin list
 * @param {string}  [opts.q]            search term
 * @param {string}  [opts.tag]          single tag; 'All' means no filter
 */
function buildMatch({ publishedOnly = true, q, tag } = {}) {
  const match = {};
  if (publishedOnly) match.published = true;

  const tagValue = typeof tag === 'string' ? tag.trim() : '';
  // 'All' is the design's own "no filter" chip, and it is sent as a real
  // query value rather than omitted — so it must be understood here.
  if (tagValue && tagValue.toLowerCase() !== 'all') {
    // Anchored: a tag filter is exact membership, not a substring, or
    // selecting "React" would also match "React Native". Case-insensitive
    // so a tag arriving from a URL does not have to match casing exactly.
    match.tags = new RegExp(`^${escapeRegex(tagValue)}$`, 'i');
  }

  const query = typeof q === 'string' ? q.trim() : '';
  if (query) {
    const rx = new RegExp(escapeRegex(query), 'i');
    // On an array field, an $or arm matches if ANY element matches, which
    // is what makes `tags: rx` behave like the design's `tags.join(' ')`.
    match.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
  }

  return match;
}

/**
 * The ordered-posts pipeline. Every list and the prev/next lookup go
 * through this, so they cannot drift apart.
 *
 * Tiebreak is `_id` ASCENDING, matching `BlogSection.jsx`'s `byRecency`.
 * An ObjectId's trailing counter increments within one `insertMany`, so
 * ascending recovers insertion order — the design's own 01·02·03·04 —
 * when two posts genuinely share a date.
 *
 * @param {object} opts
 * @param {object} [opts.match]    from buildMatch()
 * @param {object} [opts.project]  a $project stage body
 */
function sortedPipeline({ match = {}, project } = {}) {
  const stages = [
    { $match: match },
    { $addFields: { [SORT_KEY]: { $ifNull: ['$publishedAt', '$createdAt'] } } },
    { $sort: { [SORT_KEY]: -1, _id: 1 } },
  ];

  if (project) stages.push({ $project: project });

  // Must run AFTER $project: an exclusion projection such as
  // `{ content: 0 }` keeps _sortDate, and leaking an internal sort key
  // into the API response would make it look like a real field.
  // A no-op when $project was an inclusion, which already dropped it.
  stages.push({ $unset: SORT_KEY });

  return stages;
}

module.exports = { SORT_KEY, escapeRegex, buildMatch, sortedPipeline };
