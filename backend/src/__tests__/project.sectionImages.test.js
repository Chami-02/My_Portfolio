// PF-144 part 2 — pictures inside a project's sections.
//
// The security rule under test: a section may show a picture ONLY by naming
// a publicId in the project's own `media` ledger, which only the upload route
// writes. So a client can never point the site — or a clean-up delete — at a
// file this project did not upload. Every "refused" test is paired with what
// the database and storage look like afterwards.
jest.mock('../services/storage', () => ({
  isConfigured: jest.fn(() => true),
  upload:       jest.fn(),
  destroy:      jest.fn(),
}));

const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app      = require('../app');
const Project  = require('../models/Project');
const Blog     = require('../models/Blog');
const User     = require('../models/User');
const storage  = require('../services/storage');
const validationError = require('./helpers/validationError');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
});
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };
const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'latin1');

const uploaded = (id) => ({
  url: `https://res.cloudinary.com/demo/image/upload/v1/portfolio/projects/${id}.png`,
  publicId: `portfolio/projects/${id}`, bytes: PNG.length, format: 'png', width: 1920, height: 1080,
});

const makeProject = (over = {}) => Project.create({
  title: 'ClearDrive', description: 'd', githubUrl: 'https://github.com/x/y', tech: ['React'],
  sections: [{ heading: 'Features', body: ['Text.'] }], ...over,
});

const upload = async (id, file = PNG, headers) =>
  request(app).post(`/api/projects/${id}/images`).set(headers ?? await authHeader()).attach('file', file, 'shot.png');

const putSections = async (id, sections, headers) =>
  request(app).put(`/api/projects/${id}`).set(headers ?? await authHeader()).send({ sections });

// ── the upload route ────────────────────────────────────────────────────────
describe('POST /api/projects/:id/images', () => {
  it('a stranger gets 401 and nothing is uploaded (auth runs before the file is read)', async () => {
    const p = await makeProject();
    const res = await request(app).post(`/api/projects/${p._id}/images`).attach('file', PNG, 'shot.png');
    expect(res.status).toBe(401);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('checks the file by its bytes, not its name: an SVG called .png is a 415', async () => {
    const p = await makeProject();
    const res = await upload(p._id, SVG);
    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('adds the upload to the ledger ONLY — the page shows nothing until a save uses it', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('a'));

    const res = await upload(p._id);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ publicId: 'portfolio/projects/a', width: 1920, height: 1080 });

    const stored = await Project.findById(p._id).lean();
    expect(stored.media.map((m) => m.publicId)).toEqual(['portfolio/projects/a']);
    expect(stored.sections[0].images).toEqual([]);
  });

  it('a missing project is a 404 and uploads nothing', async () => {
    const res = await upload('64b7f0c2a1b2c3d4e5f60718');
    expect(res.status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('a full ledger is refused BEFORE uploading (409)', async () => {
    const media = Array.from({ length: 60 }, (_, i) => ({ publicId: `portfolio/projects/m${i}`, url: uploaded(`m${i}`).url }));
    const p = await makeProject({ media });
    const res = await upload(p._id);
    expect(res.status).toBe(409);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

// ── saving sections that show pictures ──────────────────────────────────────
describe('saving a section with pictures', () => {
  it('url, width and height come from the LEDGER — whatever the client sends is overwritten', async () => {
    const p = await makeProject({ media: [{ publicId: 'portfolio/projects/a', url: uploaded('a').url, width: 1920, height: 1080 }] });
    const res = await putSections(p._id, [{
      heading: 'Features', body: [],
      images: [{ publicId: 'portfolio/projects/a', caption: 'Dashboard', url: 'https://evil.example/x.png', width: 1 }],
    }]);
    expect(res.status).toBe(200);
    expect(res.body.data.sections[0].images).toEqual([{
      publicId: 'portfolio/projects/a', caption: 'Dashboard', url: uploaded('a').url, width: 1920, height: 1080,
    }]);
  });

  // The guard this whole design rests on.
  it('a publicId this project never uploaded is REFUSED (400) and nothing changes', async () => {
    const other = await makeProject({ title: 'Other', media: [{ publicId: 'portfolio/projects/theirs', url: uploaded('theirs').url }] });
    const p = await makeProject();
    const res = await putSections(p._id, [{ heading: 'Features', images: [{ publicId: 'portfolio/projects/theirs' }] }]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/couldn't be found\. Please upload it again/);
    expect((await Project.findById(p._id).lean()).sections[0].images).toEqual([]);
    expect(storage.destroy).not.toHaveBeenCalled();
    expect((await Project.findById(other._id).lean()).media).toHaveLength(1);
  });

  it('a NEW project cannot name a picture at all — it has no ledger yet', async () => {
    const res = await request(app).post('/api/projects').set(await authHeader()).send({
      title: 'New', published: false, sections: [{ heading: 'H', images: [{ publicId: 'portfolio/projects/a' }] }],
    });
    expect(res.status).toBe(400);
    expect(await Project.countDocuments()).toBe(0);
  });

  // ⚠️ Mutation-tested: an earlier version asserted only "the ledger is empty
  // afterwards", and passed with the strip REMOVED — the save's own clean-up
  // had swept the forged entry away, by DESTROYING the file it named. So a
  // forged ledger entry is not just ignored-looking; it is a delete aimed by
  // the client. Both halves are pinned: it cannot be used, and nothing is
  // destroyed.
  it('the client cannot write the ledger — a forged entry can neither be shown nor make the server delete a file', async () => {
    const p = await makeProject();
    const forged = { publicId: 'portfolio/someone-elses-file', url: 'https://res.cloudinary.com/demo/x.png' };

    const useIt = await request(app).put(`/api/projects/${p._id}`).set(await authHeader())
      .send({ media: [forged], sections: [{ heading: 'H', images: [{ publicId: forged.publicId }] }] });
    expect(useIt.status).toBe(400);

    await request(app).put(`/api/projects/${p._id}`).set(await authHeader())
      .send({ media: [forged], 'media.0.publicId': 'portfolio/other', title: 'Renamed' });
    expect(storage.destroy).not.toHaveBeenCalled();
    expect((await Project.findById(p._id).lean()).media).toEqual([]);
  });

  // The DOTTED form (PF-120's lesson): renaming an existing ledger entry would
  // aim the clean-up's delete at any file the client names.
  it('a dotted path cannot rename a ledger entry and aim the clean-up at another file', async () => {
    storage.destroy.mockResolvedValue({ result: 'ok' });
    const p = await makeProject({ media: [{ publicId: 'portfolio/projects/mine', url: uploaded('mine').url }] });
    await request(app).put(`/api/projects/${p._id}`).set(await authHeader())
      .send({ 'media.0.publicId': 'portfolio/victim', title: 'Renamed' });
    expect(storage.destroy.mock.calls.map((c) => c[0])).toEqual(['portfolio/projects/mine']);
  });

  it('at most 4 pictures in one section', async () => {
    const media = Array.from({ length: 5 }, (_, i) => ({ publicId: `portfolio/projects/m${i}`, url: uploaded(`m${i}`).url }));
    const p = await makeProject({ media });
    const res = await putSections(p._id, [{ heading: 'H', images: media.map(({ publicId }) => ({ publicId })) }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 4 pictures/);
  });

  it('a published section may be a heading and pictures only', async () => {
    const p = await makeProject({ media: [{ publicId: 'portfolio/projects/a', url: uploaded('a').url }] });
    const res = await putSections(p._id, [{ heading: 'Screens', images: [{ publicId: 'portfolio/projects/a' }] }]);
    expect(res.status).toBe(200);
  });

  it('a caption over 120 characters is refused', async () => {
    const p = await makeProject({ media: [{ publicId: 'portfolio/projects/a', url: uploaded('a').url }] });
    const res = await putSections(p._id, [{ heading: 'H', images: [{ publicId: 'portfolio/projects/a', caption: 'x'.repeat(121) }] }]);
    expect(res.status).toBe(400);
  });
});

it('the PUBLIC reads never include the ledger (internal bookkeeping)', async () => {
  const p = await makeProject({ media: [{ publicId: 'portfolio/projects/a', url: uploaded('a').url }] });
  const one = await request(app).get(`/api/projects/${p.slug}`);
  const list = await request(app).get('/api/projects');
  expect(one.body.data.project).not.toHaveProperty('media');
  expect(list.body.data[0]).not.toHaveProperty('media');
});

// ── clean-up: files never outlive their use ─────────────────────────────────
describe('clean-up', () => {
  it('a picture REMOVED in a save is destroyed and leaves the ledger; the kept one stays', async () => {
    storage.destroy.mockResolvedValue({ result: 'ok' });
    const media = ['a', 'b'].map((id) => ({ publicId: `portfolio/projects/${id}`, url: uploaded(id).url }));
    const p = await makeProject({ media, sections: [{ heading: 'H', images: media.map((m) => ({ ...m })) }] });

    const res = await putSections(p._id, [{ heading: 'H', images: [{ publicId: 'portfolio/projects/a' }] }]);
    expect(res.status).toBe(200);
    expect(storage.destroy).toHaveBeenCalledTimes(1);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/projects/b', 'image');
    expect((await Project.findById(p._id).lean()).media.map((m) => m.publicId)).toEqual(['portfolio/projects/a']);
  });

  it('a picture uploaded but never saved is destroyed by the next save', async () => {
    storage.destroy.mockResolvedValue({ result: 'ok' });
    const p = await makeProject({ media: [{ publicId: 'portfolio/projects/orphan', url: uploaded('orphan').url }] });
    await request(app).put(`/api/projects/${p._id}`).set(await authHeader()).send({ title: 'Renamed' });
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/projects/orphan', 'image');
  });

  it('a failed destroy does not fail the save (logged, the record is already right)', async () => {
    storage.destroy.mockRejectedValue(new Error('cloud down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const p = await makeProject({ media: [{ publicId: 'portfolio/projects/orphan', url: uploaded('orphan').url }] });
    const res = await request(app).put(`/api/projects/${p._id}`).set(await authHeader()).send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('deleting the project destroys the cover AND every section picture', async () => {
    storage.destroy.mockResolvedValue({ result: 'ok' });
    const p = await makeProject({
      backgroundImage: { src: uploaded('cover').url, publicId: 'portfolio/projects/cover' },
      media: ['a', 'b'].map((id) => ({ publicId: `portfolio/projects/${id}`, url: uploaded(id).url })),
    });
    const res = await request(app).delete(`/api/projects/${p._id}`).set(await authHeader());
    expect(res.status).toBe(204);
    expect(storage.destroy.mock.calls.map((c) => c[0]).sort())
      .toEqual(['portfolio/projects/a', 'portfolio/projects/b', 'portfolio/projects/cover']);
  });
});

// ── Blog is untouched ───────────────────────────────────────────────────────
describe('Blog sections', () => {
  it('have no pictures: an `images` key sent for a post is dropped', async () => {
    const post = new Blog({ title: 'T', excerpt: 'e', published: false, slug: 't',
      sections: [{ heading: 'H', body: ['b'], images: [{ publicId: 'x', url: 'y' }] }] });
    expect(await validationError(post)).toBeUndefined();
    expect(post.toObject().sections[0].images).toBeUndefined();
  });
});
