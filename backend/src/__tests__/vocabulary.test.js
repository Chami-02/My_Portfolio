const request    = require('supertest');
const mongoose   = require('mongoose');
const jwt        = require('jsonwebtoken');
const app        = require('../app');
const Vocabulary = require('../models/Vocabulary');
const Project    = require('../models/Project');
const Blog       = require('../models/Blog');
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

  // ── PF-62 follow-up: transaction fallback ──────────────────────────────────
  // `transactional` must reflect what the SERVER supports, probed via
  // `hello`, not whether a client-side startTransaction() call happened to
  // not throw. The old implementation always reported true, because both
  // startSession() and startTransaction() are client-side and cannot fail
  // on a standalone server.
  //
  // These tests derive the expectation from the live topology, so they pass
  // on a replica set (Atlas, and CI once it moves off standalone) and on a
  // standalone mongod. On a replica set they prove the true branch; the
  // false branch is asserted below but only genuinely exercised when the
  // suite runs against a standalone server.
  //
  // MANUAL VERIFICATION REQUIRED for the standalone path:
  //   docker compose up -d mongo
  //   MONGO_URI=mongodb://localhost:27017/portfolio_scratch npm run dev
  //   create a vocabulary entry, then delete it
  //   expect 200, transactional: false, and the value stripped from content
  it('DELETE reports transactional matching the server topology', async () => {
    const info    = await mongoose.connection.db.admin().command({ hello: 1 });
    const isRepl  = Boolean(info.setName || info.msg === 'isdbgrid');

    const chip = await Vocabulary.create({ type: 'tech', value: 'ZZTestTxFlag' });
    const proj = await Project.create({ ...VALID_PROJECT, tech: ['React', 'ZZTestTxFlag'] });

    const res = await request(app)
      .delete(`/api/vocabulary/tech/${chip._id}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.transactional).toBe(isRepl);

    // The cascade must succeed either way — a standalone server loses
    // atomicity, not the delete itself.
    const after = await Project.findById(proj._id);
    expect([...after.tech]).toEqual(['React']);
    expect(await Vocabulary.findById(chip._id)).toBeNull();
  });

  it('DELETE reports transactional as a boolean, never undefined', async () => {
    const chip = await Vocabulary.create({ type: 'tag', value: 'ZZTestTxType' });

    const res = await request(app)
      .delete(`/api/vocabulary/tag/${chip._id}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(typeof res.body.data.transactional).toBe('boolean');
  });

});

// ── PF-97: ?inUse=true ────────────────────────────────────────────────────
// The /blog filter-chip row (PF-98) must not render a chip that returns
// nothing. These pin the rule that decides which pool values are public.
describe('GET /api/vocabulary/:type?inUse=true (PF-97)', () => {

  beforeAll(async () => {
    await connectTestDB();
    await Vocabulary.init();
  });
  afterEach(clearDB);
  afterAll(disconnectTestDB);

  const post = (overrides = {}) => ({
    title:     'ZZ Tag Usage Post',
    excerpt:   'A post used to prove the in-use filter works.',
    sections:  [{ heading: 'Only', body: ['Some body text.'], bullets: [] }],
    published: true,
    ...overrides,
  });

  const values = (res) => res.body.data.map((v) => v.value);

  it('includes a tag a published post carries', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZUsed' });
    await Blog.create(post({ tags: ['ZZUsed'] }));

    const res = await request(app).get('/api/vocabulary/tag?inUse=true');

    expect(res.status).toBe(200);
    expect(values(res)).toContain('ZZUsed');
  });

  it('excludes a tag no post carries at all', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZOrphan' });

    const res = await request(app).get('/api/vocabulary/tag?inUse=true');

    expect(values(res)).not.toContain('ZZOrphan');
  });

  // The crux of the decision. A draft is not public, so a tag that only a
  // draft carries must not become a public filter chip — clicking it would
  // return nothing, because the list endpoint only serves published posts.
  it('excludes a tag carried ONLY by a draft', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZDraftOnly' });
    await Blog.create(post({ title: 'ZZ Draft Post', tags: ['ZZDraftOnly'], published: false }));

    const res = await request(app).get('/api/vocabulary/tag?inUse=true');

    expect(values(res)).not.toContain('ZZDraftOnly');
  });

  it('includes it once that draft is published', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZDraftOnly' });
    const draft = await Blog.create(
      post({ title: 'ZZ Draft Post', tags: ['ZZDraftOnly'], published: false }));

    expect(values(await request(app).get('/api/vocabulary/tag?inUse=true')))
      .not.toContain('ZZDraftOnly');

    draft.published = true;
    await draft.save();

    expect(values(await request(app).get('/api/vocabulary/tag?inUse=true')))
      .toContain('ZZDraftOnly');
  });

  // The admin form keeps a free-text tags input beside the picker, so a
  // post can carry a different casing than the pool row.
  it('matches case-insensitively', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZCasing' });
    await Blog.create(post({ tags: ['zzcasing'] }));

    const res = await request(app).get('/api/vocabulary/tag?inUse=true');

    // The POOL's casing is what comes back, not the post's.
    expect(values(res)).toContain('ZZCasing');
  });

  // ⚠️ The regression most likely to bite: the admin picker needs the FULL
  // pool. If this ever starts filtering by default, a newly added tag could
  // never be applied to a first post — it would vanish from the picker the
  // instant it was created.
  it('returns the full pool when the param is absent', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZOrphan' });

    const res = await request(app).get('/api/vocabulary/tag');

    expect(values(res)).toContain('ZZOrphan');
  });

  it('returns the full pool for any value other than the literal "true"', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZOrphan' });

    for (const q of ['false', '1', 'yes', '']) {
      const res = await request(app).get(`/api/vocabulary/tag?inUse=${q}`);
      expect(values(res)).toContain('ZZOrphan');
    }
  });

  // Projects have no published field, so every project counts as visible.
  it('filters tech by project usage, with no published concept', async () => {
    await Vocabulary.create({ type: 'tech', value: 'ZZUsedTech' });
    await Vocabulary.create({ type: 'tech', value: 'ZZOrphanTech' });
    await Project.create({ ...VALID_PROJECT, tech: ['ZZUsedTech'] });

    const res = await request(app).get('/api/vocabulary/tech?inUse=true');

    expect(values(res)).toContain('ZZUsedTech');
    expect(values(res)).not.toContain('ZZOrphanTech');
  });

  it('stays public — the chip row loads without a token', async () => {
    await Vocabulary.create({ type: 'tag', value: 'ZZUsed' });
    await Blog.create(post({ tags: ['ZZUsed'] }));

    const res = await request(app).get('/api/vocabulary/tag?inUse=true');

    expect(res.status).toBe(200);
  });

  it('still rejects an invalid type', async () => {
    const res = await request(app).get('/api/vocabulary/category?inUse=true');
    expect(res.status).toBe(400);
  });
});
