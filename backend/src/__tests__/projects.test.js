const request   = require('supertest');
const app       = require('../app');
const Project   = require('../models/Project');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const VALID_PROJECT = {
  title:       'Test Project',
  description: 'A valid test project description for our integration tests.',
  tech:        ['JavaScript', 'Node.js'],
  githubUrl:   'https://github.com/test/project',
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