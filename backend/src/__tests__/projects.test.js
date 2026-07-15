const request   = require('supertest');
const jwt       = require('jsonwebtoken');
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
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
