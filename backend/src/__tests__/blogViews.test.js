const request = require('supertest');
const app     = require('../app');
const Blog    = require('../models/Blog');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

describe('Blog view counter (PF-64)', () => {

  beforeAll(connectTestDB);
  afterEach(clearDB);
  afterAll(disconnectTestDB);

  const makePost = (overrides = {}) => Blog.create({
    title:     'View Counter Test Post',
    excerpt:   'Testing the view counter',
    sections:  [{ heading: 'Intro', body: ['Some text here.'], bullets: [] }],
    published: true,
    ...overrides,
  });

  it('increments views by one', async () => {
    const post = await makePost();

    const res = await request(app).patch(`/api/blog/${post.slug}/view`);

    expect(res.status).toBe(200);
    expect(res.body.data.views).toBe(1);
  });

  it('increments cumulatively', async () => {
    const post = await makePost();

    await request(app).patch(`/api/blog/${post.slug}/view`);
    await request(app).patch(`/api/blog/${post.slug}/view`);
    const res = await request(app).patch(`/api/blog/${post.slug}/view`);

    expect(res.body.data.views).toBe(3);
  });

  it('does not change updatedAt', async () => {
    const post   = await makePost();
    const before = (await Blog.findById(post._id)).updatedAt.getTime();

    await request(app).patch(`/api/blog/${post.slug}/view`);

    const after = (await Blog.findById(post._id)).updatedAt.getTime();
    expect(after).toBe(before);
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).patch('/api/blog/no-such-post/view');
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unpublished post', async () => {
    const draft = await makePost({ title: 'Draft Post', published: false });

    const res = await request(app).patch(`/api/blog/${draft.slug}/view`);
    expect(res.status).toBe(404);
  });

  it('requires no authentication', async () => {
    const post = await makePost();

    const res = await request(app).patch(`/api/blog/${post.slug}/view`);
    expect(res.status).not.toBe(401);
  });

  // Regression guard: reading a post used to increment views as a side effect,
  // which double-counted against this endpoint and bumped updatedAt on every
  // read. PATCH /:slug/view is the only writer of `views`.
  it('does not increment views on a plain GET', async () => {
    const post = await makePost();

    await request(app).get(`/api/blog/${post.slug}`);
    await request(app).get(`/api/blog/${post.slug}`);

    const fresh = await Blog.findById(post._id);
    expect(fresh.views).toBe(0);
  });

});
