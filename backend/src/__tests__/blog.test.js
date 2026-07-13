const request = require('supertest');
const app     = require('../app');
const Blog    = require('../models/Blog');
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
    expect(res.body.data.title).toBe(PUBLISHED_POST.title);
    expect(res.body.data.content).toBeDefined();
  });

  it('returns 404 for draft posts', async () => {
    const post = await Blog.create(DRAFT_POST);

    const res = await request(app).get(`/api/blog/${post.slug}`);

    expect(res.status).toBe(404);
  });
});
