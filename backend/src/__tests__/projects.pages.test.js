// PF-144 — a page per project: the slug, the page's sections, the new detail
// fields, the /projects search (?q= ?tech= ?category=) and GET /:slug.

const request   = require('supertest');
const { issueSession } = require('../services/sessionService');
const app        = require('../app');
const Project    = require('../models/Project');
const Vocabulary = require('../models/Vocabulary');
const User       = require('../models/User');
const validationError = require('./helpers/validationError');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const SECTIONS = Object.freeze([{ heading: 'Description', body: ['What it does.'], bullets: [] }]);

const live = (over = {}) => ({
  title:       'ClearDrive.lk',
  description: 'Vehicle clearance platform.',
  tech:        ['React', 'Docker'],
  githubUrl:   'https://github.com/test/cleardrive',
  sections:    SECTIONS.map((s) => ({ ...s })),
  ...over,
});

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };
const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

// ── the slug ────────────────────────────────────────────────────────────────
describe('Project.slug', () => {
  it('is made from the title', async () => {
    const p = await Project.create(live());
    expect(p.slug).toBe('cleardrivelk');
  });

  it('a second project with the same title gets -2, a third -3', async () => {
    await Project.create(live());
    const two   = await Project.create(live());
    const three = await Project.create(live({ published: false }));
    expect([two.slug, three.slug]).toEqual(['cleardrivelk-2', 'cleardrivelk-3']);
  });

  it('is FROZEN once published — renaming a live project keeps its address', async () => {
    const p = await Project.create(live());
    p.title = 'Something else';
    await p.save();
    expect(p.slug).toBe('cleardrivelk');
  });

  it('follows the title while the project is a draft', async () => {
    const p = await Project.create({ title: 'Working name', published: false });
    p.title = 'Final name';
    await p.save();
    expect(p.slug).toBe('final-name');
  });

  it('cannot be written by a client — POST and PUT drop it', async () => {
    const headers = await authHeader();
    const created = await request(app).post('/api/projects').set(headers).send(live({ slug: 'chosen' }));
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('cleardrivelk');

    const updated = await request(app).put(`/api/projects/${created.body.data._id}`).set(headers).send({ slug: 'hijack' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.slug).toBe('cleardrivelk');
  });
});

// ── the page's sections and the new fields ──────────────────────────────────
describe('Project page fields', () => {
  it('a PUBLISHED project needs at least one section', async () => {
    const err = await validationError(new Project(live({ sections: [], slug: 'x' })));
    expect(err.errors.sections.message).toMatch(/needs a page/);
  });

  it('a DRAFT may have no sections, and a half-written one', async () => {
    const p = new Project({ title: 'Draft', published: false, slug: 'draft', sections: [{ heading: '' }] });
    expect(await validationError(p)).toBeUndefined();
  });

  it('a published section needs a heading and some content (PF-144: a picture counts)', async () => {
    const noText = await validationError(new Project(live({ slug: 'x', sections: [{ heading: 'Empty' }] })));
    expect(String(noText)).toMatch(/at least one paragraph, bullet or picture/);
    const noHeading = await validationError(new Project(live({ slug: 'x', sections: [{ body: ['x'] }] })));
    expect(noHeading.errors['sections.0.heading'].message).toMatch(/heading is required/);
  });

  it('takes at most ONE category, trimmed, repeats dropped', async () => {
    expect(new Project(live({ categories: [' Web App ', 'Web App'] })).categories).toEqual(['Web App']);
    const err = await validationError(new Project(live({ slug: 'x', categories: ['Web App', 'API'] })));
    expect(err.errors.categories.message).toMatch(/one category/);
  });

  it('keeps role, client and dates', async () => {
    const p = await Project.create(live({ role: 'Solo developer', client: 'Freelance', startedOn: '2024-02', ongoing: true }));
    expect(p.toObject()).toMatchObject({ role: 'Solo developer', client: 'Freelance', startedOn: '2024-02', endedOn: '', ongoing: true });
  });

  it.each([
    ['an end before the start', { startedOn: '2025-06', endedOn: '2025-01' }, 'endedOn', /before the start/],
    ['an end on an ongoing project', { startedOn: '2025-06', endedOn: '2025-08', ongoing: true }, 'ongoing', /no end date/],
    ['a date that is not one', { startedOn: '2025-13' }, 'startedOn', /month and year/],
    ['a role over 80 characters', { role: 'x'.repeat(81) }, 'role', /80/],
  ])('refuses %s', async (_name, over, path, message) => {
    const err = await validationError(new Project(live({ slug: 'x', ...over })));
    expect(err.errors[path].message).toMatch(message);
  });

  it('an end in the same year as a month start is fine ("2025" after "2025-06")', async () => {
    expect(await validationError(new Project(live({ slug: 'x', startedOn: '2025-06', endedOn: '2025' })))).toBeUndefined();
  });
});

// ── GET /api/projects — the search ──────────────────────────────────────────
describe('GET /api/projects ?q= ?tech= ?category=', () => {
  beforeEach(async () => {
    await Project.create([
      live({ title: 'Alpha', order: 1, tech: ['React', 'Docker'], categories: ['Web App'], role: 'Team lead' }),
      live({ title: 'Beta', order: 2, tech: ['React Native'], categories: ['Mobile'], client: 'Freelance',
             sections: [{ heading: 'Key Features', bullets: ['Offline sync with SQLite'] }] }),
      live({ title: 'Gamma', order: 3, tech: ['Docker'], description: 'A c++ thing.' }),
      { title: 'Secret draft', published: false, tech: ['React'] },
    ]);
  });

  const titles = async (query) =>
    (await request(app).get('/api/projects').query(query)).body.data.map((p) => p.title);

  it('no params → every published project, in order', async () => {
    expect(await titles({})).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it.each([
    ['a title',          'alph',     ['Alpha']],
    ['the summary',      'C++',      ['Gamma']],
    ['the role',         'team lead', ['Alpha']],
    ['the client',       'freelance', ['Beta']],
    ['the category',     'mobile',   ['Beta']],
    ['a tech',           'docker',   ['Alpha', 'Gamma']],
    ['a section bullet', 'sqlite',   ['Beta']],
    ['a section heading', 'key feat', ['Beta']],
  ])('?q= finds %s', async (_name, q, expected) => {
    expect(await titles({ q })).toEqual(expected);
  });

  // Owner, 2026-11-03: "full stack" found nothing while "full-stack" did.
  it('?q= forgives separators and takes words in any order', async () => {
    await Project.updateOne({ title: 'Alpha' }, { description: 'A full-stack thing on Node.js.' });
    expect(await titles({ q: 'full stack' })).toEqual(['Alpha']);
    expect(await titles({ q: 'fullstack' })).toEqual(['Alpha']);
    expect(await titles({ q: 'nodejs team' })).toEqual(['Alpha']);
    expect(await titles({ q: 'full stack mobile' })).toEqual([]);
  });

  it('?q= never finds a draft', async () => {
    expect(await titles({ q: 'secret' })).toEqual([]);
  });

  it('?tech= is EXACT — React does not match React Native', async () => {
    expect(await titles({ tech: 'react' })).toEqual(['Alpha']);
  });

  it('several ?tech= are ANDed', async () => {
    expect(await titles({ tech: ['React', 'Docker'] })).toEqual(['Alpha']);
    expect(await titles({ tech: ['Docker'] })).toEqual(['Alpha', 'Gamma']);
  });

  it('?category= filters, and combines with ?q=', async () => {
    expect(await titles({ category: 'Web App' })).toEqual(['Alpha']);
    expect(await titles({ category: 'Web App', q: 'beta' })).toEqual([]);
  });

  it('All and blank values mean no filter', async () => {
    expect(await titles({ tech: 'All', category: '', q: '  ' })).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('regex characters are matched literally', async () => {
    expect(await titles({ q: '.*' })).toEqual([]);
  });

  it('is still CDN-cached', async () => {
    const res = await request(app).get('/api/projects?q=alpha');
    expect(res.headers['vercel-cache-tag']).toBe('public-data');
  });
});

// ── GET /api/projects/:slug ─────────────────────────────────────────────────
describe('GET /api/projects/:slug', () => {
  beforeEach(async () => {
    await Project.create([
      live({ title: 'Alpha', order: 1 }),
      live({ title: 'Beta', order: 2 }),
      live({ title: 'Gamma', order: 3 }),
      { title: 'Draft', published: false, order: 0 },
    ]);
  });

  it('returns the project with its place in the list and its neighbours', async () => {
    const res = await request(app).get('/api/projects/beta');
    expect(res.status).toBe(200);
    expect(res.headers['vercel-cache-tag']).toBe('public-data');
    expect(res.body.data.project).toMatchObject({ title: 'Beta', sections: SECTIONS });
    expect(res.body.data).toMatchObject({
      index: 1, total: 3,
      prev: { slug: 'alpha', title: 'Alpha' },
      next: { slug: 'gamma', title: 'Gamma' },
    });
  });

  it('wraps round at the ends', async () => {
    const res = await request(app).get('/api/projects/gamma');
    expect(res.body.data).toMatchObject({ index: 2, next: { slug: 'alpha' }, prev: { slug: 'beta' } });
  });

  it('a draft is a 404 — not a 403', async () => {
    const res = await request(app).get('/api/projects/draft');
    expect(res.status).toBe(404);
  });

  it('an unknown slug is a 404, and is never cached', async () => {
    const res = await request(app).get('/api/projects/nope');
    expect(res.status).toBe(404);
    expect(res.headers['vercel-cache-tag']).toBeUndefined();
  });

  it('a single project has no neighbours', async () => {
    await Project.deleteMany({ title: { $ne: 'Alpha' } });
    const res = await request(app).get('/api/projects/alpha');
    expect(res.body.data).toMatchObject({ index: 0, total: 1, prev: null, next: null });
  });
});

// ── the `category` vocabulary ───────────────────────────────────────────────
describe('vocabulary type "category"', () => {
  it('?inUse=true lists only categories a PUBLISHED project carries', async () => {
    await Vocabulary.create([{ type: 'category', value: 'Web App' }, { type: 'category', value: 'Mobile' }, { type: 'category', value: 'API' }]);
    await Project.create([live({ categories: ['Web App'] }), { title: 'D', published: false, categories: ['Mobile'] }]);

    const res = await request(app).get('/api/vocabulary/category?inUse=true');
    expect(res.body.data.map((v) => v.value)).toEqual(['Web App']);
  });

  it('deleting a category strips it from the projects using it (it is optional)', async () => {
    const [item] = await Vocabulary.create([{ type: 'category', value: 'Web App' }]);
    const p = await Project.create(live({ categories: ['Web App'] }));

    const res = await request(app).delete(`/api/vocabulary/category/${item._id}`).set(await authHeader());
    expect(res.status).toBe(200);
    expect((await Project.findById(p._id)).categories).toEqual([]);
  });
});
