// PF-128 — who may keep a copy of an API answer (middleware/cache.js).
//
// The purge is exercised through the REAL @vercel/functions package: these
// tests install a fake Vercel request context (the global symbol the package
// reads) instead of mocking the module, so a change in how cache.js calls
// the package — or calling it after the request context is gone — still fails here.
const fs      = require('fs');
const path    = require('path');
const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app   = require('../app');
const Blog  = require('../models/Blog');
const Project = require('../models/Project');
const User  = require('../models/User');
const { PUBLIC_TAG } = require('../middleware/cache');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const CONTEXT = Symbol.for('@vercel/request-context');
let purge;
let waitUntil;
beforeEach(() => {
  purge = {
    dangerouslyDeleteByTag: jest.fn(() => Promise.resolve()),
    invalidateByTag:        jest.fn(() => Promise.resolve()),
  };
  waitUntil = jest.fn();
  globalThis[CONTEXT] = { get: () => ({ waitUntil, purge }) };
});
afterEach(() => { delete globalThis[CONTEXT]; });

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };
const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

const makePost = () => Blog.create({
  title:     'Cache Test Post',
  excerpt:   'Testing the cache headers',
  sections:  [{ heading: 'Intro', body: ['Some text here.'], bullets: [] }],
  published: true,
});

const expectCdnCached = (res) => {
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('max-age=0');
  expect(res.headers['vercel-cdn-cache-control'])
    .toBe('public, s-maxage=3600, stale-while-revalidate=86400');
  expect(res.headers['vercel-cache-tag']).toBe(PUBLIC_TAG);
};

const expectNeverCached = (res) => {
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.headers['vercel-cdn-cache-control']).toBeUndefined();
  expect(res.headers['vercel-cache-tag']).toBeUndefined();
};

describe('public GETs — cached by the CDN, not the browser', () => {
  it.each([
    '/api/about',
    '/api/projects',
    '/api/skills',
    '/api/skill-categories',
    '/api/blog',
    '/api/vocabulary/tag',
  ])('%s', async (url) => {
    expectCdnCached(await request(app).get(url));
  });

  it('/api/blog/:slug', async () => {
    const post = await makePost();
    expectCdnCached(await request(app).get(`/api/blog/${post.slug}`));
  });

  it('/api/projects/:id', async () => {
    const project = await Project.create({
      title:       'Cached Project',
      description: 'A project to read back through the cache headers.',
      tech:        ['JavaScript'],
      githubUrl:   'https://github.com/test/project',
    });
    expectCdnCached(await request(app).get(`/api/projects/${project._id}`));
  });
});

// RFC 9111 §3.5: a shared cache may reuse an answer to a request that carried
// `Authorization` ONLY if Cache-Control says one of these. The admin panels
// read the public URLs with that header, so no cache other than Vercel's
// (which skips such requests anyway) may be given any of them.
it('the header every cache sees never lets a signed-in read be reused', async () => {
  const res = await request(app).get('/api/about');
  const directives = res.headers['cache-control'].split(',').map((d) => d.trim().split('=')[0]);
  expect(directives).not.toEqual(expect.arrayContaining(['public']));
  expect(directives).not.toEqual(expect.arrayContaining(['must-revalidate']));
  expect(directives).not.toEqual(expect.arrayContaining(['s-maxage']));
});

describe('everything else — never cached', () => {
  it('the health check', async () => {
    expectNeverCached(await request(app).get('/api/health'));
  });

  it('a signed-in admin read', async () => {
    const res = await request(app).get('/api/blog/admin/all').set(await authHeader());
    expect(res.status).toBe(200);
    expectNeverCached(res);
  });

  it('a session answer (tokens)', async () => {
    const res = await request(app).get('/api/auth/me').set(await authHeader());
    expect(res.status).toBe(200);
    expectNeverCached(res);
  });

  // The public route set the CDN headers BEFORE it failed: a 404 for a slug
  // that is about to be published must not stick in the cache.
  it('an error on a public route (404 slug)', async () => {
    const res = await request(app).get('/api/blog/no-such-post');
    expect(res.status).toBe(404);
    expectNeverCached(res);
  });

  it('an unknown route', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expectNeverCached(res);
  });
});

describe('a signed-in SAVE deletes every cached copy', () => {
  it.each([
    ['POST',   '/api/skill-categories', { label: 'Soft Skills' }],
    ['PUT',    '/api/about',            { name: 'New Name' }],
  ])('%s %s → one purge, by DELETE, of the public tag', async (method, url, body) => {
    const res = await request(app)[method.toLowerCase()](url).set(await authHeader()).send(body);
    expect(res.status).toBeLessThan(400);
    expect(purge.dangerouslyDeleteByTag).toHaveBeenCalledTimes(1);
    expect(purge.dangerouslyDeleteByTag).toHaveBeenCalledWith(PUBLIC_TAG, undefined);
    // "invalidate" would serve the OLD copy once more — not instant.
    expect(purge.invalidateByTag).not.toHaveBeenCalled();
    // Kept alive past the response, so the purge is not cut off.
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('PATCH and DELETE purge too', async () => {
    const auth = await authHeader();
    const post = await makePost();
    await request(app).patch(`/api/blog/${post._id}/publish`).set(auth).expect(200);
    await request(app).delete(`/api/blog/${post._id}`).set(auth).expect(204);
    expect(purge.dangerouslyDeleteByTag).toHaveBeenCalledTimes(2);
  });

  it('a purge that fails never fails the save', async () => {
    purge.dangerouslyDeleteByTag.mockImplementation(() => Promise.reject(new Error('429')));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/skill-categories')
      .set(await authHeader()).send({ label: 'Soft Skills' });
    expect(res.status).toBe(201);
    await waitUntil.mock.calls[0][0];
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('CDN purge failed'), '429');
    spy.mockRestore();
  });
});

describe('nothing else purges', () => {
  it('a refused (400) signed-in write', async () => {
    const res = await request(app).post('/api/skill-categories')
      .set(await authHeader()).send({});
    expect(res.status).toBe(400);
    expect(purge.dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it('a signed-out write (401)', async () => {
    const res = await request(app).put('/api/about').send({ name: 'X' });
    expect(res.status).toBe(401);
    expect(purge.dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  // Visitor writes succeed but carry no session — a reader counting a view
  // must not wipe the whole cache.
  it('a blog view', async () => {
    const post = await makePost();
    await request(app).patch(`/api/blog/${post.slug}/view`).expect(200);
    expect(purge.dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it('a contact message', async () => {
    await request(app).post('/api/contact').send({
      name:    'Test User',
      email:   'test@example.com',
      message: 'This is a valid test message that is long enough for validation.',
    }).expect(201);
    expect(purge.dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  // A protected read sets req.user too — only the method tells it apart.
  it('a signed-in read', async () => {
    await request(app).get('/api/blog/admin/all').set(await authHeader()).expect(200);
    expect(purge.dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });
});

it('off Vercel (no request context) a SAVE still succeeds', async () => {
  delete globalThis[CONTEXT];
  const res = await request(app).post('/api/skill-categories')
    .set(await authHeader()).send({ label: 'Soft Skills' });
  expect(res.status).toBe(201);
});

// The function runs next to the database: Atlas is AWS Mumbai (ap-south-1),
// Vercel's Mumbai region is bom1 (owner, 2026-10-19).
it('backend/vercel.json runs the API in bom1', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8'));
  expect(config.regions).toEqual(['bom1']);
});
