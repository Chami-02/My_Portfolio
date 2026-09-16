// backend/src/__tests__/dashboard.test.js
//
// PF-110 — GET /api/dashboard/stats, the one call behind the admin Overview
// cards, the sidebar badges and the footer counts.
const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app     = require('../app');
const Project = require('../models/Project');
const Skill   = require('../models/Skill');
const Blog    = require('../models/Blog');
const Contact = require('../models/Contact');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

// Through issueSession, never the login route: authLimiter (10 / 15 min)
// is live under NODE_ENV=test and a per-case HTTP login goes red on the
// 11th call while the thing under test still passes.
const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};

const project = (n) => ({
  title:       `Project ${n}`,
  description: 'A valid test project description for the dashboard suite.',
  tech:        ['JavaScript'],
  githubUrl:   `https://github.com/test/project-${n}`,
});

const skill = (n) => ({ name: `Skill ${n}`, category: 'language', level: 'intermediate', order: n });

const post = (n, published) => ({
  title:     `Post ${n}`,
  excerpt:   'An excerpt for the dashboard suite.',
  sections:  [{ heading: 'Intro', body: ['Some text.'], bullets: [] }],
  published,
});

const message = (n, read) => ({
  name:    `Sender ${n}`,
  email:   `sender${n}@example.com`,
  message: 'A message long enough to satisfy the schema minimum.',
  read,
});

describe('GET /api/dashboard/stats', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  // ⚠️ The zero case. Every positive assertion below would also pass
  // under a predicate that matches everything; this one would not.
  it('returns all zeros on an empty database', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual({
      projects: 0, skills: 0, posts: 0, published: 0, drafts: 0, messages: 0, unread: 0,
    });
  });

  // ⚠️ Every count is DISTINCT on purpose — 4 / 1 / 5 / 3 / 2 / 6 / 5 — so
  // two fields wired to each other's query cannot cancel out. (unread and
  // posts tie at 5; they are on different collections, so a swap between
  // them is not the mistake this guards against.)
  it('counts every collection, splitting posts by published and messages by read', async () => {
    await Project.create([project(1), project(2), project(3), project(4)]);
    await Skill.create([skill(1)]);
    await Blog.create([post(1, true), post(2, true), post(3, true), post(4, false), post(5, false)]);
    await Contact.create([
      message(1, false), message(2, false), message(3, false),
      message(4, false), message(5, false), message(6, true),
    ]);

    const res = await request(app).get('/api/dashboard/stats').set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      projects:  4,
      skills:    1,
      posts:     5,
      published: 3,
      drafts:    2,
      messages:  6,
      unread:    5,
    });
  });

  // Pins `read: { $ne: true }` over `read: false`. A row written around the
  // schema default has no `read` field at all; the admin panel's own filter
  // (`!m.read`) has always treated it as unread, and the endpoint that
  // replaces that filter must agree. Same shape for drafts = total − published.
  it('counts a message with no `read` field as unread, and a post with no `published` field as a draft', async () => {
    await Contact.collection.insertOne({
      name: 'Raw', email: 'raw@example.com', message: 'Inserted below the schema.',
    });
    await Blog.collection.insertOne({
      title: 'Raw', slug: 'raw', excerpt: 'Inserted below the schema.', sections: [],
    });

    const res = await request(app).get('/api/dashboard/stats').set(await authHeader());
    expect(res.body.data.messages).toBe(1);
    expect(res.body.data.unread).toBe(1);
    expect(res.body.data.posts).toBe(1);
    expect(res.body.data.published).toBe(0);
    expect(res.body.data.drafts).toBe(1);
  });

  it('funnels a database failure through errorHandler as a 500', async () => {
    const spy = jest.spyOn(Project, 'countDocuments').mockRejectedValueOnce(new Error('boom'));
    // errorHandler logs an unexpected error with its stack; that is correct
    // in production and forty lines of noise here.
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app).get('/api/dashboard/stats').set(await authHeader());
      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(log).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });
});
