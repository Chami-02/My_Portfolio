const request = require('supertest');
const app     = require('../app');
const Blog    = require('../models/Blog');
const VisitTotal = require('../models/VisitTotal');
const VisitorDay = require('../models/VisitorDay');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('Blog reads (PF-153, through POST /api/visits)', () => {
  beforeAll(connectTestDB);
  afterEach(clearDB);
  afterAll(disconnectTestDB);

  const makePost = (overrides = {}) => Blog.create({
    title:     'Read Counter Test Post',
    excerpt:   'Testing the read counter',
    sections:  [{ heading: 'Intro', body: ['Some text here.'], bullets: [] }],
    published: true,
    ...overrides,
  });

  const read = (slug, { ua = CHROME, ip = '203.0.113.9' } = {}) => request(app)
    .post('/api/visits')
    .set('X-Forwarded-For', ip)
    .set('Origin', 'http://localhost:5173')
    .set('User-Agent', ua)
    .send({ type: 'read', slug });

  const viewsOf = async (post) => (await Blog.findById(post._id)).views;
  const readRows = () => VisitTotal.find({ dim: 'read' }).lean();

  it('adds one to the post AND one dated row for the panel', async () => {
    const post = await makePost();

    const res = await read(post.slug);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await viewsOf(post)).toBe(1);
    const rows = await readRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: `/blog/${post.slug}`, count: 1 });
  });

  it('counts one person once per post per day, even in a burst', async () => {
    const post = await makePost();

    await Promise.all([read(post.slug), read(post.slug), read(post.slug)]);
    await read(post.slug);

    expect(await viewsOf(post)).toBe(1);
    expect((await readRows())[0].count).toBe(1);
  });

  it('counts the same person again on a different post', async () => {
    const first = await makePost();
    const second = await makePost({ title: 'Second Post' });

    await read(first.slug);
    await read(second.slug);

    expect(await viewsOf(first)).toBe(1);
    expect(await viewsOf(second)).toBe(1);
  });

  it('counts a different person on the same post', async () => {
    const post = await makePost();

    await read(post.slug);
    await read(post.slug, { ua: SAFARI });

    expect(await viewsOf(post)).toBe(2);
  });

  it('uses up none of the network\'s daily share of new visitors', async () => {
    const post = await makePost();
    await read(post.slug);
    expect(await VisitorDay.countDocuments()).toBe(1);
    expect(await VisitorDay.countDocuments({ source: { $exists: true } })).toBe(0);
  });

  it('does not change updatedAt', async () => {
    const post = await makePost();
    const before = (await Blog.findById(post._id)).updatedAt.getTime();

    await read(post.slug);

    expect((await Blog.findById(post._id)).updatedAt.getTime()).toBe(before);
  });

  it.each([
    ['an unknown post', async () => 'no-such-post'],
    ['a draft', async () => (await makePost({ title: 'Draft Post', published: false })).slug],
  ])('writes nothing at all for %s', async (_name, slugOf) => {
    const res = await read(await slugOf());

    expect(res.status).toBe(204);
    expect(await readRows()).toHaveLength(0);
    expect(await VisitorDay.countDocuments()).toBe(0);
  });

  it('ignores a bot, and a script with no Origin', async () => {
    const post = await makePost();

    await read(post.slug, { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' });
    await request(app).post('/api/visits').set('User-Agent', CHROME).send({ type: 'read', slug: post.slug }).expect(204);

    expect(await viewsOf(post)).toBe(0);
    expect(await readRows()).toHaveLength(0);
  });

  it.each([
    ['an array', ['a-post']],
    ['no slug', undefined],
    ['text that is no slug', '../../admin'],
  ])('refuses %s', async (_name, slug) => {
    const res = await request(app).post('/api/visits')
      .set('Origin', 'http://localhost:5173').set('User-Agent', CHROME)
      .send({ type: 'read', slug });
    expect(res.status).toBe(400);
  });

  it('the old route is gone', async () => {
    const post = await makePost();
    const res = await request(app).patch(`/api/blog/${post.slug}/view`);
    expect(res.status).toBe(404);
    expect(await viewsOf(post)).toBe(0);
  });

  // Regression guard: reading a post used to increment views as a side effect.
  it('does not count on a plain GET', async () => {
    const post = await makePost();

    await request(app).get(`/api/blog/${post.slug}`);

    expect(await viewsOf(post)).toBe(0);
  });
});
