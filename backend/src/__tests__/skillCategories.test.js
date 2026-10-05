// PF-114 — owner-managed Skills SECTIONS (/api/skill-categories).
const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app           = require('../app');
const Skill         = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const User          = require('../models/User');
const { DEFAULT_CATEGORIES, slugify } = require('../controllers/skillCategoryController');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };
const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

const seedDefaults = () => SkillCategory.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
const byKey = (key) => SkillCategory.findOne({ key });

describe('GET /api/skill-categories', () => {
  it('creates the six defaults on first read of an EMPTY collection', async () => {
    const res = await request(app).get('/api/skill-categories');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.key))
      .toEqual(['language', 'frontend', 'backend', 'database', 'devops', 'other']);
    expect(res.body.data.map((c) => c.label))
      .toEqual(['Languages', 'Frontend', 'Backend', 'Database', 'DevOps', 'Other']);
  });

  // ⚠️ The guard that makes lazy defaults safe: they must NEVER come back
  // once the collection holds anything.
  it('never re-adds defaults to a collection that has sections', async () => {
    await SkillCategory.create({ key: 'soft', label: 'Soft Skills', order: 1 });
    const res = await request(app).get('/api/skill-categories');
    expect(res.body.data.map((c) => c.key)).toEqual(['soft']);
  });

  it('returns sections in order', async () => {
    await SkillCategory.create([
      { key: 'b', label: 'B', order: 2 },
      { key: 'a', label: 'A', order: 1 },
    ]);
    const res = await request(app).get('/api/skill-categories');
    expect(res.body.data.map((c) => c.key)).toEqual(['a', 'b']);
  });
});

describe('POST /api/skill-categories', () => {
  it('requires authentication — 401 even with a bad body', async () => {
    const res = await request(app).post('/api/skill-categories').send({});
    expect(res.status).toBe(401);
  });

  it('creates a section LAST, with a slug key', async () => {
    await seedDefaults();
    const res = await request(app).post('/api/skill-categories')
      .set(await authHeader()).send({ label: '  Soft Skills ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ key: 'soft-skills', label: 'Soft Skills', order: 7 });
  });

  it('refuses a name that exists, case-insensitively', async () => {
    await seedDefaults();
    const res = await request(app).post('/api/skill-categories')
      .set(await authHeader()).send({ label: 'devops' });
    expect(res.status).toBe(409);
  });

  it('refuses a blank name and one over 40 characters', async () => {
    const auth = await authHeader();
    expect((await request(app).post('/api/skill-categories').set(auth).send({ label: '  ' })).status).toBe(400);
    expect((await request(app).post('/api/skill-categories').set(auth).send({ label: 'x'.repeat(41) })).status).toBe(400);
  });

  it('gives a colliding slug a suffix', async () => {
    await SkillCategory.create({ key: 'c', label: 'C', order: 1 });
    const res = await request(app).post('/api/skill-categories')
      .set(await authHeader()).send({ label: 'C++' });
    expect(res.body.data.key).toBe('c-2');
  });

  it('slugify keeps letters and digits only', () => {
    expect(slugify('Cloud & DevOps!')).toBe('cloud-devops');
    expect(slugify('***')).toBe('section');
  });
});

describe('PUT /api/skill-categories/:id — rename', () => {
  it('changes the label and NEVER the key, so no skill needs rewriting', async () => {
    await seedDefaults();
    await Skill.create({ name: 'Git', category: 'devops', level: 'beginner', order: 1 });
    const devops = await byKey('devops');

    const res = await request(app).put(`/api/skill-categories/${devops._id}`)
      .set(await authHeader()).send({ label: 'Tools & DevOps' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ key: 'devops', label: 'Tools & DevOps' });
    expect((await Skill.findOne({ name: 'Git' })).category).toBe('devops');
  });

  it('may keep its own name in a different case', async () => {
    await seedDefaults();
    const devops = await byKey('devops');
    const res = await request(app).put(`/api/skill-categories/${devops._id}`)
      .set(await authHeader()).send({ label: 'DEVOPS' });
    expect(res.status).toBe(200);
  });

  it('refuses another section\'s name', async () => {
    await seedDefaults();
    const devops = await byKey('devops');
    const res = await request(app).put(`/api/skill-categories/${devops._id}`)
      .set(await authHeader()).send({ label: 'frontend' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/skill-categories/reorder', () => {
  it('requires authentication', async () => {
    expect((await request(app).put('/api/skill-categories/reorder').send({ ids: 'x' })).status).toBe(401);
  });

  it('writes the new order', async () => {
    const [a, b, c] = await SkillCategory.create([
      { key: 'a', label: 'A', order: 1 }, { key: 'b', label: 'B', order: 2 }, { key: 'c', label: 'C', order: 3 },
    ]);
    const res = await request(app).put('/api/skill-categories/reorder')
      .set(await authHeader()).send({ ids: [c._id, a._id, b._id] });
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.key)).toEqual(['c', 'a', 'b']);
  });

  it('refuses a partial list', async () => {
    const [a, b] = await SkillCategory.create([
      { key: 'a', label: 'A', order: 1 }, { key: 'b', label: 'B', order: 2 }, { key: 'c', label: 'C', order: 3 },
    ]);
    const res = await request(app).put('/api/skill-categories/reorder')
      .set(await authHeader()).send({ ids: [b._id, a._id] });
    expect(res.status).toBe(400);
    expect((await byKey('a')).order).toBe(1);
  });
});

describe('DELETE /api/skill-categories/:id — the three choices', () => {
  let soft;
  let other;
  beforeEach(async () => {
    await seedDefaults();
    soft = await SkillCategory.create({ key: 'soft', label: 'Soft Skills', order: 7 });
    other = await byKey('other');
  });

  const addSoftSkills = () => Skill.create([
    { name: 'Teamwork',      category: 'soft', level: 'advanced', order: 30 },
    { name: 'Communication', category: 'soft', level: 'advanced', order: 31 },
  ]);

  it('requires authentication', async () => {
    expect((await request(app).delete(`/api/skill-categories/${soft._id}`)).status).toBe(401);
  });

  it('deletes an EMPTY section outright', async () => {
    const res = await request(app).delete(`/api/skill-categories/${soft._id}`).set(await authHeader());
    expect(res.status).toBe(200);
    expect(await byKey('soft')).toBeNull();
  });

  it('REFUSES a section with skills when no choice is given — nothing is lost', async () => {
    await addSoftSkills();
    const res = await request(app).delete(`/api/skill-categories/${soft._id}`).set(await authHeader());
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('"Soft Skills" still has 2 skills — move or delete them first');
    expect(await byKey('soft')).not.toBeNull();
    expect(await Skill.countDocuments({ category: 'soft' })).toBe(2);
  });

  it('MOVE & DELETE: skills go to the END of the target, in their order, then the section goes', async () => {
    await addSoftSkills();
    await Skill.create({ name: 'Last', category: 'devops', level: 'beginner', order: 40 });

    const res = await request(app).delete(`/api/skill-categories/${soft._id}`)
      .set(await authHeader()).send({ moveTo: other._id });

    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(2);
    const moved = await Skill.find({ category: 'other' }).sort({ order: 1 });
    expect(moved.map((s) => [s.name, s.order])).toEqual([['Teamwork', 41], ['Communication', 42]]);
    expect(await byKey('soft')).toBeNull();
  });

  it('MOVE refuses itself as the target and an unknown target, and changes nothing', async () => {
    await addSoftSkills();
    const auth = await authHeader();
    const self = await request(app).delete(`/api/skill-categories/${soft._id}`).set(auth).send({ moveTo: soft._id });
    const ghost = await request(app).delete(`/api/skill-categories/${soft._id}`).set(auth)
      .send({ moveTo: '000000000000000000000000' });
    expect(self.status).toBe(400);
    expect(ghost.status).toBe(400);
    expect(await Skill.countDocuments({ category: 'soft' })).toBe(2);
  });

  it('DELETE SECTION + SKILLS removes both', async () => {
    await addSoftSkills();
    const res = await request(app).delete(`/api/skill-categories/${soft._id}`)
      .set(await authHeader()).send({ deleteSkills: true });
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(2);
    expect(await Skill.countDocuments({ category: 'soft' })).toBe(0);
    expect(await byKey('soft')).toBeNull();
  });

  // ⚠️ `deleteSkills` must be the boolean, not merely truthy — a stray string
  // must never be read as "delete my skills".
  it('a truthy non-boolean deleteSkills is NOT a delete', async () => {
    await addSoftSkills();
    const res = await request(app).delete(`/api/skill-categories/${soft._id}`)
      .set(await authHeader()).send({ deleteSkills: 'yes' });
    expect(res.status).toBe(409);
    expect(await Skill.countDocuments({ category: 'soft' })).toBe(2);
  });

  it('refuses to delete the LAST section — so lazy defaults can never resurrect', async () => {
    await SkillCategory.deleteMany({ key: { $ne: 'soft' } });
    const res = await request(app).delete(`/api/skill-categories/${soft._id}`).set(await authHeader());
    expect(res.status).toBe(400);
    expect(await byKey('soft')).not.toBeNull();
  });
});

describe('skills must name a section that exists', () => {
  beforeEach(seedDefaults);

  it('POST /api/skills refuses an unknown section', async () => {
    const res = await request(app).post('/api/skills').set(await authHeader())
      .send({ name: 'X', category: 'nope', level: 'beginner' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Choose a section that exists');
  });

  it('POST /api/skills accepts an owner-created section', async () => {
    await SkillCategory.create({ key: 'soft', label: 'Soft Skills', order: 7 });
    const res = await request(app).post('/api/skills').set(await authHeader())
      .send({ name: 'Teamwork', category: 'soft', level: 'advanced' });
    expect(res.status).toBe(201);
  });

  it('PUT /api/skills/:id refuses an unknown section', async () => {
    const skill = await Skill.create({ name: 'Git', category: 'devops', level: 'beginner', order: 1 });
    const res = await request(app).put(`/api/skills/${skill._id}`).set(await authHeader())
      .send({ category: 'nope' });
    expect(res.status).toBe(400);
    expect((await Skill.findById(skill._id)).category).toBe('devops');
  });
});
