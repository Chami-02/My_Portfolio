const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const Skill   = require('../models/Skill');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const VALID_SKILL = {
  name:     'JavaScript',
  category: 'language',
  level:    'intermediate',
  order:    1,
};

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
};

describe('GET /api/skills', () => {
  it('returns 200 with an empty array when no skills exist', async () => {
    const res = await request(app).get('/api/skills');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns seeded skills sorted by order', async () => {
    await Skill.create({ ...VALID_SKILL, name: 'Second', order: 2 });
    await Skill.create({ ...VALID_SKILL, name: 'First', order: 1 });

    const res = await request(app).get('/api/skills');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('First');
    expect(res.body.data[1].name).toBe('Second');
  });
});

describe('POST /api/skills', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/skills')
      .send(VALID_SKILL);

    expect(res.status).toBe(401);
  });

  it('creates a skill when authenticated', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set(await authHeader())
      .send(VALID_SKILL);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(VALID_SKILL.name);
  });

  it('returns 400 for invalid skill data when authenticated', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set(await authHeader())
      .send({ ...VALID_SKILL, category: 'not-real' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/category/i);
  });

  it('returns 409 for duplicate skill names', async () => {
    await Skill.init();
    await Skill.create(VALID_SKILL);

    const res = await request(app)
      .post('/api/skills')
      .set(await authHeader())
      .send(VALID_SKILL);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

describe('PUT /api/skills/:id', () => {
  it('updates a skill when authenticated', async () => {
    const skill = await Skill.create(VALID_SKILL);

    const res = await request(app)
      .put(`/api/skills/${skill._id}`)
      .set(await authHeader())
      .send({ level: 'advanced' });

    expect(res.status).toBe(200);
    expect(res.body.data.level).toBe('advanced');
  });

  it('returns 404 when updating a missing skill', async () => {
    const res = await request(app)
      .put('/api/skills/000000000000000000000000')
      .set(await authHeader())
      .send({ level: 'advanced' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when updating an invalid skill id', async () => {
    const res = await request(app)
      .put('/api/skills/not-valid-id')
      .set(await authHeader())
      .send({ level: 'advanced' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/skills/:id', () => {
  it('deletes a skill when authenticated', async () => {
    const skill = await Skill.create(VALID_SKILL);

    const res = await request(app)
      .delete(`/api/skills/${skill._id}`)
      .set(await authHeader());

    expect(res.status).toBe(204);
    await expect(Skill.findById(skill._id)).resolves.toBeNull();
  });

  it('returns 404 when deleting a missing skill', async () => {
    const res = await request(app)
      .delete('/api/skills/000000000000000000000000')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });

  it('returns 400 when deleting an invalid skill id', async () => {
    const res = await request(app)
      .delete('/api/skills/not-valid-id')
      .set(await authHeader());

    expect(res.status).toBe(400);
  });
});
