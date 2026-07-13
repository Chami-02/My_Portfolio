const request = require('supertest');
const app     = require('../app');
const Skill   = require('../models/Skill');
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
});
