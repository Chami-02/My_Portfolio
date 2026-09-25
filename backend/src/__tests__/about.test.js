const request = require('supertest');
const { issueSession } = require('../services/sessionService');
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
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
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

  // ── PF-112: authentication is the FIRST gate ────────────────────────────
  // The route used to run `aboutRules, validate, protect`, so express-validator
  // rejected the body before `protect` ever looked at the headers. An anonymous
  // caller therefore received a 400 NAMING THE FIELD IT DISLIKED — a free
  // description of the schema to someone with no credentials at all.
  //
  // ⚠️ The body has to be one `aboutRules` actually rejects, or this passes for
  // the wrong reason: a payload nothing validates reaches `protect` regardless
  // of the ordering, and the test would stay green through a revert.
  it('answers an anonymous PUT with 401, not a 400 describing the schema', async () => {
    const res = await request(app)
      .put('/api/about')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(401);
    expect(res.body.message).not.toMatch(/valid email/i);
  });

  // ── PF-112: availableForWork travels on the profile PUT ──────────────────
  // The admin panel stages every edit and commits them together, so the
  // availability flag arrives here rather than through PATCH /availability.
  describe('availableForWork', () => {
    it('rejects a non-boolean availability', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ availableForWork: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/true or false/i);
    });

    // ⚠️ THE CASE THAT MATTERS. `false` is falsy, so a rule or a payload builder
    // that conflates "absent" with "false" would validate fine and then simply
    // never write it — leaving the owner permanently marked as available with
    // every request reporting success.
    it('persists availableForWork: false', async () => {
      await About.create({ availableForWork: true });

      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ availableForWork: false });

      expect(res.status).toBe(200);
      expect(res.body.data.availableForWork).toBe(false);
      await expect(
        About.findOne({}).then((d) => d.availableForWork)
      ).resolves.toBe(false);
    });

    it('accepts availableForWork: true', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ availableForWork: true });

      expect(res.status).toBe(200);
      expect(res.body.data.availableForWork).toBe(true);
    });
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
