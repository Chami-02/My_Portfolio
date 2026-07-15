const request = require('supertest');
const jwt     = require('jsonwebtoken');
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
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
    expect(res.body.data.title).toBe(PUBLISHED_POST.title);
    expect(res.body.data.content).toBeDefined();
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
