// backend/src/__tests__/blogReadingTime.test.js
//
// PF-95. `005-blog-publish-dates.test.js` pins seed.js's source text to
// the migration's table; it proves nothing about whether those values
// survive a real write. THIS file is the one that exercises the mechanism
// — Blog.js's `pre('validate')` and `pre('insertMany')` hooks, against the
// real schema.
//
// No database connection: `doc.validate()` and the insertMany hook both
// run in-process, so this file is not subject to the Atlas-timeout flake
// class documented in CLAUDE.md.
//
// ⚠️ Fixtures use `heading`, not the prototype's `h`. `h` is
// docs/design/Blog.dc.html's own POSTS key; the real `sectionSchema` field
// is `heading` and it is required. Copying the design tool's JS key names
// into backend code is the "prototype structure as a second source of
// truth" trap CLAUDE.md warns about.

const mongoose = require('mongoose');
const Blog = require('../models/Blog');

/** ~400 words → ceil(401/200) = 3 minutes at the model's 200 wpm. */
const LONG_BODY = Array(400).fill('word').join(' ');
const LONGER_BODY = Array(4000).fill('word').join(' ');

function makePost(overrides = {}) {
  return new Blog({
    title: 'Test Post',
    excerpt: 'An excerpt for a test post.',
    sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    ...overrides,
  });
}

/**
 * The registered `pre('insertMany')` hook function itself.
 *
 * ⚠️ There is no way to reach this path through a constructed Document —
 * and that distinction is the whole point of the bullets guard below.
 * `new Blog({...})` applies `sectionSchema`'s own `default: []` at
 * construction, so a section written without a `bullets` key arrives at
 * the hook already carrying `[]`. `pre('insertMany')` runs BEFORE that
 * conversion, on raw POJOs, which is the only place the missing key is
 * actually observable.
 *
 * A test for that guard written against `new Blog(...)` passes against
 * UNFIXED code — verified, not assumed. This handle is what makes it a
 * real guard rather than a vacuous one.
 */
function runInsertManyHook(docs) {
  const pres = Blog.schema.s.hooks._pres.get('insertMany');
  expect(pres).toHaveLength(1); // fails loudly if Mongoose's internals move
  pres[0].fn.call(Blog, docs);
}

describe('Blog reading time — the auto-compute fallback (PF-95)', () => {
  test('computes readingTimeMinutes when none is supplied', async () => {
    const post = makePost();
    await post.validate();
    expect(post.readingTimeMinutes).toBe(3);
  });

  test('keeps an explicitly supplied readingTimeMinutes on a new document', async () => {
    // The test that fails against the pre-PF-95 hook. Measured before the
    // fix: this came back as 3, the computed value, silently discarding
    // the 6 the caller passed.
    const post = makePost({ readingTimeMinutes: 6 });
    await post.validate();
    expect(post.readingTimeMinutes).toBe(6);
  });

  test('the explicit value wins even when it disagrees with the word count', async () => {
    // 6 is deliberately "wrong" by the 200-wpm formula, which gives 3 for
    // this fixture. An author's own stated reading time outranks the
    // estimate — that is the entire reason seed.js can carry the
    // prototype's 6/7/4/5.
    const post = makePost({ readingTimeMinutes: 6 });
    await post.validate();
    expect(post.readingTimeMinutes).toBe(6);
    expect(post.readingTimeMinutes).not.toBe(3);
  });

  test('recomputes on a genuine content edit when no override accompanies it', async () => {
    // ⚠️ Modelled with hydrate(), NOT by validating one fresh document
    // twice. A new document's `readingTimeMinutes` is marked modified by
    // the hook's OWN first write, so a second validate on the same unsaved
    // document correctly declines to recompute — that is not the edit path
    // and asserting against it would fail correct code. hydrate() is
    // Mongoose's documented way to build a document as if it came from the
    // database: modifiedPaths() is empty, exactly like a real
    // find-then-edit-then-save.
    const post = Blog.hydrate({
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'An excerpt for a test post.',
      readingTimeMinutes: 3,
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    });
    expect(post.modifiedPaths()).toEqual([]);

    post.sections = [{ heading: 'Intro', body: [LONGER_BODY], bullets: [] }];
    await post.validate();

    expect(post.readingTimeMinutes).toBe(21);
  });

  test('an edit that supplies its own reading time is not overwritten', async () => {
    const post = Blog.hydrate({
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'An excerpt for a test post.',
      readingTimeMinutes: 3,
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    });

    post.sections = [{ heading: 'Intro', body: [LONGER_BODY], bullets: [] }];
    post.readingTimeMinutes = 9;
    await post.validate();

    expect(post.readingTimeMinutes).toBe(9);
  });
});

describe('Blog publishedAt (PF-95)', () => {
  test('defaults to null and does not block validation', async () => {
    const post = makePost();
    await post.validate();
    expect(post.publishedAt).toBeNull();
  });

  test('holds an explicit Date when supplied', async () => {
    const date = new Date('2026-07-14T09:00:00.000Z');
    const post = makePost({ publishedAt: date });
    await post.validate();
    expect(post.publishedAt.getTime()).toBe(date.getTime());
  });

  test('is a real schema path, not an incidentally-stored key', () => {
    expect(Blog.schema.path('publishedAt')).toBeDefined();
    expect(Blog.schema.path('publishedAt').instance).toBe('Date');
  });
});

describe('Blog pre(insertMany) — the seed path (PF-95)', () => {
  test('leaves an explicitly supplied readingTimeMinutes alone', () => {
    const raw = {
      title: 'Seeded Post',
      excerpt: 'x',
      readingTimeMinutes: 6,
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    };
    runInsertManyHook([raw]);
    expect(raw.readingTimeMinutes).toBe(6);
  });

  test('computes one when the seed supplies none', () => {
    const raw = {
      title: 'Seeded Post',
      excerpt: 'x',
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    };
    runInsertManyHook([raw]);
    expect(raw.readingTimeMinutes).toBe(3);
  });

  test('a section with no bullets key does not throw', () => {
    // Reproduced against the real hook before the guard was added:
    // "TypeError: section.bullets is not iterable". Latent rather than
    // live, because all four current seed posts write `bullets: []`
    // explicitly — a future one that omits the key would have crashed the
    // seed.
    const raw = {
      title: 'No Bullets Key',
      excerpt: 'x',
      sections: [{ heading: 'Intro', body: ['Some body text here.'] }],
    };
    expect(() => runInsertManyHook([raw])).not.toThrow();
    expect(raw.readingTimeMinutes).toBe(1);
  });

  test('a section with no body key does not throw either', () => {
    const raw = {
      title: 'No Body Key',
      excerpt: 'x',
      sections: [{ heading: 'Intro', bullets: ['A bullet.'] }],
    };
    expect(() => runInsertManyHook([raw])).not.toThrow();
    expect(raw.readingTimeMinutes).toBe(1);
  });

  // The full seed path is both hooks in sequence: pre('insertMany') on the
  // raw POJO, then `new ThisModel(doc)` + $validate() firing
  // pre('validate') (mongoose/lib/model.js:3055, 3085-3096 →
  // document.js:2972 → document.js:2765-2769). Neither hook alone is the
  // contract — the bug lived in the handoff between them.
  test('an explicit reading time survives BOTH hooks, in order', async () => {
    const raw = {
      title: 'Seeded Post',
      excerpt: 'x',
      readingTimeMinutes: 6,
      publishedAt: new Date('2026-07-14T09:00:00.000Z'),
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    };
    runInsertManyHook([raw]);
    const doc = new Blog(raw);
    await doc.validate();

    expect(doc.readingTimeMinutes).toBe(6);
    expect(doc.publishedAt.getTime()).toBe(new Date('2026-07-14T09:00:00.000Z').getTime());
    expect(doc.slug).toBe('seeded-post');
  });
});
