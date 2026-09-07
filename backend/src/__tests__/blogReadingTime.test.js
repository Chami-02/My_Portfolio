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

describe('Blog reading time — derivation (PF-95, reshaped by PF-103)', () => {
  test('computes readingTimeMinutes when no override is set', async () => {
    const post = makePost();
    await post.validate();
    expect(post.readingTimeMinutes).toBe(3);
  });

  test('an override wins over the word count', async () => {
    // 6 is deliberately "wrong" by the 200-wpm formula, which gives 3 for
    // this fixture. That disagreement IS the assertion — a fixture where
    // the pinned and computed values coincided could not tell which one
    // the code returned, which is the vacuous-guard trap PF-96 documented.
    const post = makePost({ readingTimeOverride: 6 });
    await post.validate();
    expect(post.readingTimeMinutes).toBe(6);
    expect(post.readingTimeMinutes).not.toBe(3);
  });

  test('⚠️ readingTimeMinutes supplied WITHOUT an override is ignored', async () => {
    // ⚠️ THE BEHAVIOUR CHANGE IN PF-103, and the reason a caller cannot
    // half-migrate. Before PF-103 this returned 6 — an explicitly-supplied
    // readingTimeMinutes was how seed.js pinned the design's figures.
    // It is now a derived field with exactly one writer, so a client that
    // sets it is overwritten rather than obeyed.
    const post = makePost({ readingTimeMinutes: 6 });
    await post.validate();
    expect(post.readingTimeMinutes).toBe(3);
  });

  test('recomputes on a genuine content edit', async () => {
    // ⚠️ Modelled with hydrate(), NOT by validating one fresh document
    // twice. hydrate() is Mongoose's documented way to build a document as
    // if it came from the database: modifiedPaths() is empty, exactly like
    // a real find-then-edit-then-save.
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

  test('an edit keeps the pin when one is set', async () => {
    const post = Blog.hydrate({
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'An excerpt for a test post.',
      readingTimeMinutes: 9,
      readingTimeOverride: 9,
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    });

    post.sections = [{ heading: 'Intro', body: [LONGER_BODY], bullets: [] }];
    await post.validate();

    expect(post.readingTimeMinutes).toBe(9);
  });

  test('clearing the pin to null recomputes from the content', async () => {
    // The admin form's "blank the field" path. Sending null rather than
    // omitting the key is what makes un-pinning expressible at all.
    const post = Blog.hydrate({
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'An excerpt for a test post.',
      readingTimeMinutes: 9,
      readingTimeOverride: 9,
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    });

    post.readingTimeOverride = null;
    await post.validate();

    expect(post.readingTimeMinutes).toBe(3);
  });

  test('⚠️ recomputes on a TITLE-ONLY edit, which the old hook did not', async () => {
    // The case PF-103's unconditional derivation fixes. The old condition
    // was `isModified('content') || isModified('sections')`, so a post
    // whose body had drifted out of step with its stored figure — exactly
    // the four seeded posts — kept the stale number through any edit that
    // did not touch sections.
    const post = Blog.hydrate({
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'An excerpt for a test post.',
      readingTimeMinutes: 6,          // the fiction
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    });

    post.title = 'Test Post Renamed';
    await post.validate();

    expect(post.readingTimeMinutes).toBe(3);
  });

  test('an override below 1 is rejected rather than silently floored', async () => {
    const post = makePost({ readingTimeOverride: 0 });
    await expect(post.validate()).rejects.toThrow(/readingTimeOverride/);
  });

  test('readingTimeOverride is a real schema path defaulting to null', () => {
    expect(Blog.schema.path('readingTimeOverride')).toBeDefined();
    expect(Blog.schema.path('readingTimeOverride').instance).toBe('Number');
    expect(Blog.schema.path('readingTimeOverride').defaultValue).toBeNull();
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
  test('honours an override on a raw seed object', () => {
    const raw = {
      title: 'Seeded Post',
      excerpt: 'x',
      readingTimeOverride: 6,
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
  test('an override survives BOTH hooks, in order', async () => {
    const raw = {
      title: 'Seeded Post',
      excerpt: 'x',
      readingTimeOverride: 6,
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

  // ⚠️ The seed path AS IT ACTUALLY IS since PF-103 — seed.js sets no
  // reading time at all. This is the case the four real posts take, so it
  // is asserted rather than left implied by the override tests above.
  test('a seed object with no reading time computes through both hooks', async () => {
    const raw = {
      title: 'Seeded Post',
      excerpt: 'x',
      publishedAt: new Date('2026-07-14T09:00:00.000Z'),
      sections: [{ heading: 'Intro', body: [LONG_BODY], bullets: [] }],
    };
    runInsertManyHook([raw]);
    const doc = new Blog(raw);
    await doc.validate();

    expect(doc.readingTimeMinutes).toBe(3);
    expect(doc.readingTimeOverride).toBeNull();
  });
});
