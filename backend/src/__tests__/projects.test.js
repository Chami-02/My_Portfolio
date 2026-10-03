const request   = require('supertest');
const { issueSession } = require('../services/sessionService');
const app       = require('../app');
const Project   = require('../models/Project');
const User      = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const VALID_PROJECT = {
  title:       'Test Project',
  description: 'A valid test project description for our integration tests.',
  tech:        ['JavaScript', 'Node.js'],
  githubUrl:   'https://github.com/test/project',
};

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

describe('GET /api/projects', () => {
  it('returns 200 with an empty array when no projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns all seeded projects', async () => {
    await Project.create(VALID_PROJECT);
    await Project.create({ ...VALID_PROJECT, title: 'Second Project' });

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('sorts projects by order ASC', async () => {
    await Project.create({ ...VALID_PROJECT, title: 'Last',  order: 3 });
    await Project.create({ ...VALID_PROJECT, title: 'First', order: 1 });
    await Project.create({ ...VALID_PROJECT, title: 'Mid',   order: 2 });

    const res = await request(app).get('/api/projects');
    expect(res.body.data[0].title).toBe('First');
    expect(res.body.data[1].title).toBe('Mid');
    expect(res.body.data[2].title).toBe('Last');
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a single project by valid ID', async () => {
    const project = await Project.create(VALID_PROJECT);
    const res = await request(app).get(`/api/projects/${project._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(VALID_PROJECT.title);
  });

  it('returns 404 for a nonexistent but valid ObjectId', async () => {
    const res = await request(app).get('/api/projects/000000000000000000000000');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns 400 for an invalid ObjectId format', async () => {
    const res = await request(app).get('/api/projects/not-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });
});

describe('POST /api/projects (no auth — will need token after PF-35)', () => {
  it('creates a project with valid data', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send(VALID_PROJECT);
    // Without auth the route is currently open (protect commented out)
    // This test verifies the controller logic
    expect([201, 401]).toContain(res.status);
  });

  it('rejects a project with missing title', async () => {
    const { title, ...withoutTitle } = VALID_PROJECT;
    const res = await request(app)
      .post('/api/projects')
      .send(withoutTitle);
    expect([400, 401]).toContain(res.status);
  });
});

describe('Protected project routes', () => {
  it('creates a project when authenticated', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(await authHeader())
      .send(VALID_PROJECT);

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(VALID_PROJECT.title);
  });

  it('returns 400 for invalid project data when authenticated', async () => {
    const { title, ...withoutTitle } = VALID_PROJECT;

    const res = await request(app)
      .post('/api/projects')
      .set(await authHeader())
      .send(withoutTitle);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/i);
  });

  it('updates a project when authenticated', async () => {
    const project = await Project.create(VALID_PROJECT);

    const res = await request(app)
      .put(`/api/projects/${project._id}`)
      .set(await authHeader())
      .send({ title: 'Updated Project' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Project');
  });

  it('returns 404 when updating a missing project', async () => {
    const res = await request(app)
      .put('/api/projects/000000000000000000000000')
      .set(await authHeader())
      .send({ title: 'Updated Project' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when updating an invalid project id', async () => {
    const res = await request(app)
      .put('/api/projects/not-valid-id')
      .set(await authHeader())
      .send({ title: 'Updated Project' });

    expect(res.status).toBe(400);
  });

  it('deletes a project when authenticated', async () => {
    const project = await Project.create(VALID_PROJECT);

    const res = await request(app)
      .delete(`/api/projects/${project._id}`)
      .set(await authHeader());

    expect(res.status).toBe(204);
    await expect(Project.findById(project._id)).resolves.toBeNull();
  });

  it('returns 404 when deleting a missing project', async () => {
    const res = await request(app)
      .delete('/api/projects/000000000000000000000000')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });
});

// ── PF-113: drafts ───────────────────────────────────────────────────────────
// A draft is invisible on the public site and may be half-finished: only a
// title is required until it is published.
describe('Project drafts (PF-113)', () => {
  const DRAFT = { title: 'Half-written', published: false };

  it('GET /api/projects never returns a draft — the ZERO case', async () => {
    await Project.create(DRAFT);

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('GET /api/projects returns published ones beside a draft', async () => {
    await Project.create(DRAFT);
    await Project.create(VALID_PROJECT);

    const res = await request(app).get('/api/projects');

    expect(res.body.data.map((p) => p.title)).toEqual([VALID_PROJECT.title]);
  });

  // ⚠️ The legacy row is what `published: true` as a filter would hide: every
  // project written before PF-113 has no `published` field at all. Raw driver,
  // so Mongoose cannot add the default on the way in.
  it('GET /api/projects still returns a project with NO published field', async () => {
    await Project.collection.insertOne({ ...VALID_PROJECT, order: 0 });

    const res = await request(app).get('/api/projects');

    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/projects/:id answers 404 for a draft', async () => {
    const draft = await Project.create(DRAFT);

    const res = await request(app).get(`/api/projects/${draft._id}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/projects/admin/all is 401 without a token', async () => {
    const res = await request(app).get('/api/projects/admin/all');
    expect(res.status).toBe(401);
  });

  it('GET /api/projects/admin/all includes drafts', async () => {
    await Project.create(DRAFT);
    await Project.create(VALID_PROJECT);

    const res = await request(app).get('/api/projects/admin/all').set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.title).sort())
      .toEqual([DRAFT.title, VALID_PROJECT.title].sort());
  });

  it('POST creates a title-only draft', async () => {
    const res = await request(app).post('/api/projects').set(await authHeader()).send(DRAFT);

    expect(res.status).toBe(201);
    expect(res.body.data.published).toBe(false);
  });

  it('POST still requires a title on a draft', async () => {
    const res = await request(app).post('/api/projects').set(await authHeader())
      .send({ published: false, description: 'no title' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/i);
  });

  it('POST of an incomplete PUBLISHED project is 400', async () => {
    const res = await request(app).post('/api/projects').set(await authHeader())
      .send({ title: 'Only a title' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/GitHub URL is required/);
  });

  // ⚠️ The case findByIdAndUpdate gets wrong. With update validators `this`
  // is the Query, so `this.published` is undefined — the draft condition then
  // answers "published" on the fields being SET, but only those, and a body
  // of `{ published: true }` alone validates nothing. Publishing an empty
  // draft must be refused.
  it('PUT publishing an incomplete draft is 400, and it stays a draft', async () => {
    const draft = await Project.create(DRAFT);

    const res = await request(app).put(`/api/projects/${draft._id}`)
      .set(await authHeader()).send({ published: true });

    expect(res.status).toBe(400);
    expect((await Project.findById(draft._id)).published).toBe(false);
  });

  it('PUT editing a draft does not demand the published fields', async () => {
    const draft = await Project.create(DRAFT);

    const res = await request(app).put(`/api/projects/${draft._id}`)
      .set(await authHeader()).send({ title: 'Still half-written', description: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Still half-written');
  });

  it('PUT publishes a draft once it is complete', async () => {
    const draft = await Project.create(DRAFT);

    const res = await request(app).put(`/api/projects/${draft._id}`)
      .set(await authHeader()).send({ ...VALID_PROJECT, published: true });

    expect(res.status).toBe(200);
    expect(res.body.data.published).toBe(true);
    expect((await request(app).get('/api/projects')).body.data).toHaveLength(1);
  });
});

// ── PF-113: both links render as public hrefs ───────────────────────────────
describe('Project URLs must be http(s) (PF-113)', () => {
  it.each([
    ['githubUrl', 'javascript:alert(1)'],
    ['liveUrl',   'javascript:alert(1)'],
    ['githubUrl', 'data:text/html,<script>alert(1)</script>'],
    ['liveUrl',   'not a url'],
  ])('POST refuses %s = %s', async (field, value) => {
    const res = await request(app).post('/api/projects').set(await authHeader())
      .send({ ...VALID_PROJECT, [field]: value });

    expect(res.status).toBe(400);
    expect(await Project.countDocuments()).toBe(0);
  });

  it('PUT refuses a javascript: liveUrl', async () => {
    const p = await Project.create(VALID_PROJECT);

    const res = await request(app).put(`/api/projects/${p._id}`)
      .set(await authHeader()).send({ liveUrl: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
  });

  it('accepts a blank liveUrl', async () => {
    const res = await request(app).post('/api/projects').set(await authHeader())
      .send({ ...VALID_PROJECT, liveUrl: '' });

    expect(res.status).toBe(201);
  });
});
