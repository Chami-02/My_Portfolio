// backend/src/__tests__/005-blog-publish-dates.test.js
//
// PF-95. The prototype's four publish dates and reading times are written
// down twice — once in seed.js (for a fresh database) and once in
// migration 005 (for an existing one). Two copies of one fact drift, and
// the drift is invisible: each file reads fine on its own, and the only
// symptom is a freshly seeded environment disagreeing with production.
// These tests pin the two together. Same shape as 004's test.
//
// ⚠️ THIS FILE IS NOT PROOF THE FIX WORKS. It only confirms that seed.js's
// SOURCE TEXT matches TARGET_DATA — it never touches a database, never
// calls insertMany(), and never runs a hook. A migration test of exactly
// this shape would stay green even if the seeded value were silently
// overwritten before it reached Mongo, which is precisely the bug PF-95
// exists to fix. `blogReadingTime.test.js` is the file that proves the
// mechanism, by exercising the real hooks.

const { readFileSync } = require('fs');
const { resolve } = require('path');
const { TARGET_DATA } = require('../migrations/005-blog-publish-dates');

// seed.js calls seed() at module scope, so it cannot be require()d from a
// test without connecting to a database and wiping five collections.
// Read as text and parse out the object literals this test cares about.
const seedSrc = readFileSync(resolve(__dirname, '../seed.js'), 'utf8');

/**
 * The slice of seed.js belonging to one post — from its unique `title:`
 * literal up to the start of the next post's, or to the end of the
 * BLOG_POSTS array for the last one.
 *
 * Bounded deliberately rather than searched whole-file: an unbounded
 * regex would happily match a `publishedAt` belonging to the NEXT post
 * and report a pass for a post that has none.
 */
function postBlock(title) {
  const marker = `title: '${title}',`;
  const start = seedSrc.indexOf(marker);
  if (start === -1) return null;

  const nextTitle = seedSrc.indexOf("    title: '", start + marker.length);
  const arrayEnd = seedSrc.indexOf('\n];', start);
  const end =
    nextTitle !== -1 && nextTitle < arrayEnd ? nextTitle : arrayEnd;

  return seedSrc.slice(start, end === -1 ? undefined : end);
}

describe('Migration 005 — blog publish dates and reading times (PF-95)', () => {
  const titles = Object.keys(TARGET_DATA);

  test('TARGET_DATA covers exactly the prototype\'s four posts', () => {
    expect(titles).toHaveLength(4);
  });

  // The scanner's own self-check: a block finder that silently returns
  // null for everything would make every test below pass vacuously by
  // never reaching an assertion about content.
  test.each(titles)('seed.js contains a post block for "%s"', (title) => {
    const block = postBlock(title);
    expect(block).not.toBeNull();
    expect(block.length).toBeGreaterThan(100);
  });

  test.each(titles)('seed.js sets the migration\'s publishedAt for "%s"', (title) => {
    const block = postBlock(title);
    const m = block.match(/publishedAt:\s*new Date\('([^']+)'\)/);
    expect(m).not.toBeNull();
    expect(new Date(m[1]).getTime()).toBe(TARGET_DATA[title].publishedAt.getTime());
  });

  // ── REPLACED BY PF-103 ────────────────────────────────────────────
  // This used to assert that seed.js declared the migration's own
  // readingTimeMinutes for each post, and that the four were [6, 7, 4, 5].
  // Both are now WRONG BY DESIGN. Migration 006 retires those figures:
  // measured with the model's 200-wpm formula the real bodies are
  // 158/123/89/64 words, so every post computes to 1 minute, and seed.js
  // declares no reading time at all.
  //
  // The direction is flipped rather than the assertion deleted — an
  // absence that nothing checks is how a value creeps back in. TARGET_DATA
  // still holds 6/7/4/5 because migration 005 RAN with them and a migration
  // that has run is frozen; 006 is what changes them.
  test.each(titles)('seed.js declares NO readingTimeMinutes for "%s"', (title) => {
    expect(postBlock(title)).not.toMatch(/readingTimeMinutes:\s*\d+/);
  });

  test('005 still records the figures it actually wrote: 6, 7, 4, 5', () => {
    // Not the current truth — the historical one. Editing this to match
    // today's computed values would rewrite what a migration that has run
    // against production did, which is exactly what must not happen.
    expect(titles.map((t) => TARGET_DATA[t].readingTimeMinutes)).toEqual([6, 7, 4, 5]);
  });

  test('publish months match the prototype exactly: JUL, JUN, MAY, APR 2026', () => {
    const months = titles.map((t) =>
      TARGET_DATA[t].publishedAt
        .toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
        .toUpperCase()
    );
    expect(months).toEqual(['JUL 2026', 'JUN 2026', 'MAY 2026', 'APR 2026']);
  });

  test('the four dates are strictly descending, matching the design order', () => {
    const times = titles.map((t) => TARGET_DATA[t].publishedAt.getTime());
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeLessThan(times[i - 1]);
    }
  });

  // Guards the header comment. The original wording
  // ("readingTimeMinutes — calculated from `sections` by the same hook")
  // is what let PF-95's bug survive: it names one hook where there are two.
  test('seed.js does not describe readingTimeMinutes with the old single-hook wording', () => {
    expect(seedSrc).not.toMatch(/readingTimeMinutes\s+— calculated from/);
  });

  // PF-103: seed.js's header must still EXPLAIN the absence, not just have
  // one. A silent removal reads as an oversight and invites a re-add.
  test('seed.js says why it no longer declares a reading time', () => {
    expect(seedSrc).toMatch(/readingTimeMinutes` is NO LONGER set here/);
  });
});
