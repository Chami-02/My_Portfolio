const request = require('supertest');
const app = require('../app');
const Blog = require('../models/Blog');
const Project = require('../models/Project');
const User = require('../models/User');
const VisitTotal = require('../models/VisitTotal');
const { moveTotals } = require('../services/visitTotals');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const row = (day, dim, key, count) => ({ day, dim, key, count });
const countAt = async (dim, key, day) =>
  (await VisitTotal.findOne({ dim, key, ...(day && { day }) }).lean())?.count ?? 0;

const authHeader = async () => {
  const user = await User.findOne({ email: 'admin@test.com' })
    ?? await User.create({ email: 'admin@test.com', password: 'TestPass@1234!' });
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};

describe('moveTotals (PF-153)', () => {
  it('moves page openings and reads, day by day, and leaves nothing behind', async () => {
    await VisitTotal.insertMany([
      row('2026-11-01', 'path', '/blog/old', 3),
      row('2026-11-02', 'path', '/blog/old', 4),
      row('2026-11-02', 'read', '/blog/old', 2),
    ]);

    await moveTotals('/blog/old', '/blog/new');

    expect(await countAt('path', '/blog/new', '2026-11-01')).toBe(3);
    expect(await countAt('path', '/blog/new', '2026-11-02')).toBe(4);
    expect(await countAt('read', '/blog/new', '2026-11-02')).toBe(2);
    expect(await VisitTotal.countDocuments({ key: '/blog/old' })).toBe(0);
  });

  it('adds to a row the new address already has (a post renamed back)', async () => {
    await VisitTotal.insertMany([
      row('2026-11-02', 'path', '/blog/old', 4),
      row('2026-11-02', 'path', '/blog/new', 10),
    ]);

    await moveTotals('/blog/old', '/blog/new');

    expect(await countAt('path', '/blog/new')).toBe(14);
    expect(await VisitTotal.countDocuments()).toBe(1);
  });

  it('touches other pages and other kinds of total not at all', async () => {
    await VisitTotal.insertMany([
      row('2026-11-02', 'path', '/blog/other', 5),
      row('2026-11-02', 'referrer', '/blog/old', 6),
    ]);

    await moveTotals('/blog/old', '/blog/new');

    expect(await countAt('path', '/blog/other')).toBe(5);
    expect(await countAt('referrer', '/blog/old')).toBe(6);
  });

  it('does nothing when the address did not change', async () => {
    await VisitTotal.create(row('2026-11-02', 'path', '/blog/same', 4));
    await moveTotals('/blog/same', '/blog/same');
    expect(await countAt('path', '/blog/same')).toBe(4);
  });

  it('never throws: the rename is saved already', async () => {
    const spy = jest.spyOn(VisitTotal, 'find').mockImplementation(() => { throw new Error('down'); });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(moveTotals('/blog/a', '/blog/b')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    spy.mockRestore();
    log.mockRestore();
  });
});

describe('renames through the real routes (PF-153)', () => {
  it('a renamed post keeps its totals under its new address', async () => {
    const post = await Blog.create({
      title: 'First Title', excerpt: 'An excerpt.', published: true,
      sections: [{ heading: 'Intro', body: ['Text.'], bullets: [] }],
    });
    await VisitTotal.insertMany([
      row('2026-11-02', 'path', `/blog/${post.slug}`, 7),
      row('2026-11-02', 'read', `/blog/${post.slug}`, 3),
    ]);

    const res = await request(app).put(`/api/blog/${post._id}`)
      .set(await authHeader()).send({ title: 'Second Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('second-title');
    expect(await countAt('path', '/blog/second-title')).toBe(7);
    expect(await countAt('read', '/blog/second-title')).toBe(3);
  });

  it('a draft project renamed after being live keeps its totals too', async () => {
    const project = await Project.create({ title: 'Old Name', published: false });
    const oldPath = `/projects/${project.slug}`;
    await VisitTotal.create(row('2026-11-02', 'path', oldPath, 5));

    const res = await request(app).put(`/api/projects/${project._id}`)
      .set(await authHeader()).send({ title: 'New Name' });

    expect(res.status).toBe(200);
    expect(await countAt('path', `/projects/${res.body.data.slug}`)).toBe(5);
    expect(await countAt('path', oldPath)).toBe(0);
  });
});

describe('old links forward (PF-153)', () => {
  const makePost = (title, overrides = {}) => Blog.create({
    title, excerpt: 'An excerpt.', published: true,
    sections: [{ heading: 'Intro', body: ['Text.'], bullets: [] }],
    ...overrides,
  });
  const rename = (post, title, headers) => request(app).put(`/api/blog/${post._id}`).set(headers).send({ title });
  const openAt = (slug) => request(app).get(`/api/blog/${slug}`);

  it('an old address answers with the post under its new slug', async () => {
    const post = await makePost('First Title');
    await rename(post, 'Second Title', await authHeader());

    const res = await openAt('first-title');

    expect(res.status).toBe(200);
    expect(res.body.data.post.slug).toBe('second-title');
  });

  it('keeps every old address through several renames', async () => {
    const post = await makePost('First Title');
    const headers = await authHeader();
    await rename(post, 'Second Title', headers);
    await rename(post, 'Third Title', headers);

    expect((await openAt('first-title')).body.data.post.slug).toBe('third-title');
    expect((await openAt('second-title')).body.data.post.slug).toBe('third-title');
  });

  it('renamed back, the post answers at that address and no longer forwards from it', async () => {
    const post = await makePost('First Title');
    const headers = await authHeader();
    await rename(post, 'Second Title', headers);
    await rename(post, 'First Title', headers);

    const stored = await Blog.findById(post._id).lean();
    expect(stored.oldSlugs).toEqual(['second-title']);
    expect((await openAt('first-title')).body.data.post.slug).toBe('first-title');
  });

  it('a post using the address today wins over an old forward', async () => {
    const post = await makePost('First Title');
    await rename(post, 'Second Title', await authHeader());
    await makePost('First Title');

    const res = await openAt('first-title');

    expect(res.body.data.post.slug).toBe('first-title');
    expect(String(res.body.data.post._id)).not.toBe(String(post._id));
  });

  it('the address goes to the post that used it last', async () => {
    const first = await makePost('Shared Title');
    const headers = await authHeader();
    await rename(first, 'Moved Away', headers);
    const second = await makePost('Shared Title');
    await rename(second, 'Moved Too', headers);

    expect((await openAt('shared-title')).body.data.post.slug).toBe('moved-too');
  });

  it('a draft never had an address to forward', async () => {
    const draft = await makePost('Draft Title', { published: false });
    await rename(draft, 'Draft Again', await authHeader());
    expect((await Blog.findById(draft._id).lean()).oldSlugs ?? []).toEqual([]);
    expect((await openAt('draft-title')).status).toBe(404);
  });

  it('an unpublished post stops answering at its old addresses too', async () => {
    const post = await makePost('First Title');
    const headers = await authHeader();
    await rename(post, 'Second Title', headers);
    await Blog.updateOne({ _id: post._id }, { published: false });
    expect((await openAt('first-title')).status).toBe(404);
  });

  it('a client cannot write the list', async () => {
    const post = await makePost('First Title');
    await request(app).put(`/api/blog/${post._id}`).set(await authHeader()).send({ oldSlugs: ['stolen'] });
    expect((await Blog.findById(post._id).lean()).oldSlugs ?? []).toEqual([]);
  });

  it('the public answers do not list old addresses', async () => {
    const post = await makePost('First Title');
    await rename(post, 'Second Title', await authHeader());
    const one = await openAt('second-title');
    const list = await request(app).get('/api/blog');
    expect(one.body.data.post.oldSlugs).toBeUndefined();
    expect(list.body.data[0].oldSlugs).toBeUndefined();
  });

  it('a view through an old link lands on the new address', async () => {
    const post = await makePost('First Title');
    await rename(post, 'Second Title', await authHeader());

    await request(app).post('/api/visits')
      .set('Origin', 'http://localhost:5173')
      .set('User-Agent', 'Mozilla/5.0 Chrome/130.0 Safari/537.36')
      .send({ type: 'view', path: '/blog/first-title' })
      .expect(204);

    expect(await countAt('path', '/blog/second-title')).toBe(1);
    expect(await countAt('path', '/blog/first-title')).toBe(0);
  });

  it('a view at an address a newer post took stays with that post', async () => {
    const post = await makePost('First Title');
    await rename(post, 'Second Title', await authHeader());
    await makePost('First Title');

    await request(app).post('/api/visits')
      .set('Origin', 'http://localhost:5173')
      .set('User-Agent', 'Mozilla/5.0 Chrome/130.0 Safari/537.36')
      .send({ type: 'view', path: '/blog/first-title' });

    expect(await countAt('path', '/blog/first-title')).toBe(1);
    expect(await countAt('path', '/blog/second-title')).toBe(0);
  });
});
