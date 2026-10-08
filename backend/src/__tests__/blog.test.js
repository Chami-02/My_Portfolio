const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app     = require('../app');
const Blog    = require('../models/Blog');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const PUBLISHED_POST = {
  title:     'Published Test Post',
  excerpt:   'A short excerpt for a published post.',
  content:   'This is enough content for a published test post.',
  tags:      ['testing'],
  published: true,
};

const DRAFT_POST = {
  title:     'Draft Test Post',
  excerpt:   'A short excerpt for a draft post.',
  content:   'This is enough content for a draft test post.',
  published: false,
};

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

describe('GET /api/blog', () => {
  it('returns only published posts', async () => {
    await Blog.create(PUBLISHED_POST);
    await Blog.create(DRAFT_POST);

    const res = await request(app).get('/api/blog');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe(PUBLISHED_POST.title);
    expect(res.body.data[0].content).toBeUndefined();
  });
});

describe('GET /api/blog/:slug', () => {
  it('returns a published post by slug', async () => {
    const post = await Blog.create(PUBLISHED_POST);

    const res = await request(app).get(`/api/blog/${post.slug}`);

    expect(res.status).toBe(200);
    // ⚠️ PF-96 changed this shape: `data` is now the compound
    // { post, prev, next } the reading view needs, not the bare post.
    expect(res.body.data.post.title).toBe(PUBLISHED_POST.title);
    expect(res.body.data.post.content).toBeDefined();
  });

  it('returns 404 for draft posts', async () => {
    const post = await Blog.create(DRAFT_POST);

    const res = await request(app).get(`/api/blog/${post.slug}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/blog/admin/all', () => {
  it('returns draft and published posts for an authenticated admin', async () => {
    await Blog.create(PUBLISHED_POST);
    await Blog.create(DRAFT_POST);

    const res = await request(app)
      .get('/api/blog/admin/all')
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((post) => post.content === undefined)).toBe(true);
  });
});

describe('POST /api/blog', () => {
  it('creates a post when authenticated', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set(await authHeader())
      .send(PUBLISHED_POST);

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('published-test-post');
  });

  it('returns 409 for duplicate blog titles', async () => {
    await Blog.init();
    await Blog.create(PUBLISHED_POST);

    const res = await request(app)
      .post('/api/blog')
      .set(await authHeader())
      .send(PUBLISHED_POST);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ── PF-97 ────────────────────────────────────────────────────────────
  // `blogRules` required Phase 1's `content`, so the shape every post has
  // actually had since PF-59 was rejected outright. These pin the rule to
  // "a post needs A body" rather than "a post needs THAT field".
  describe('body validation (PF-97)', () => {

    it('creates a sections-only post — the shape the admin panel sends', async () => {
      const res = await request(app)
        .post('/api/blog')
        .set(await authHeader())
        .send({
          title:    'Sections Only Post',
          excerpt:  'A post whose body is sections, with no content field.',
          sections: [
            { heading: 'Introduction', body: ['A paragraph of real text.'], bullets: [] },
            { heading: 'Details',      body: [], bullets: ['First point', 'Second point'] },
          ],
          published: true,
        });

      // Before PF-97 this was 400 "Blog content is required".
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('sections-only-post');
      expect(res.body.data.sections).toHaveLength(2);
      // The derived fields still run on this path.
      expect(res.body.data.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it('still accepts a content-only post while the field exists', async () => {
      const res = await request(app)
        .post('/api/blog')
        .set(await authHeader())
        .send({
          title:   'Legacy Content Post',
          excerpt: 'A post carrying the deprecated flat content field.',
          content: 'Some legacy markdown body text.',
        });

      expect(res.status).toBe(201);
    });

    it('rejects a post with neither sections nor content', async () => {
      const res = await request(app)
        .post('/api/blog')
        .set(await authHeader())
        // PF-115: `published: true` — without it this is a DRAFT, which may
        // now be bodyless (see the drafts block below).
        .send({ title: 'Bodyless Post', excerpt: 'This post has no body at all.', published: true });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/needs a body/i);
    });

    it('rejects an empty sections array as no body', async () => {
      const res = await request(app)
        .post('/api/blog')
        .set(await authHeader())
        .send({ title: 'Empty Sections', excerpt: 'Sections present but empty.', sections: [], published: true });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/needs a body/i);
    });

    // The model's own sectionSchema.pre('validate') owns this rule; the
    // assertion is that it reaches the client as a readable 400 rather
    // than a 500, which is what makes a second copy in blogRules
    // unnecessary.
    it('rejects a section with neither paragraphs nor bullets, as a 400', async () => {
      const res = await request(app)
        .post('/api/blog')
        .set(await authHeader())
        .send({
          title:    'Hollow Section Post',
          excerpt:  'One section that carries no text of any kind.',
          sections: [{ heading: 'Empty', body: [], bullets: [] }],
          published: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one paragraph or bullet/i);
    });

    // Pins the middleware ORDER. With `blogRules, validate` ahead of
    // `protect`, this returned 400 and described the schema to a caller
    // holding no token at all.
    it('answers 401, not 400, when an unauthenticated request sends a bad body', async () => {
      const res = await request(app)
        .post('/api/blog')
        .send({ title: '', excerpt: '' });

      expect(res.status).toBe(401);
    });
  });
});

describe('PUT /api/blog/:id', () => {
  it('updates a post when authenticated', async () => {
    const post = await Blog.create(DRAFT_POST);

    const res = await request(app)
      .put(`/api/blog/${post._id}`)
      .set(await authHeader())
      .send({ title: 'Updated Blog Post' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Blog Post');
  });

  it('returns 404 when updating a missing post', async () => {
    const res = await request(app)
      .put('/api/blog/000000000000000000000000')
      .set(await authHeader())
      .send({ title: 'Updated Blog Post' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when updating an invalid post id', async () => {
    const res = await request(app)
      .put('/api/blog/not-valid-id')
      .set(await authHeader())
      .send({ title: 'Updated Blog Post' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/blog/:id/publish', () => {
  it('toggles a post between draft and published', async () => {
    const post = await Blog.create(DRAFT_POST);

    const publishRes = await request(app)
      .patch(`/api/blog/${post._id}/publish`)
      .set(await authHeader());

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.published).toBe(true);
    expect(publishRes.body.message).toMatch(/published/i);

    const draftRes = await request(app)
      .patch(`/api/blog/${post._id}/publish`)
      .set(await authHeader());

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.data.published).toBe(false);
    expect(draftRes.body.message).toMatch(/draft/i);
  });

  it('returns 404 when toggling a missing post', async () => {
    const res = await request(app)
      .patch('/api/blog/000000000000000000000000/publish')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });

  // ── PF-104 ──────────────────────────────────────────────────────────
  // THE DEFECT: nothing on the server ever wrote `publishedAt`. This
  // route flipped only the boolean, so a draft created in January and
  // published in September kept null and the list sort fell back to its
  // January `createdAt` — it appeared as an old post the moment it went
  // live, below everything published in between.
  it('stamps publishedAt the first time a post is published', async () => {
    const post = await Blog.create(DRAFT_POST);
    expect(post.publishedAt).toBeNull();

    const before = Date.now();
    const res = await request(app)
      .patch(`/api/blog/${post._id}/publish`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.publishedAt).not.toBeNull();
    // A real "now", not some other date the code happened to have around.
    const stamped = new Date(res.body.data.publishedAt).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before - 1000);
    expect(stamped).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('keeps the ORIGINAL publish date across unpublish and republish', async () => {
    // Deliberate: a post that briefly returns to draft for an edit must
    // not jump to the top of the list when it comes back. Clearing the
    // stamp on unpublish would do exactly that.
    const post = await Blog.create(DRAFT_POST);

    const first = (await request(app)
      .patch(`/api/blog/${post._id}/publish`)
      .set(await authHeader())).body.data.publishedAt;

    await request(app).patch(`/api/blog/${post._id}/publish`).set(await authHeader());
    const again = (await request(app)
      .patch(`/api/blog/${post._id}/publish`)
      .set(await authHeader())).body.data.publishedAt;

    expect(again).toBe(first);
  });

  it('does not overwrite a publish date the post already carries', async () => {
    // seed.js and migration 005 write explicit dates. `== null` is what
    // keeps those four transcribed dates from being clobbered on any save.
    const explicit = new Date('2026-07-14T09:00:00.000Z');
    const post = await Blog.create({ ...DRAFT_POST, publishedAt: explicit });

    const res = await request(app)
      .patch(`/api/blog/${post._id}/publish`)
      .set(await authHeader());

    expect(new Date(res.body.data.publishedAt).getTime()).toBe(explicit.getTime());
  });

  it('stamps publishedAt on a post created as published outright', async () => {
    // The other write path: the admin panel's "Publish immediately" box,
    // which never goes through this route at all.
    const post = await Blog.create({ ...DRAFT_POST, published: true });
    expect(post.publishedAt).not.toBeNull();
  });

  it('leaves a draft unstamped', async () => {
    // The control. A stamp that fired unconditionally would satisfy every
    // assertion above while being plainly wrong.
    const post = await Blog.create(DRAFT_POST);
    expect(post.published).toBe(false);
    expect(post.publishedAt).toBeNull();
  });
});

describe('DELETE /api/blog/:id', () => {
  it('deletes a post when authenticated', async () => {
    const post = await Blog.create(DRAFT_POST);

    const res = await request(app)
      .delete(`/api/blog/${post._id}`)
      .set(await authHeader());

    expect(res.status).toBe(204);
    await expect(Blog.findById(post._id)).resolves.toBeNull();
  });

  it('returns 404 when deleting a missing post', async () => {
    const res = await request(app)
      .delete('/api/blog/000000000000000000000000')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });

  it('returns 400 when deleting an invalid post id', async () => {
    const res = await request(app)
      .delete('/api/blog/not-valid-id')
      .set(await authHeader());

    expect(res.status).toBe(400);
  });
});

// ── PF-115 — a DRAFT needs only a title (owner, 2026-10-03) ────────────────
// Publishing it later demands everything, on EVERY path that can publish:
// the PUT the editor sends and the list row's PATCH /publish.
describe('drafts (PF-115)', () => {
  const TITLE_ONLY = { title: 'Half Written Idea', published: false };
  const COMPLETE = {
    excerpt:  'Now it has an excerpt.',
    sections: [{ heading: 'Intro', body: ['A real paragraph.'], bullets: [] }],
  };

  it('creates a title-only draft', async () => {
    const res = await request(app).post('/api/blog').set(await authHeader()).send(TITLE_ONLY);

    expect(res.status).toBe(201);
    expect(res.body.data.published).toBe(false);
    expect(res.body.data.slug).toBe('half-written-idea');
  });

  it('keeps a half-written section in a draft — heading with no text, text with no heading', async () => {
    const res = await request(app).post('/api/blog').set(await authHeader()).send({
      ...TITLE_ONLY,
      sections: [
        { heading: 'Heading only', body: [], bullets: [] },
        { heading: '', body: ['Text, no heading yet.'], bullets: [] },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.sections).toHaveLength(2);
  });

  it('still requires a title for a draft', async () => {
    const res = await request(app).post('/api/blog').set(await authHeader())
      .send({ title: '', published: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title is required/i);
  });

  it('still enforces the excerpt length ceiling on a draft', async () => {
    const res = await request(app).post('/api/blog').set(await authHeader())
      .send({ ...TITLE_ONLY, excerpt: 'x'.repeat(301) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot exceed 300/i);
  });

  it('updates a draft with a title-only body', async () => {
    const post = await Blog.create(TITLE_ONLY);
    const res = await request(app).put(`/api/blog/${post._id}`).set(await authHeader())
      .send({ title: 'Renamed Idea', published: false });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Renamed Idea');
  });

  it('refuses to PUBLISH an incomplete draft through PUT', async () => {
    const post = await Blog.create(TITLE_ONLY);
    const res = await request(app).put(`/api/blog/${post._id}`).set(await authHeader())
      .send({ title: TITLE_ONLY.title, published: true });

    expect(res.status).toBe(400);
    expect((await Blog.findById(post._id)).published).toBe(false);
  });

  // ⚠️ THE HOLE: togglePublish never runs blogRules. Before the model learned
  // the "needs a body" rule this flipped an empty draft live with a 200 — and
  // the model's refusal then surfaced as a 500, since errorHandler has no
  // ValidationError mapping.
  it('refuses to PUBLISH an incomplete draft through PATCH /publish, as a 400', async () => {
    const post = await Blog.create(TITLE_ONLY);
    const res = await request(app).patch(`/api/blog/${post._id}/publish`).set(await authHeader());

    expect(res.status).toBe(400);
    expect((await Blog.findById(post._id)).published).toBe(false);
  });

  // The model's body rule specifically — this draft HAS an excerpt, so only
  // the missing body can be what refuses it.
  it('refuses PATCH /publish on a draft with an excerpt but no body', async () => {
    const post = await Blog.create({ ...TITLE_ONLY, excerpt: 'Has an excerpt.' });
    const res = await request(app).patch(`/api/blog/${post._id}/publish`).set(await authHeader());

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/needs a body/i);
  });

  it('publishes a draft once it is complete', async () => {
    const post = await Blog.create({ ...TITLE_ONLY, ...COMPLETE });
    const res = await request(app).patch(`/api/blog/${post._id}/publish`).set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.published).toBe(true);
  });

  it('never serves a draft publicly — list or slug', async () => {
    await Blog.create(TITLE_ONLY);

    const list = await request(app).get('/api/blog');
    expect(list.body.data.map((p) => p.title)).not.toContain(TITLE_ONLY.title);

    const one = await request(app).get('/api/blog/half-written-idea');
    expect(one.status).toBe(404);
  });
});
