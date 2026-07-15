const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const About   = require('../models/About');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
};

describe('GET /api/about', () => {
  it('creates and returns a default profile when none exists', async () => {
    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.name).toBeDefined();
    await expect(About.countDocuments()).resolves.toBe(1);
  });

  it('returns the existing profile', async () => {
    await About.create({ name: 'Existing Admin', title: 'Developer' });

    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Existing Admin');
  });
});

describe('PUT /api/about', () => {
  it('upserts the profile when authenticated', async () => {
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({
        name:  'Updated Admin',
        title: 'Full Stack Developer',
        email: 'updated@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Admin');
    expect(res.body.data.title).toBe('Full Stack Developer');
  });

  it('rejects invalid profile input', async () => {
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  it('returns 400 for model validation errors', async () => {
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ stats: [{}] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });
});

describe('PATCH /api/about/availability', () => {
  it('toggles availability when authenticated', async () => {
    const about = await About.create({ availableForWork: true });
    const header = await authHeader();

    const unavailableRes = await request(app)
      .patch('/api/about/availability')
      .set(header);

    expect(unavailableRes.status).toBe(200);
    expect(unavailableRes.body.data.availableForWork).toBe(false);
    expect(unavailableRes.body.message).toMatch(/not available/i);

    const availableRes = await request(app)
      .patch('/api/about/availability')
      .set(header);

    expect(availableRes.status).toBe(200);
    expect(availableRes.body.data.availableForWork).toBe(true);
    expect(availableRes.body.data._id).toBe(about.id);
  });

  it('returns 404 when no profile exists', async () => {
    const res = await request(app)
      .patch('/api/about/availability')
      .set(await authHeader());

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/profile not found/i);
  });
});
