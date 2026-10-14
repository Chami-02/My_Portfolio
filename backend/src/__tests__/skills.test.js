const request = require('supertest');
const { issueSession } = require('../services/sessionService');
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
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
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
    // PF-114: categories became owner-managed SECTIONS; the enum message
    // ("not a valid category") gave way to the section-existence check.
    expect(res.body.message).toBe('Choose a section that exists');
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

// ── PF-114 ───────────────────────────────────────────────────────────────────

describe('PF-114 — a new skill lands at the END of its card', () => {
  it('takes one past the highest order when none is sent', async () => {
    await Skill.create({ ...VALID_SKILL, name: 'A', order: 7 });
    await Skill.create({ ...VALID_SKILL, name: 'B', category: 'devops', order: 26 });

    const res = await request(app)
      .post('/api/skills')
      .set(await authHeader())
      .send({ name: 'New', category: 'language', level: 'beginner' });

    expect(res.status).toBe(201);
    // 27, not the schema's default 0 — which sorted BEFORE every seeded skill
    // and put the new one at the FRONT of its card on the public site.
    expect(res.body.data.order).toBe(27);
  });

  it('takes 1 in an empty collection', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set(await authHeader())
      .send({ name: 'First', category: 'language', level: 'beginner' });

    expect(res.body.data.order).toBe(1);
  });

  it('keeps an explicit numeric order', async () => {
    await Skill.create({ ...VALID_SKILL, name: 'A', order: 7 });
    const res = await request(app)
      .post('/api/skills')
      .set(await authHeader())
      .send({ name: 'Pinned', category: 'language', level: 'beginner', order: 3 });

    expect(res.body.data.order).toBe(3);
  });
});

describe('PF-114 — PUT /api/skills/:id reports its own errors', () => {
  it('returns 409, not 500, when renamed to an existing name', async () => {
    await Skill.create({ ...VALID_SKILL, name: 'Taken' });
    const skill = await Skill.create({ ...VALID_SKILL, name: 'Mine', order: 2 });

    const res = await request(app)
      .put(`/api/skills/${skill._id}`)
      .set(await authHeader())
      .send({ name: 'Taken' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A skill named "Taken" already exists');
  });

  it('returns 400, not 500, for a level outside the enum', async () => {
    const skill = await Skill.create(VALID_SKILL);

    const res = await request(app)
      .put(`/api/skills/${skill._id}`)
      .set(await authHeader())
      .send({ level: 'expert' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid level/);
  });

  it('saves a level change — the owner re-grading a skill', async () => {
    const skill = await Skill.create({ ...VALID_SKILL, level: 'beginner' });

    const res = await request(app)
      .put(`/api/skills/${skill._id}`)
      .set(await authHeader())
      .send({ name: 'JavaScript', category: 'language', level: 'advanced' });

    expect(res.status).toBe(200);
    expect((await Skill.findById(skill._id)).level).toBe('advanced');
  });

  it('moves a skill to the END of its new card when the category changes', async () => {
    const skill = await Skill.create({ ...VALID_SKILL, name: 'Mover', order: 1 });
    await Skill.create({ ...VALID_SKILL, name: 'Last', category: 'devops', order: 26 });

    const res = await request(app)
      .put(`/api/skills/${skill._id}`)
      .set(await authHeader())
      .send({ category: 'devops' });

    expect(res.body.data.order).toBe(27);
  });

  it('keeps its slot when the category is sent UNCHANGED', async () => {
    // The panel always sends all three fields, so "category present" must not
    // be read as "category changed" — or every typo fix would shove the skill
    // to the end of its own card.
    const skill = await Skill.create({ ...VALID_SKILL, name: 'Stay', order: 4 });
    await Skill.create({ ...VALID_SKILL, name: 'Other', order: 20 });

    const res = await request(app)
      .put(`/api/skills/${skill._id}`)
      .set(await authHeader())
      .send({ name: 'Stayed', category: 'language', level: 'advanced' });

    expect(res.body.data.order).toBe(4);
  });
});

describe('PF-114 — PUT /api/skills/reorder', () => {
  const seedCards = async () => {
    const [a, b, c] = await Skill.create([
      { name: 'A', category: 'language', level: 'beginner', order: 1 },
      { name: 'B', category: 'language', level: 'beginner', order: 2 },
      { name: 'C', category: 'language', level: 'beginner', order: 5 },
    ]);
    const x = await Skill.create({ name: 'X', category: 'devops', level: 'beginner', order: 3 });
    return { a, b, c, x };
  };

  it('requires authentication, even with a malformed body', async () => {
    // 401, never a 400 describing the schema to an anonymous caller (PF-97).
    const res = await request(app).put('/api/skills/reorder').send({ ids: 'nope' });
    expect(res.status).toBe(401);
  });

  it('hands the card\'s OWN slots out in the new order and touches no other card', async () => {
    const { a, b, c, x } = await seedCards();

    const res = await request(app)
      .put('/api/skills/reorder')
      .set(await authHeader())
      .send({ ids: [c._id, a._id, b._id] });

    expect(res.status).toBe(200);
    const order = async (doc) => (await Skill.findById(doc._id)).order;
    // Slots 1, 2, 5 reused — NOT renumbered 1, 2, 3, which would collide
    // with devops' X at 3.
    expect(await order(c)).toBe(1);
    expect(await order(a)).toBe(2);
    expect(await order(b)).toBe(5);
    expect(await order(x)).toBe(3);
  });

  it('refuses ids from two categories', async () => {
    const { a, b, c, x } = await seedCards();
    const res = await request(app)
      .put('/api/skills/reorder')
      .set(await authHeader())
      .send({ ids: [a._id, b._id, c._id, x._id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/within one category/);
    expect((await Skill.findById(x._id)).order).toBe(3);   // nothing written
  });

  it('refuses a PART of a card', async () => {
    const { a, b } = await seedCards();
    const res = await request(app)
      .put('/api/skills/reorder')
      .set(await authHeader())
      .send({ ids: [b._id, a._id] });

    expect(res.status).toBe(400);
    expect((await Skill.findById(a._id)).order).toBe(1);
  });

  it('refuses an unknown id', async () => {
    const { a, b } = await seedCards();
    const res = await request(app)
      .put('/api/skills/reorder')
      .set(await authHeader())
      .send({ ids: [a._id, b._id, '000000000000000000000000'] });

    expect(res.status).toBe(400);
  });

  it('refuses a repeated id', async () => {
    const { a, b } = await seedCards();
    const res = await request(app)
      .put('/api/skills/reorder')
      .set(await authHeader())
      .send({ ids: [a._id, a._id, b._id] });

    expect(res.status).toBe(400);
  });

  it('refuses a malformed id and an empty list', async () => {
    const auth = await authHeader();
    const bad = await request(app).put('/api/skills/reorder').set(auth).send({ ids: ['nope'] });
    const empty = await request(app).put('/api/skills/reorder').set(auth).send({ ids: [] });

    expect(bad.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});

// ── A request body is data, never a database command (CodeQL, 2026-10-14) ───
// Measured before the fix: PUT with `{ "$rename": { "level": "zzz" } }` answered
// 200 and DELETED the required `level`; `$inc` and `$set` ran as well. Only
// name / category / level / order are copied now, each only as its own type.
describe('skills: the body cannot carry MongoDB operators or wrong types', () => {
  const seeded = async () => Skill.create({ ...VALID_SKILL, name: 'Probe', order: 1 });

  it.each([
    ['$rename', { $rename: { level: 'zzz' } }],
    ['$set',    { $set: { name: 'Hijacked' } }],
    ['$inc',    { $inc: { order: 1000 } }],
    ['$unset',  { $unset: { level: 1 } }],
  ])('PUT with %s changes nothing', async (_label, body) => {
    const skill = await seeded();
    await request(app).put(`/api/skills/${skill._id}`).set(await authHeader()).send(body);
    const after = await Skill.findById(skill._id).lean();
    expect(after.name).toBe('Probe');
    expect(after.level).toBe(VALID_SKILL.level);
    expect(after.order).toBe(1);
  });

  it.each([
    ['an object category', { category: { $ne: null } }, /category/],
    ['a numeric name',     { name: 42 },                 /name must be a string/],
    ['a string order',     { order: '3' },               /order must be a number/],
    ['an array level',     { level: ['advanced'] },      /level must be a string/],
  ])('PUT with %s is a 400 and changes nothing', async (_label, body, message) => {
    const skill = await seeded();
    const res = await request(app).put(`/api/skills/${skill._id}`).set(await authHeader()).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    const after = await Skill.findById(skill._id).lean();
    expect(after).toMatchObject({ name: 'Probe', category: VALID_SKILL.category, level: VALID_SKILL.level, order: 1 });
  });

  it('POST copies only the four fields — an operator key is dropped, not run', async () => {
    const res = await request(app).post('/api/skills').set(await authHeader())
      .send({ name: 'Clean', category: 'language', level: 'beginner', $set: { name: 'Dirty' } });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Clean');
  });

  it('POST with an object category is a 400', async () => {
    const res = await request(app).post('/api/skills').set(await authHeader())
      .send({ name: 'X', category: { $ne: null }, level: 'beginner' });
    expect(res.status).toBe(400);
    expect(await Skill.countDocuments({ name: 'X' })).toBe(0);
  });
});
