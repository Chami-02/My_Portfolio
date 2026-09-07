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
// ⚠️ UPDATED IN PF-104: stamping `publishedAt` at publish time IS now
// built (`applyDerivedFields` in models/Blog.js), because a draft created
// in January and published in September otherwise fell back to its
// January `createdAt` and appeared as an old post the moment it went
// live. But it was NEVER an alternative to this fallback and the earlier
// note here said so: every row already in the database still holds
// `null` until it is next saved, so reads need `$ifNull` regardless.
// Both mechanisms, deliberately — the stamp fixes new posts going
// forward, the fallback covers everything written before it existed.
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
 * Tag AND query. The query is a case-insensitive SUBSTRING match.
 *
 * ── ⚠️ WIDENED IN PF-104 (owner-requested 2026-09-06) ─────────────────
 * The query now covers the POST'S WHOLE TEXT — title, excerpt, tags AND
 * every section's heading, paragraphs and bullets.
 *
 * This REVERSES PF-96, which deliberately matched the design's own filter
 * (`docs/design/Blog.dc.html:537-546`):
 *
 *     return (p.title + ' ' + p.excerpt + ' ' + p.tags.join(' '))
 *              .toLowerCase().includes(q);
 *
 * — title, excerpt and tags only, on the reasoning that the design is the
 * authority for behaviour a visitor can observe. The owner's requirement
 * is that any word belonging to a post finds it, which the prototype's
 * own placeholder ("Search posts, tags, tools…") already implies. Do NOT
 * narrow this back to match the frozen export.
 *
 * `sections.body` and `sections.bullets` are arrays INSIDE an array of
 * subdocuments; a dotted path reaches every element of every section, and
 * an `$or` arm on an array field matches if ANY element matches. So one
 * regex per path covers all of them.
 *
 * The deprecated `content` string is deliberately NOT searched. No row in
 * this database has ever carried one (models/Blog.js marks it awaiting
 * its own removal ticket), so an arm for it would be dead weight.
 *
 * ── COST, STATED RATHER THAN DISCOVERED LATER ────────────────────────
 * There is no text index, and none on `sections` — this is a collection
 * scan running a regex per array element. Irrelevant at four posts, the
 * same reasoning as the in-memory `$sort` above. If this collection grows
 * past a few hundred posts, move to a `$text` index (which also changes
 * the semantics from substring to whole-word stemming — a visible
 * behaviour change, not a drop-in).
 *
 * @param {object}  opts
 * @param {boolean} opts.publishedOnly  false for the admin list
 * @param {string}  [opts.q]            search term
 * @param {string}  [opts.tag]          single tag; 'All' means no filter
 */
function buildMatch({ publishedOnly = true, q, tag } = {}) {
  const match = {};
  if (publishedOnly) match.published = true;

  // ── ⚠️ MULTI-TAG SINCE PF-105 (owner-requested 2026-09-06) ───────────
  // `tag` arrives as a STRING for one tag and an ARRAY for several —
  // `?tag=Docker&tag=DevOps`, which Express's query parser turns into
  // `['Docker', 'DevOps']`.
  //
  // ⚠️ THE OLD CODE FAILED SILENTLY ON AN ARRAY. It read
  // `typeof tag === 'string' ? tag.trim() : ''`, so an array produced the
  // empty string, the whole block was skipped, and the request came back
  // UNFILTERED with a 200. Measured before this change:
  // `?tag=Docker&tag=DevOps` returned all 4 posts. That is why every layer
  // — serializer, params, page — had to move in one ticket: a half-done
  // version reads as "the tag filter stopped working", not as an error.
  const tagList = (Array.isArray(tag) ? tag : [tag])
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim())
    // 'All' is the design's own "no filter" chip, and it is sent as a real
    // query value rather than omitted — so it must be understood here.
    .filter((t) => t && t.toLowerCase() !== 'all');

  if (tagList.length) {
    // AND, not OR: selecting Docker + DevOps means a post carrying BOTH.
    // Owner's decision, and the numbers behind it are in
    // .claude/locked-decisions.md — on four posts OR returns 3 of 4 for
    // that pair, which barely filters at all.
    //
    // ⚠️ `$and` of one condition per tag, NOT `$all`. `$all` reads shorter
    // but its behaviour with REGEX elements is inconsistent across MongoDB
    // versions, and each arm has to stay a regex to keep PF-96's property:
    // anchored, so selecting "React" does not also match "React Native",
    // and case-insensitive, so a tag arriving from a hand-typed URL does
    // not have to match the pool's casing exactly.
    //
    // ⚠️ `$and` (tags) and `$or` (the `q` search below) are sibling
    // top-level keys and Mongo ANDs them, so a query AND every tag must
    // hold. Verified with a combined request, not assumed.
    match.$and = tagList.map((t) => ({
      tags: new RegExp(`^${escapeRegex(t)}$`, 'i'),
    }));
  }

  const query = typeof q === 'string' ? q.trim() : '';
  if (query) {
    const rx = new RegExp(escapeRegex(query), 'i');
    // On an array field, an $or arm matches if ANY element matches, which
    // is what makes `tags: rx` behave like the design's `tags.join(' ')`
    // and what makes the three `sections.*` arms cover every section.
    match.$or = [
      { title:              rx },
      { excerpt:            rx },
      { tags:               rx },
      { 'sections.heading': rx },
      { 'sections.body':    rx },
      { 'sections.bullets': rx },
    ];
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
