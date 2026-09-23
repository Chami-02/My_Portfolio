// backend/src/__tests__/project.background.routes.test.js
//
// PF-111 — PUT/DELETE /api/projects/:id/background, plus the two write holes
// that made an ordinary save able to orphan a file.
jest.mock('../services/storage', () => ({
  isConfigured: jest.fn(() => true),
  upload:       jest.fn(),
  destroy:      jest.fn(),
}));

const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app     = require('../app');
const Project = require('../models/Project');
const User    = require('../models/User');
const storage = require('../services/storage');
const { sanitiseProjectBody } = require('../controllers/projectController');
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

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'latin1');

const uploaded = (id) => ({
  url:      `https://res.cloudinary.com/demo/image/upload/v1/portfolio/projects/${id}.png`,
  publicId: `portfolio/projects/${id}`,
  bytes:    PNG.length,
  format:   'png',
  width:    1600,
  height:   900,
});

const makeProject = (over = {}) => Project.create({
  title: 'ClearDrive', description: 'd', githubUrl: 'https://github.com/x/y',
  tech: ['React'], ...over,
});

describe('PUT /api/projects/:id/background', () => {

  it('rejects an anonymous upload with 401 and never buffers the body', async () => {
    const p = await makeProject();
    const res = await request(app)
      .put(`/api/projects/${p._id}/background`)
      .attach('file', PNG, 'bg.png');

    expect(res.status).toBe(401);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('stores src and publicId together', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('abc'));

    const res = await request(app)
      .put(`/api/projects/${p._id}/background`)
      .set(await authHeader())
      .attach('file', PNG, 'bg.png');

    expect(res.status).toBe(200);
    expect(res.body.data.replaced).toBe(false);

    const after = await Project.findById(p._id);
    expect(after.backgroundImage.src).toContain('res.cloudinary.com');
    expect(after.backgroundImage.publicId).toBe('portfolio/projects/abc');
    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      { resourceType: 'image', folder: expect.stringContaining('/projects') }
    );
  });

  it('leaves opacity alone when the image is replaced', async () => {
    const p = await makeProject({ backgroundImage: { src: '', publicId: '', opacity: 0.35 } });
    storage.upload.mockResolvedValue(uploaded('abc'));

    await request(app)
      .put(`/api/projects/${p._id}/background`)
      .set(await authHeader())
      .attach('file', PNG, 'bg.png');

    const after = await Project.findById(p._id);
    expect(after.backgroundImage.opacity).toBe(0.35);   // a tuned value survives
  });

  it('uploads the new file BEFORE deleting the old one', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    const order = [];
    storage.upload.mockImplementation(async () => { order.push('upload'); return uploaded('two'); });
    storage.destroy.mockImplementation(async () => { order.push('destroy'); return { result: 'ok' }; });

    const res = await request(app)
      .put(`/api/projects/${p._id}/background`)
      .set(await authHeader())
      .attach('file', PNG, 'two.png');

    expect(res.status).toBe(200);
    expect(order).toEqual(['upload', 'destroy']);
    expect(res.body.data.replaced).toBe(true);
    expect(res.body.data.oldDeleted).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/projects/one', 'image');
  });

  it('still succeeds when deleting the old file fails', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    storage.upload.mockResolvedValue(uploaded('two'));
    storage.destroy.mockRejectedValue(new Error('cloudinary down'));

    const res = await request(app)
      .put(`/api/projects/${p._id}/background`)
      .set(await authHeader())
      .attach('file', PNG, 'two.png');

    expect(res.status).toBe(200);
    expect(res.body.data.oldDeleted).toBe(false);
  });

  it('rejects an SVG disguised as a PNG with 415', async () => {
    const p = await makeProject();
    const res = await request(app)
      .put(`/api/projects/${p._id}/background`)
      .set(await authHeader())
      .attach('file', SVG, { filename: 'bg.png', contentType: 'image/png' });

    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('returns 503 when storage is not configured', async () => {
    const p = await makeProject();
    storage.isConfigured.mockReturnValue(false);

    const res = await request(app)
      .put(`/api/projects/${p._id}/background`)
      .set(await authHeader())
      .attach('file', PNG, 'bg.png');

    expect(res.status).toBe(503);
  });

  it('404s for an unknown project and 400s for a malformed id', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));

    const missing = await request(app)
      .put('/api/projects/64b7f0f0f0f0f0f0f0f0f0f0/background')
      .set(await authHeader())
      .attach('file', PNG, 'bg.png');
    expect(missing.status).toBe(404);

    const bad = await request(app)
      .put('/api/projects/not-an-id/background')
      .set(await authHeader())
      .attach('file', PNG, 'bg.png');
    expect(bad.status).toBe(400);

    // the lookup happens before the upload, so neither wasted a round trip
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/projects/:id/background', () => {

  it('clears src and publicId, destroys the file, keeps the project', async () => {
    const p = await makeProject({ backgroundImage: { src: '', publicId: '', opacity: 0.4 } });
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    storage.destroy.mockResolvedValue({ result: 'ok' });

    const res = await request(app)
      .delete(`/api/projects/${p._id}/background`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/projects/one', 'image');

    const after = await Project.findById(p._id);
    expect(after).not.toBeNull();                       // the project survives
    expect(after.backgroundImage.src).toBe('');
    expect(after.backgroundImage.publicId).toBe('');
    expect(after.backgroundImage.opacity).toBe(0.4);    // and so does its opacity
  });

  it('404s when there is no background', async () => {
    const p = await makeProject();
    const res = await request(app)
      .delete(`/api/projects/${p._id}/background`)
      .set(await authHeader());

    expect(res.status).toBe(404);
    expect(storage.destroy).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/projects/:id — the image goes with the project (PF-111)', () => {

  it('destroys the background file after deleting the row', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    storage.destroy.mockResolvedValue({ result: 'ok' });

    const res = await request(app)
      .delete(`/api/projects/${p._id}`)
      .set(await authHeader());

    expect(res.status).toBe(204);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/projects/one', 'image');
    expect(await Project.findById(p._id)).toBeNull();
  });

  it('deletes the project even when Cloudinary is down', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    storage.destroy.mockRejectedValue(new Error('cloudinary down'));

    const res = await request(app)
      .delete(`/api/projects/${p._id}`)
      .set(await authHeader());

    // ⚠️ The row goes FIRST, deliberately. An outage must not be able to block
    // a delete; a logged orphan is the recoverable direction, a project the
    // admin cannot remove is not.
    expect(res.status).toBe(204);
    expect(await Project.findById(p._id)).toBeNull();
  });

  it('does not call destroy for a project that has no background', async () => {
    const p = await makeProject();
    const res = await request(app)
      .delete(`/api/projects/${p._id}`)
      .set(await authHeader());

    expect(res.status).toBe(204);
    expect(storage.destroy).not.toHaveBeenCalled();
  });
});

describe('sanitiseProjectBody — the strip is a security boundary (PF-111)', () => {

  it('drops a client-supplied src and publicId', () => {
    const out = sanitiseProjectBody({
      title: 'x',
      backgroundImage: { src: 'https://evil/a.png', publicId: 'portfolio/profile/victim' },
    });

    // ⚠️ Without this, a save could name ANY publicId — and the delete-on-
    // replace path would then destroy whatever file the client pointed at.
    expect(out).toEqual({ title: 'x' });
  });

  it('keeps opacity, flattened onto a dot path', () => {
    const out = sanitiseProjectBody({ backgroundImage: { opacity: 0.5 } });
    expect(out).toEqual({ 'backgroundImage.opacity': 0.5 });
  });

  it('tolerates a missing or non-object backgroundImage', () => {
    expect(sanitiseProjectBody({ title: 'x' })).toEqual({ title: 'x' });
    expect(sanitiseProjectBody({ backgroundImage: 'nope' })).toEqual({});
    expect(sanitiseProjectBody({ backgroundImage: ['a'] })).toEqual({});
    expect(sanitiseProjectBody(undefined)).toEqual({});
  });
});

describe('PUT /api/projects/:id — an ordinary save cannot touch the media (PF-111)', () => {

  it('saving opacity alone does NOT wipe src and publicId', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    const res = await request(app)
      .put(`/api/projects/${p._id}`)
      .set(await authHeader())
      .send({ backgroundImage: { opacity: 0.5 } });

    expect(res.status).toBe(200);

    // ⚠️ THE TRAP THIS PINS: Mongoose turns a nested OBJECT in an update into
    // $set of the WHOLE sub-document, so the un-flattened version of this call
    // replaces backgroundImage entirely — the image vanishes from the card and
    // its file is orphaned, from an ordinary save. PF-113's slider would have
    // hit this on its first save.
    const after = await Project.findById(p._id);
    expect(after.backgroundImage.opacity).toBe(0.5);
    expect(after.backgroundImage.publicId).toBe('portfolio/projects/one');
    expect(after.backgroundImage.src).toContain('res.cloudinary.com');
  });

  it('ignores a client-supplied src on a normal save', async () => {
    const p = await makeProject();
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put(`/api/projects/${p._id}/background`)
      .set(await authHeader()).attach('file', PNG, 'one.png');

    await request(app)
      .put(`/api/projects/${p._id}`)
      .set(await authHeader())
      .send({ title: 'Renamed', backgroundImage: { src: 'https://evil/a.png', publicId: 'x' } });

    const after = await Project.findById(p._id);
    expect(after.title).toBe('Renamed');
    expect(after.backgroundImage.publicId).toBe('portfolio/projects/one');
    expect(after.backgroundImage.src).toContain('res.cloudinary.com');
  });

  it('ignores a client-supplied publicId on CREATE', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(await authHeader())
      .send({
        title: 'New', description: 'd', githubUrl: 'https://github.com/a/b', tech: ['React'],
        backgroundImage: { src: 'https://evil/a.png', publicId: 'portfolio/profile/victim', opacity: 0.6 },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.backgroundImage.src).toBe('');
    expect(res.body.data.backgroundImage.publicId).toBe('');
    expect(res.body.data.backgroundImage.opacity).toBe(0.6);   // opacity is content
  });
});
