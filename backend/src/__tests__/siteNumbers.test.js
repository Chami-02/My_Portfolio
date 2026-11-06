// backend/src/__tests__/siteNumbers.test.js
//
// PF-150 — the numbers anyone can read. Done means: private data cannot reach
// the answer, and a country under 5 visits never appears. Every number below is
// distinct, so a mix-up fails.
const request = require('supertest');
const app = require('../app');
const VisitTotal  = require('../models/VisitTotal');
const LiveVisitor = require('../models/LiveVisitor');
const Contact     = require('../models/Contact');
const SignInEvent = require('../models/SignInEvent');
const Blog        = require('../models/Blog');
const Project     = require('../models/Project');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(() => {
  jest.restoreAllMocks();
  return clearDB();
});
afterAll(disconnectTestDB);

const DAY_1 = '2026-11-01';
const DAY_2 = '2026-11-02';
const row = (day, dim, key, count) => ({ day, dim, key, count });

const getNumbers = async () => {
  const res = await request(app).get('/api/site-numbers');
  expect(res.status).toBe(200);
  return res.body.data;
};

// Straight into the collection: these tests are about what the answer leaves
// out, whatever shape an older document has (a project with no `published`).
const addProject = (slug, fields = {}) => Project.collection.insertOne({
  title: `Project ${slug}`, slug, description: 'Words.', ...fields,
});

const addPost = (slug, fields = {}) => Blog.collection.insertOne({
  title: `Post ${slug}`, slug, published: true, views: 0, ...fields,
});

const paths = (...rows) => VisitTotal.insertMany(
  rows.map(([key, count, day = DAY_1]) => row(day, 'path', key, count)),
);

describe('GET /api/site-numbers', () => {
  it('answers with zeros and empty lists before anything is counted', async () => {
    const data = await getNumbers();
    expect(data).toMatchObject({
      visits: 0, countriesReached: 0, topCountries: [], topProjects: [], topPosts: [], blogReads: 0,
    });
  });

  it('adds up the visits of every day', async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'visitors', 'all', 17),
      row(DAY_2, 'visitors', 'all', 23),
      // Page views are a different number, and must not be added in.
      row(DAY_1, 'views', 'all', 1000),
    ]);
    expect((await getNumbers()).visits).toBe(40);
  });

  it('says when the numbers were added up', async () => {
    const before = Date.now();
    const { updatedAt } = await getNumbers();
    expect(new Date(updatedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(updatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('countries', () => {
  it('a country with 4 visits stays hidden; one with 5 appears', async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'country', 'FR', 4),
      row(DAY_1, 'country', 'LK', 5),
    ]);
    expect((await getNumbers()).topCountries).toEqual(['LK']);
  });

  it('adds a country up across days before applying the 5', async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'country', 'GB', 2),
      row(DAY_2, 'country', 'GB', 3),
    ]);
    expect((await getNumbers()).topCountries).toEqual(['GB']);
  });

  it('never names (unknown), and does not count it as a country', async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'country', '(unknown)', 500),
      row(DAY_1, 'country', 'LK', 6),
    ]);
    const data = await getNumbers();
    expect(data.topCountries).toEqual(['LK']);
    expect(data.countriesReached).toBe(1);
  });

  it('counts a small country as reached without naming it', async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'country', 'FR', 1),
      row(DAY_1, 'country', 'DE', 2),
      row(DAY_1, 'country', 'LK', 9),
    ]);
    const data = await getNumbers();
    expect(data.countriesReached).toBe(3);
    expect(data.topCountries).toEqual(['LK']);
  });

  it('lists at most 5, biggest first, then by code on a tie', async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'country', 'AU', 10),
      row(DAY_1, 'country', 'BR', 90),
      row(DAY_1, 'country', 'CA', 40),
      row(DAY_1, 'country', 'DE', 40),
      row(DAY_1, 'country', 'ES', 20),
      row(DAY_1, 'country', 'FR', 6),
    ]);
    const data = await getNumbers();
    expect(data.topCountries).toEqual(['BR', 'CA', 'DE', 'ES', 'AU']);
    expect(data.countriesReached).toBe(6);
  });
});

describe('countries that tie', () => {
  it('breaks a tie by code, so the list cannot change between two answers', async () => {
    const codes = ['ZA', 'BR', 'NO', 'DE', 'SE', 'AU', 'KE', 'CA'];
    await VisitTotal.insertMany(codes.map((code) => row(DAY_1, 'country', code, 8)));
    expect((await getNumbers()).topCountries).toEqual(['AU', 'BR', 'CA', 'DE', 'KE']);
  });
});

describe('most viewed projects', () => {
  it('the top 3 by views, added up across days, as slug and title only', async () => {
    await Promise.all(['one', 'two', 'three', 'four'].map((slug) => addProject(slug, { published: true })));
    await paths(
      ['/projects/one', 5],
      ['/projects/two', 30],
      ['/projects/three', 12],
      ['/projects/three', 10, DAY_2],
      ['/projects/four', 1],
    );
    expect((await getNumbers()).topProjects).toEqual([
      { slug: 'two', title: 'Project two' },
      { slug: 'three', title: 'Project three' },
      { slug: 'one', title: 'Project one' },
    ]);
  });

  it('treats a project with no `published` field as public (older projects)', async () => {
    await addProject('older');
    await paths(['/projects/older', 3]);
    expect((await getNumbers()).topProjects).toEqual([{ slug: 'older', title: 'Project older' }]);
  });

  it('never shows a draft, however many views it has', async () => {
    await addProject('secret-draft', { published: false });
    await paths(['/projects/secret-draft', 900]);
    expect(JSON.stringify(await getNumbers())).not.toContain('secret-draft');
  });

  it('never shows an address that is not a project: paths are browser text', async () => {
    await addProject('real', { published: true });
    await paths(['/projects/invented-by-a-script', 900], ['/projects/real', 1]);
    const data = await getNumbers();
    expect(data.topProjects).toEqual([{ slug: 'real', title: 'Project real' }]);
    expect(JSON.stringify(data)).not.toContain('invented-by-a-script');
  });

  it('leaves out a project nobody has viewed', async () => {
    await addProject('unseen', { published: true });
    expect((await getNumbers()).topProjects).toEqual([]);
  });
});

describe('most read posts and blog reads', () => {
  it('the top 3 by reads, as slug and title only', async () => {
    await Promise.all([
      addPost('low', { views: 2 }),
      addPost('high', { views: 50 }),
      addPost('mid', { views: 11 }),
      addPost('lowest', { views: 1 }),
    ]);
    const data = await getNumbers();
    expect(data.topPosts).toEqual([
      { slug: 'high', title: 'Post high' },
      { slug: 'mid', title: 'Post mid' },
      { slug: 'low', title: 'Post low' },
    ]);
    expect(data.blogReads).toBe(64);
  });

  it('a draft post is in neither the list nor the total', async () => {
    await addPost('published-post', { views: 7 });
    await addPost('draft-post', { published: false, views: 400 });
    const data = await getNumbers();
    expect(data.blogReads).toBe(7);
    expect(JSON.stringify(data)).not.toContain('draft-post');
  });

  it('leaves out a post nobody has read', async () => {
    await addPost('unread', { views: 0 });
    expect((await getNumbers()).topPosts).toEqual([]);
  });
});

describe('what must stay private', () => {
  const MARKER = 'PRIVATEMARKER';

  beforeEach(async () => {
    await VisitTotal.insertMany([
      row(DAY_1, 'city', `${MARKER}-city`, 91),
      row(DAY_1, 'referrer', `${MARKER}.example`, 92),
      row(DAY_1, 'device', `${MARKER}-device`, 93),
      row(DAY_1, 'browser', `${MARKER}-browser`, 94),
      row(DAY_1, 'hour', '09', 9001),
      row(DAY_1, 'section', `${MARKER}-section`, 96),
      row(DAY_1, 'click', 'email', 9002),
      row(DAY_1, 'path', `/${MARKER}-page`, 98),
      row(DAY_1, 'country', 'LK', 7),
      row(DAY_1, 'visitors', 'all', 11),
    ]);
    await Contact.create({
      name: `${MARKER} Sender`,
      email: 'sender@example.com',
      subject: `${MARKER} subject`,
      message: `${MARKER} message long enough to be valid`,
      location: `${MARKER} town, Sri Lanka`,
    });
    await SignInEvent.collection.insertOne({
      kind: 'sign-in', outcome: 'ok', method: 'password', email: `${MARKER}@example.com`, createdAt: new Date(),
    });
    await LiveVisitor.create({ _id: `${MARKER}-code`, expiresAt: new Date(Date.now() + 60_000) });
  });

  it('answers with exactly the allowed fields', async () => {
    expect(Object.keys(await getNumbers()).sort()).toEqual([
      'blogReads', 'countriesReached', 'topCountries', 'topPosts', 'topProjects', 'updatedAt', 'visits',
    ]);
  });

  it('holds none of the private values, and no private count', async () => {
    const res = await request(app).get('/api/site-numbers');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(MARKER);
    expect(text).not.toContain('sender@example.com');
    expect(text).not.toContain('9001');
    expect(text).not.toContain('9002');
    expect(res.body.data.visits).toBe(11);
  });

  it('a list holds slugs, titles and codes, and no per-item count', async () => {
    await addProject('a-project', { published: true, githubUrl: `https://${MARKER}.example` });
    await addPost('a-post', { views: 3, content: MARKER });
    await paths(['/projects/a-project', 2]);
    const data = await getNumbers();
    expect(Object.keys(data.topProjects[0]).sort()).toEqual(['slug', 'title']);
    expect(Object.keys(data.topPosts[0]).sort()).toEqual(['slug', 'title']);
    expect(data.topCountries).toEqual(['LK']);
  });

  it('nothing here is behind a sign-in, and no sign-in changes the answer shape', async () => {
    const res = await request(app).get('/api/site-numbers').set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('signIns');
  });
});

describe('caching', () => {
  it('a failed answer is never kept', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(VisitTotal, 'aggregate').mockImplementation(() => { throw new Error('database down'); });
    const res = await request(app).get('/api/site-numbers');
    expect(res.status).toBe(500);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['vercel-cdn-cache-control']).toBeUndefined();
    expect(res.headers['vercel-cache-tag']).toBeUndefined();
  });
});
