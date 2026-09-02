// backend/src/__tests__/blog.query.test.js
//
// PF-96 — ordering, `?q=` search, `?tag=` filter, prev/next, and the
// update-hook fix.
//
// ⚠️ WHY A NEW FILE. `blog.test.js` asserted NOTHING about any of these.
// It has no multi-post ordering case at all, so the API was free to
// return posts in any order and stay green — which is exactly how the
// LATEST POST badge came to sit on the third-oldest post.
//
// ⚠️ THE FIXTURE IS THE WHOLE TEST. Every post here is written in ONE
// `insertMany` with a SHARED `createdAt`, and given `publishedAt` values
// whose order DISAGREES with both insertion order and `_id` order. That
// arrangement is the only one in which reading the wrong sort key is
// observable:
//
//   insertion / _id ascending :  Alpha  Bravo  Charlie  Delta
//   publishedAt descending    :  Charlie  Alpha  Delta  Bravo
//
// The frontend's existing guards do NOT have this property — their
// fixture's publishedAt order happens to coincide with its _id order, so
// they pass under either rule. See the PF-96 report.

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');
const app      = require('../app');
const Blog     = require('../models/Blog');
const User     = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin-query@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
};

const section = (heading, paragraph) => ({ heading, body: [paragraph], bullets: [] });

/**
 * publishedAt deliberately out of step with insertion order.
 * Newest → oldest by publishedAt: Charlie, Alpha, Delta, Bravo.
 */
const POSTS = [
  {
    title:       'Alpha post about Docker',
    excerpt:     'An excerpt mentioning containers.',
    tags:        ['Docker', 'DevOps'],
    published:   true,
    publishedAt: new Date('2026-05-01T09:00:00.000Z'),
    sections:    [section('Alpha heading', 'Alpha body text.')],
  },
  {
    title:       'Bravo post about React',
    excerpt:     'An excerpt mentioning components.',
    tags:        ['React'],
    published:   true,
    publishedAt: new Date('2026-02-01T09:00:00.000Z'),
    sections:    [section('Bravo heading', 'Bravo body text.')],
  },
  {
    title:       'Charlie post about Python',
    excerpt:     'An excerpt mentioning Docker in the excerpt only.',
    tags:        ['Python'],
    published:   true,
    publishedAt: new Date('2026-07-01T09:00:00.000Z'),
    sections:    [section('Charlie heading', 'Charlie body text.')],
  },
  {
    title:       'Delta post about Java',
    excerpt:     'An excerpt mentioning servlets.',
    tags:        ['Java', 'React Native'],
    published:   true,
    publishedAt: new Date('2026-03-01T09:00:00.000Z'),
    sections:    [section('Delta heading', 'Delta body text.')],
  },
];

const PUBLISHED_ORDER = ['Charlie', 'Alpha', 'Delta', 'Bravo'];

/** One insertMany, so createdAt is shared exactly as the live seed is. */
const seedPosts = (extra = []) => Blog.insertMany([...POSTS, ...extra]);

/** First word of each title, in response order. */
const names = (res) => res.body.data.map((p) => p.title.split(' ')[0]);

// ══════════════════════════════════════════════════════════════════════
describe('GET /api/blog — ordering', () => {
  it('orders by publishedAt descending, not by createdAt or _id', async () => {
    await seedPosts();

    const res = await request(app).get('/api/blog');

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(PUBLISHED_ORDER);
  });

  it('has a createdAt order that DISAGREES with publish order', async () => {
    // Guards the fixture itself: if the two orders ever coincided, the
    // test above would pass for a component reading either field and
    // would stop meaning anything.
    //
    // ⚠️ This asserted `new Set(stamps).size === 1` in its first draft —
    // that all four share one createdAt. It failed intermittently, and
    // correctly: `insertMany` does NOT guarantee an identical stamp.
    // `.claude/sprint-log.md` measured five fresh batches and three
    // straddled a millisecond boundary. Writing that assertion repeated
    // the exact belief this sprint had already corrected as false, so
    // what is checked now is the property actually needed — the two
    // orders differ — which holds whether the stamps tie or not.
    await seedPosts();

    const byCreated = (await Blog.find({}).sort({ createdAt: -1, _id: 1 }))
      .map((p) => p.title.split(' ')[0]);

    expect(byCreated).not.toEqual(PUBLISHED_ORDER);
  });

  it('falls back to createdAt when publishedAt is null', async () => {
    // The schema default, so this is every post created by the admin
    // panel. A plain `.sort({ publishedAt: -1 })` puts null LAST; the
    // $ifNull fallback must place it by its createdAt instead — which,
    // sharing the batch stamp, ties with the others and resolves on _id.
    await seedPosts([{
      title:       'Echo post with no publish date',
      excerpt:     'An excerpt.',
      tags:        ['Misc'],
      published:   true,
      publishedAt: null,
      sections:    [section('Echo heading', 'Echo body text.')],
    }]);

    const res = await request(app).get('/api/blog');
    const order = names(res);

    // Its createdAt is the batch stamp — NEWER than every publishedAt
    // here (2026-05 at the latest, versus today), so it must sort FIRST.
    expect(order[0]).toBe('Echo');
    expect(order.slice(1)).toEqual(PUBLISHED_ORDER);
  });

  it('breaks a publishedAt tie by _id ascending, which is insertion order', async () => {
    // ⚠️ ADDED IN THE PF-96 RECHECK. Flipping the tiebreak from `_id: 1`
    // to `_id: -1` passed all 34 tests — no fixture had two posts sharing
    // a publish date, so the branch was never reached and its DIRECTION
    // was unverified. That is the live case whenever posts are created
    // without explicit dates: they fall back to a shared insertMany
    // `createdAt` and tie.
    //
    // Ascending is required, not arbitrary: an ObjectId's trailing
    // counter increments within one insertMany, so ascending recovers
    // insertion order — the design's own 01·02·03·04 — and it is what
    // BlogSection.jsx's byRecency() does. Descending would silently
    // reverse the teaser.
    const tied = new Date('2026-08-01T09:00:00.000Z');
    await Blog.insertMany([
      { title: 'Tied first',  excerpt: 'An excerpt.', published: true, publishedAt: tied, sections: [section('H', 'Body.')] },
      { title: 'Tied second', excerpt: 'An excerpt.', published: true, publishedAt: tied, sections: [section('H', 'Body.')] },
      { title: 'Tied third',  excerpt: 'An excerpt.', published: true, publishedAt: tied, sections: [section('H', 'Body.')] },
    ]);

    const res = await request(app).get('/api/blog');

    expect(res.body.data.map((p) => p.title))
      .toEqual(['Tied first', 'Tied second', 'Tied third']);
  });

  it('excludes drafts and full content from the list', async () => {
    await seedPosts([{
      title:     'Foxtrot draft',
      excerpt:   'An excerpt.',
      published: false,
      sections:  [section('Foxtrot heading', 'Foxtrot body text.')],
    }]);

    const res = await request(app).get('/api/blog');

    expect(names(res)).toEqual(PUBLISHED_ORDER);
    expect(res.body.data.every((p) => p.content === undefined)).toBe(true);
  });

  it('does not leak the internal sort key into the response', async () => {
    // `_sortDate` is an implementation detail of the pipeline. Left in,
    // it would read as a real field and PF-98 might well render it.
    await seedPosts();
    const res = await request(app).get('/api/blog');
    expect(res.body.data.every((p) => p._sortDate === undefined)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('GET /api/blog?q= — search', () => {
  it('matches the title, case-insensitively', async () => {
    await seedPosts();
    const res = await request(app).get('/api/blog?q=bravo');
    expect(names(res)).toEqual(['Bravo']);
  });

  it('matches the excerpt as well as the title', async () => {
    // "Docker" is in Alpha's TITLE and in Charlie's EXCERPT only, so a
    // title-only implementation returns one result instead of two.
    await seedPosts();
    const res = await request(app).get('/api/blog?q=docker');
    expect(names(res)).toEqual(['Charlie', 'Alpha']);   // still publish order
  });

  it('matches tags, which is how the design searches "tools"', async () => {
    // "DevOps" appears in NO title and NO excerpt — only in Alpha's tags.
    await seedPosts();
    const res = await request(app).get('/api/blog?q=devops');
    expect(names(res)).toEqual(['Alpha']);
  });

  it('does not match section body text', async () => {
    // Deliberate: the design's filter covers title + excerpt + tags only.
    // Asserted so that widening it later is a visible decision.
    await seedPosts();
    const res = await request(app).get('/api/blog?q=Charlie%20body%20text');
    expect(res.body.data).toHaveLength(0);
  });

  it('treats the term as literal text, not as a regular expression', async () => {
    // A visitor typing `.*` must not match every post, and `c++` must
    // not throw an invalid-quantifier error out of the regex engine.
    await seedPosts();

    const wildcard = await request(app).get('/api/blog?q=.*');
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data).toHaveLength(0);

    const plus = await request(app).get('/api/blog?q=c%2B%2B');
    expect(plus.status).toBe(200);
    expect(plus.body.data).toHaveLength(0);
  });

  it('returns everything for a blank or whitespace-only term', async () => {
    await seedPosts();
    expect(names(await request(app).get('/api/blog?q='))).toEqual(PUBLISHED_ORDER);
    expect(names(await request(app).get('/api/blog?q=%20%20'))).toEqual(PUBLISHED_ORDER);
  });

  it('returns an empty list, not a 404, when nothing matches', async () => {
    // PF-98 renders the design's "Nothing filed under that" empty state
    // off this, so it must be a 200 with zero rows.
    await seedPosts();
    const res = await request(app).get('/api/blog?q=zzzznotfound');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('GET /api/blog?tag= — filter', () => {
  it('returns only posts carrying the tag', async () => {
    await seedPosts();
    const res = await request(app).get('/api/blog?tag=Docker');
    expect(names(res)).toEqual(['Alpha']);
  });

  it('matches a tag exactly, never as a prefix of a longer tag', async () => {
    // Delta carries "React Native"; Bravo carries "React". An unanchored
    // filter would return both for ?tag=React.
    await seedPosts();
    const res = await request(app).get('/api/blog?tag=React');
    expect(names(res)).toEqual(['Bravo']);
  });

  it('is case-insensitive, so a tag from a URL need not match casing', async () => {
    await seedPosts();
    expect(names(await request(app).get('/api/blog?tag=docker'))).toEqual(['Alpha']);
  });

  it('treats the design\'s "All" chip as no filter at all', async () => {
    // Blog.dc.html sends 'All' as a real value rather than omitting it.
    await seedPosts();
    expect(names(await request(app).get('/api/blog?tag=All'))).toEqual(PUBLISHED_ORDER);
  });

  it('combines with the search term rather than replacing it', async () => {
    // Docker matches Alpha (title) and Charlie (excerpt); the Python tag
    // narrows that pair to Charlie alone. An OR would return both.
    await seedPosts();
    const res = await request(app).get('/api/blog?q=docker&tag=Python');
    expect(names(res)).toEqual(['Charlie']);
  });

  it('keeps publish order within a filtered result', async () => {
    await seedPosts();
    const res = await request(app).get('/api/blog?q=post');
    expect(names(res)).toEqual(PUBLISHED_ORDER);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('GET /api/blog/:slug — prev/next', () => {
  const bySlug = async (name) => {
    const post = await Blog.findOne({ title: new RegExp(`^${name}`) });
    const res  = await request(app).get(`/api/blog/${post.slug}`);
    return res;
  };

  it('returns the post alongside its neighbours', async () => {
    await seedPosts();
    const res = await bySlug('Alpha');

    expect(res.status).toBe(200);
    expect(res.body.data.post.title).toMatch(/^Alpha/);
    // Publish order is Charlie, Alpha, Delta, Bravo — so Alpha sits
    // between Charlie (newer) and Delta (older).
    expect(res.body.data.prev.title).toMatch(/^Charlie/);
    expect(res.body.data.next.title).toMatch(/^Delta/);
  });

  it('walks publish order, not insertion order', async () => {
    // Under the OLD createdAt/_id rule Alpha's neighbours would have been
    // nothing-before and Bravo-after. This is the discriminating case.
    await seedPosts();
    const res = await bySlug('Alpha');
    expect(res.body.data.next.title).not.toMatch(/^Bravo/);
  });

  it('wraps around at both ends, as the design does', async () => {
    await seedPosts();

    const newest = await bySlug('Charlie');   // first in publish order
    expect(newest.body.data.prev.title).toMatch(/^Bravo/);   // wraps to oldest

    const oldest = await bySlug('Bravo');     // last in publish order
    expect(oldest.body.data.next.title).toMatch(/^Charlie/); // wraps to newest
  });

  it('returns only a slug and title for each neighbour', async () => {
    await seedPosts();
    const res = await bySlug('Alpha');
    expect(Object.keys(res.body.data.prev).sort()).toEqual(['slug', 'title']);
  });

  it('ignores an active search or tag filter', async () => {
    // The design's step() walks POSTS, not filtered(). Reading a post
    // reached through a filter must still offer the whole archive.
    await seedPosts();
    const post = await Blog.findOne({ title: /^Alpha/ });
    const res  = await request(app).get(`/api/blog/${post.slug}?tag=Docker&q=docker`);
    expect(res.body.data.prev.title).toMatch(/^Charlie/);
    expect(res.body.data.next.title).toMatch(/^Delta/);
  });

  it('skips drafts when choosing neighbours', async () => {
    await seedPosts([{
      title:       'Golf draft between Charlie and Alpha',
      excerpt:     'An excerpt.',
      published:   false,
      publishedAt: new Date('2026-06-01T09:00:00.000Z'),
      sections:    [section('Golf heading', 'Golf body text.')],
    }]);

    const res = await bySlug('Alpha');
    expect(res.body.data.prev.title).toMatch(/^Charlie/);
  });

  it('returns null neighbours for the only post, rather than itself', async () => {
    // Wrapping a single post would make it its own prev AND next — a
    // link that looks like navigation and does nothing.
    await Blog.create({
      title:     'Solo post',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Solo heading', 'Solo body text.')],
    });

    const res = await bySlug('Solo');
    expect(res.body.data.prev).toBeNull();
    expect(res.body.data.next).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('PUT /api/blog/:id — document middleware now runs', () => {
  it('regenerates the slug when the title changes', async () => {
    // The headline defect. findByIdAndUpdate runs QUERY middleware, so
    // pre('validate') never fired and the slug kept the old title.
    const post = await Blog.create({
      title:     'The original title',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'Body text.')],
    });
    expect(post.slug).toBe('the-original-title');

    const res = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({ title: 'A completely different title' });

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('a-completely-different-title');
  });

  it('recomputes the reading time when sections change', async () => {
    const post = await Blog.create({
      title:     'Reading time post',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'One short sentence.')],
    });
    expect(post.readingTimeMinutes).toBe(1);

    const long = 'word '.repeat(1000).trim();
    const res  = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({ sections: [section('Heading', long)] });

    expect(res.status).toBe(200);
    expect(res.body.data.readingTimeMinutes).toBeGreaterThan(1);
  });

  it('keeps an explicitly supplied reading time on the same request', async () => {
    // PF-95's rule, which must survive the switch to save(): an edit that
    // changes sections AND states a reading time keeps the stated one.
    const post = await Blog.create({
      title:     'Explicit reading time post',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'One short sentence.')],
    });

    const res = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({
        sections:           [section('Heading', 'word '.repeat(1000).trim())],
        readingTimeMinutes: 9,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.readingTimeMinutes).toBe(9);
  });

  it('leaves the slug alone when the title is untouched', async () => {
    const post = await Blog.create({
      title:     'Stable title',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'Body text.')],
    });

    const res = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({ excerpt: 'A revised excerpt.' });

    expect(res.body.data.slug).toBe('stable-title');
    expect(res.body.data.excerpt).toBe('A revised excerpt.');
  });

  it('accepts a whole post object round-tripped from a GET', async () => {
    // The admin panel edits a fetched post and PUTs it back, so the body
    // carries _id and the timestamps. Assigning _id throws in Mongoose
    // unless it is stripped.
    const post = await Blog.create({
      title:     'Round trip post',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'Body text.')],
    });

    const fetched = (await request(app).get(`/api/blog/${post.slug}`)).body.data.post;

    const res = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({ ...fetched, title: 'Round trip post edited' });

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('round-trip-post-edited');
  });

  it('returns 409 when a rename collides with another post\'s slug', async () => {
    // save() surfaces the duplicate-key error that findByIdAndUpdate
    // would have raised as an unhandled 500.
    await Blog.init();
    await Blog.create({
      title:     'Occupied title',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'Body text.')],
    });
    const other = await Blog.create({
      title:     'Some other title',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'Body text.')],
    });

    const res = await request(app)
      .put(`/api/blog/${other._id}`)
      .set(await authHeader())
      .send({ title: 'Occupied title' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('returns 400 with a readable message when an edit is invalid', async () => {
    const post = await Blog.create({
      title:     'Validation post',
      excerpt:   'An excerpt.',
      published: true,
      sections:  [section('Heading', 'Body text.')],
    });

    const res = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/i);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe('GET /api/blog/admin/all — same ordering as the public list', () => {
  it('orders drafts and published posts together by publish date', async () => {
    await seedPosts();
    const res = await request(app)
      .get('/api/blog/admin/all')
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(PUBLISHED_ORDER);
  });

  it('accepts the same q and tag parameters', async () => {
    await seedPosts();
    const res = await request(app)
      .get('/api/blog/admin/all?tag=Python')
      .set(await authHeader());

    expect(names(res)).toEqual(['Charlie']);
  });
});

// keep mongoose quiet about an open handle if a test throws early
afterAll(async () => { if (mongoose.connection.readyState !== 0) return; });
