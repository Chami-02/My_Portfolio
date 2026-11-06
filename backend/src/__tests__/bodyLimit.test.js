// How big a JSON request may be. A real post passed 10 kb, so no edit to it could
// be saved, and production said "something went wrong on our side". Through the
// real app: routes, `protect`, controllers, models.
const request = require('supertest');
const app     = require('../app');
const User    = require('../models/User');
const Blog    = require('../models/Blog');
const Project = require('../models/Project');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const TOO_LONG = "That's too long to save. Please shorten it and try again.";
const KB = 1024;

/** One section whose body makes the JSON request about `kb` kilobytes. */
const sectionsOf = (kb) => [{ heading: 'Long', body: ['x'.repeat(kb * KB)], bullets: [] }];

// The limiters are live under test — each case gets its own address.
let ip = 0;
const nextIp = () => `10.149.${Math.floor(++ip / 250)}.${ip % 250}`;

let me;
const signedIn = (req) => req.set('Authorization', `Bearer ${me.accessToken}`).set('X-Forwarded-For', nextIp());
const stranger = (req) => req.set('X-Forwarded-For', nextIp());

beforeAll(connectTestDB);
beforeEach(async () => {
  const user = await User.create({ email: 'owner@example.com', password: 'Owner-Password-149' });
  me = await issueSession(user, {});
});
afterEach(clearDB);
afterAll(disconnectTestDB);

describe('long content, signed in', () => {
  it('saves an edit to a post over 10 kb, and it is stored', async () => {
    const post = await Blog.create({ title: 'A long post', published: false });
    const res = await signedIn(request(app).put(`/api/blog/${post._id}`)).send({ sections: sectionsOf(14) });

    expect(res.status).toBe(200);
    const stored = await Blog.findById(post._id);
    expect(stored.sections[0].body[0]).toHaveLength(14 * KB);
  });

  it('creates a post over 10 kb', async () => {
    const res = await signedIn(request(app).post('/api/blog'))
      .send({ title: 'A long new post', published: false, sections: sectionsOf(14) });
    expect(res.status).toBe(201);
  });

  it('saves an edit to a project over 10 kb', async () => {
    const project = await Project.create({ title: 'A long project', published: false });
    const res = await signedIn(request(app).put(`/api/projects/${project._id}`)).send({ sections: sectionsOf(14) });

    expect(res.status).toBe(200);
    expect((await Project.findById(project._id)).sections[0].body[0]).toHaveLength(14 * KB);
  });

  it('creates a project over 10 kb', async () => {
    const res = await signedIn(request(app).post('/api/projects'))
      .send({ title: 'A long new project', published: false, sections: sectionsOf(14) });
    expect(res.status).toBe(201);
  });

  it('a small save still works', async () => {
    const post = await Blog.create({ title: 'Short', published: false });
    const res = await signedIn(request(app).put(`/api/blog/${post._id}`)).send({ title: 'Shorter' });
    expect(res.status).toBe(200);
    expect((await Blog.findById(post._id)).title).toBe('Shorter');
  });

  it('just under the new limit saves; over it says so in plain words and changes nothing', async () => {
    const post = await Blog.create({ title: 'A long post', published: false });
    const put = (kb) => signedIn(request(app).put(`/api/blog/${post._id}`)).send({ sections: sectionsOf(kb) });

    expect((await put(255)).status).toBe(200);

    const refused = await put(257);
    expect(refused.status).toBe(413);
    expect(refused.body).toEqual({ status: 'fail', message: TOO_LONG });
    expect((await Blog.findById(post._id)).sections[0].body[0]).toHaveLength(255 * KB);
  });
});

describe('a stranger never gets the larger limit', () => {
  const BIG = { title: 'x'.repeat(14 * KB) };

  it.each([
    ['post', '/api/blog'],
    ['put',  '/api/blog/507f1f77bcf86cd799439011'],
    ['post', '/api/projects'],
    ['put',  '/api/projects/507f1f77bcf86cd799439011'],
  ])('%s %s answers 401, the same for a big body as a small one', async (method, path) => {
    expect((await stranger(request(app)[method](path)).send({ title: 'x' })).status).toBe(401);
    expect((await stranger(request(app)[method](path)).send(BIG)).status).toBe(401);
    // Over even the larger limit: refused for who they are, unread.
    expect((await stranger(request(app)[method](path)).send({ title: 'x'.repeat(300 * KB) })).status).toBe(401);
  });
});

describe('everything else stays at 10 kb, even signed in', () => {
  const BIG = { message: 'x'.repeat(11 * KB) };

  it.each([
    ['the contact form',   'post',  '/api/contact',                             false],
    ['sign-in',            'post',  '/api/auth/login',                          false],
    ['publish a post',     'patch', '/api/blog/507f1f77bcf86cd799439011/publish', true],
    ['delete a post',      'delete', '/api/blog/507f1f77bcf86cd799439011',        true],
    ['a post by POST /:id', 'post', '/api/blog/507f1f77bcf86cd799439011',         true],
    ['a post by PUT /',    'put',   '/api/blog',                                  true],
    ['a project\'s picture', 'put', '/api/projects/507f1f77bcf86cd799439011/background', true],
    ['the About panel',    'put',   '/api/about',                                 true],
  ])('%s: 413 in plain words, not a crash', async (_name, method, path, withSession) => {
    const req = request(app)[method](path);
    const res = await (withSession ? signedIn(req) : stranger(req)).send(BIG);
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ status: 'fail', message: TOO_LONG });
  });
});
