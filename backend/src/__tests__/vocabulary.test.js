const request    = require('supertest');
const mongoose   = require('mongoose');
const jwt        = require('jsonwebtoken');
const app        = require('../app');
const Vocabulary = require('../models/Vocabulary');
const Project    = require('../models/Project');
const User       = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

describe('Vocabulary model (PF-61)', () => {

  it('accepts a valid tech entry', () => {
    const v = new Vocabulary({ type: 'tech', value: 'React' });
    expect(v.validateSync()).toBeUndefined();
  });

  it('accepts a valid tag entry', () => {
    const v = new Vocabulary({ type: 'tag', value: 'DevOps' });
    expect(v.validateSync()).toBeUndefined();
  });

  it('rejects an invalid type', () => {
    const v = new Vocabulary({ type: 'category', value: 'React' });
    const err = v.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.type).toBeDefined();
  });

  it('requires a value', () => {
    const v = new Vocabulary({ type: 'tech' });
    expect(v.validateSync().errors.value).toBeDefined();
  });

  it('allows real tech names with dots, plus, hash and slash', () => {
    for (const name of ['Node.js', 'C++', 'C#', 'CI/CD', 'Tailwind-CSS']) {
      const v = new Vocabulary({ type: 'tech', value: name });
      expect(v.validateSync()).toBeUndefined();
    }
  });

  it('rejects angle brackets', () => {
    const v = new Vocabulary({ type: 'tech', value: '<script>' });
    expect(v.validateSync().errors.value).toBeDefined();
  });

  it('rejects a value over 40 characters', () => {
    const v = new Vocabulary({ type: 'tech', value: 'x'.repeat(41) });
    expect(v.validateSync().errors.value).toBeDefined();
  });

  it('trims whitespace', () => {
    const v = new Vocabulary({ type: 'tech', value: '  React  ' });
    expect(v.value).toBe('React');
  });

  it('defaults order to 0', () => {
    const v = new Vocabulary({ type: 'tech', value: 'React' });
    expect(v.order).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PF-62 — the HTTP layer. These hit the database, so unlike the model tests
// above they need the shared connect/clear/disconnect lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
};

const VALID_PROJECT = {
  title:       'ZZTestProject',
  description: 'A project used to prove the cascade delete works.',
  tech:        ['React'],
  githubUrl:   'https://github.com/test/cascade',
};

describe('Vocabulary API (PF-62)', () => {

  beforeAll(async () => {
    await connectTestDB();
    // The compound unique index is built asynchronously. Without this, the
    // duplicate test can run before the index exists and get a 201, not a 409.
    await Vocabulary.init();
  });
  afterEach(clearDB);
  afterAll(disconnectTestDB);

  it('GET /:type returns a list', async () => {
    await Vocabulary.create({ type: 'tech', value: 'ZZTestListed' });

    const res = await request(app).get('/api/vocabulary/tech');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(v => v.value === 'ZZTestListed')).toBe(true);
  });

  it('GET rejects an invalid type', async () => {
    const res = await request(app).get('/api/vocabulary/category');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tag.*tech|tech.*tag/i);
  });

  it('POST requires authentication', async () => {
    const res = await request(app)
      .post('/api/vocabulary/tech')
      .send({ value: 'ZZTestChip' });
    expect(res.status).toBe(401);
  });

  it('POST creates a chip', async () => {
    const res = await request(app)
      .post('/api/vocabulary/tech')
      .set(await authHeader())
      .send({ value: 'ZZTestChip' });

    expect(res.status).toBe(201);
    expect(res.body.data.value).toBe('ZZTestChip');
    expect(res.body.data.type).toBe('tech');
  });

  it('POST returns 409 on a duplicate', async () => {
    await Vocabulary.create({ type: 'tech', value: 'ZZTestDupe' });

    const res = await request(app)
      .post('/api/vocabulary/tech')
      .set(await authHeader())
      .send({ value: 'ZZTestDupe' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('impact reports how many documents use the value', async () => {
    const chip = await Vocabulary.create({ type: 'tech', value: 'ZZTestUsed' });
    await Project.create({ ...VALID_PROJECT, tech: ['React', 'ZZTestUsed'] });

    const res = await request(app)
      .get(`/api/vocabulary/tech/${chip._id}/impact`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.affected).toBe(1);
    expect(res.body.data.label).toBe('projects');
  });

  it('DELETE strips the value from content (Option B cascade)', async () => {
    const chip = await Vocabulary.create({ type: 'tech', value: 'ZZTestCascade' });
    const proj = await Project.create({ ...VALID_PROJECT, tech: ['React', 'ZZTestCascade'] });

    const res = await request(app)
      .delete(`/api/vocabulary/tech/${chip._id}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.strippedFrom).toBe(1);

    const after = await Project.findById(proj._id);
    expect([...after.tech]).toEqual(['React']);                // stripped from content
    expect(await Vocabulary.findById(chip._id)).toBeNull();    // removed from vocabulary
  });

  it('DELETE returns 404 for an unknown id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/vocabulary/tech/${fakeId}`)
      .set(await authHeader());

    expect(res.status).toBe(404);
  });

});
