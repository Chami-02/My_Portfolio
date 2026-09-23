// backend/src/__tests__/about.avatar.routes.test.js
//
// PF-111 — PUT/DELETE /api/about/avatar.
//
// Cloudinary is mocked at the storage-service boundary so these run with no
// credentials and no network, the same way resume.routes.test.js does. What
// they verify is the wiring and the ORDER of operations — the parts that stay
// the same whatever the provider is.
jest.mock('../services/storage', () => {
  const actual = jest.requireActual('../services/storage');

  return {
    attachmentUrl: actual.attachmentUrl,   // pure string work — keep the real one
    isConfigured:  jest.fn(() => true),
    upload:        jest.fn(),
    destroy:       jest.fn(),
  };
});

const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app     = require('../app');
const About   = require('../models/About');
const User    = require('../models/User');
const storage = require('../services/storage');
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

// ── Fixtures, by their real magic bytes ──────────────────────────────────────
const PNG  = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1'),
]);
const PDF  = Buffer.from('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n', 'latin1');
const SVG  = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'latin1');
const AVIF = Buffer.concat([
  Buffer.alloc(4), Buffer.from('ftypavif', 'latin1'), Buffer.alloc(8),
]);

const uploaded = (id) => ({
  url:      `https://res.cloudinary.com/demo/image/upload/v1/portfolio/profile/${id}.png`,
  publicId: `portfolio/profile/${id}`,
  bytes:    PNG.length,
  format:   'png',
  width:    1200,
  height:   1600,
});

describe('PUT /api/about/avatar', () => {

  it('rejects an anonymous upload with 401 and never buffers the body', async () => {
    const res = await request(app)
      .put('/api/about/avatar')
      .attach('file', PNG, 'me.png');

    expect(res.status).toBe(401);
    // protect must run BEFORE multer — see the comment in aboutRoutes.js
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('stores the full metadata and reports the first upload as not a replacement', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));

    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PNG, 'Parindra.png');

    expect(res.status).toBe(200);
    expect(res.body.data.hasAvatar).toBe(true);
    expect(res.body.data.replaced).toBe(false);
    expect(res.body.data.avatar.publicId).toBe('portfolio/profile/abc');
    expect(res.body.data.avatar.fileName).toBe('Parindra.png');
    expect(res.body.data.avatar.format).toBe('png');
    expect(res.body.data.avatar.width).toBe(1200);
    expect(res.body.data.avatar.height).toBe(1600);
    expect(storage.destroy).not.toHaveBeenCalled();

    // uploaded to the profile folder, as an image (not 'raw' like the résumé)
    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      { resourceType: 'image', folder: expect.stringContaining('/profile') }
    );
  });

  it('uploads the new file BEFORE deleting the old one', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/avatar')
      .set(await authHeader()).attach('file', PNG, 'One.png');

    const order = [];
    storage.upload.mockImplementation(async () => { order.push('upload'); return uploaded('two'); });
    storage.destroy.mockImplementation(async () => { order.push('destroy'); return { result: 'ok' }; });

    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PNG, 'Two.png');

    expect(res.status).toBe(200);
    expect(order).toEqual(['upload', 'destroy']);
    expect(res.body.data.replaced).toBe(true);
    expect(res.body.data.oldDeleted).toBe(true);

    // ⚠️ 'image', NOT 'raw'. A wrong resourceType makes Cloudinary answer
    // { result: 'not found' } — an HTTP success that deletes nothing.
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/profile/one', 'image');
  });

  it('still succeeds when deleting the old file fails, reporting the orphan', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/avatar')
      .set(await authHeader()).attach('file', PNG, 'One.png');

    storage.upload.mockResolvedValue(uploaded('two'));
    storage.destroy.mockResolvedValue({ result: 'not found' });

    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PNG, 'Two.png');

    expect(res.status).toBe(200);
    expect(res.body.data.oldDeleted).toBe(false);
    // the NEW portrait is live either way — a failed cleanup is not the
    // visitor's problem and must not fail their request
    const about = await About.findOne();
    expect(about.avatar.publicId).toBe('portfolio/profile/two');
  });

  it('still succeeds when the delete THROWS', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/avatar')
      .set(await authHeader()).attach('file', PNG, 'One.png');

    storage.upload.mockResolvedValue(uploaded('two'));
    storage.destroy.mockRejectedValue(new Error('cloudinary down'));

    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PNG, 'Two.png');

    expect(res.status).toBe(200);
    expect(res.body.data.oldDeleted).toBe(false);
  });

  it('accepts JPEG and WebP as well as PNG', async () => {
    for (const [buf, name] of [[JPEG, 'a.jpg'], [WEBP, 'b.webp']]) {
      storage.upload.mockResolvedValue(uploaded('x'));
      const res = await request(app)
        .put('/api/about/avatar')
        .set(await authHeader())
        .attach('file', buf, name);
      expect(res.status).toBe(200);
    }
  });

  // ── The magic-byte gate ────────────────────────────────────────────────────
  // Each of these attaches a filename and Content-Type multer WOULD accept, so
  // the rejection can only be coming from the handler reading the real bytes.
  // Attaching them honestly would be rejected a layer earlier and would prove
  // nothing about the gate under test.

  it('rejects an SVG disguised as a PNG with 415', async () => {
    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', SVG, { filename: 'logo.png', contentType: 'image/png' });

    expect(res.status).toBe(415);
    expect(res.body.message).toMatch(/PNG, JPEG, WEBP/i);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a PDF with 415 — the résumé route is the one that takes those', async () => {
    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PDF, 'CV.pdf');

    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects AVIF, which POST /api/upload accepts but a portrait does not', async () => {
    // Pins the deliberate narrowing: middleware/upload.js's ALLOWED_IMAGE_MIME
    // lists image/avif, utils/fileType.js's MEDIA_IMAGE_MIME does not, and the
    // handler's list is the one that decides.
    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', AVIF, { filename: 'shot.avif', contentType: 'image/avif' });

    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects an oversized image with 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);   // > 2 MB
    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', big, 'huge.png');

    expect(res.status).toBe(413);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a missing file with 400', async () => {
    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader());

    expect(res.status).toBe(400);
  });

  it('returns 503 when storage is not configured — AFTER judging the request', async () => {
    storage.isConfigured.mockReturnValue(false);

    const res = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PNG, 'me.png');

    expect(res.status).toBe(503);

    // and a bad file still gets the 415 it deserves, because the operator can
    // act on that and can do nothing about a 503
    const bad = await request(app)
      .put('/api/about/avatar')
      .set(await authHeader())
      .attach('file', PDF, 'CV.pdf');

    expect(bad.status).toBe(415);
  });
});

describe('DELETE /api/about/avatar', () => {

  it('clears the slot and destroys the file', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/avatar')
      .set(await authHeader()).attach('file', PNG, 'One.png');

    storage.destroy.mockResolvedValue({ result: 'ok' });

    const res = await request(app)
      .delete('/api/about/avatar')
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ removed: true, deleted: true, hasAvatar: false });
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/profile/one', 'image');

    const about = await About.findOne();
    expect(about.avatar.url).toBe('');
    expect(about.avatar.publicId).toBe('');
    expect(about.hasAvatar).toBe(false);
  });

  it('404s when there is no portrait', async () => {
    await About.create({});
    const res = await request(app)
      .delete('/api/about/avatar')
      .set(await authHeader());

    expect(res.status).toBe(404);
    expect(storage.destroy).not.toHaveBeenCalled();
  });

  it('rejects an anonymous delete with 401', async () => {
    const res = await request(app).delete('/api/about/avatar');
    expect(res.status).toBe(401);
  });

  it('clears the slot even when the file delete fails', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/avatar')
      .set(await authHeader()).attach('file', PNG, 'One.png');

    storage.destroy.mockRejectedValue(new Error('cloudinary down'));

    const res = await request(app)
      .delete('/api/about/avatar')
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(false);

    // The slot is cleared FIRST, deliberately: the site must stop pointing at
    // a file that is about to disappear, even if the disappearing fails.
    const about = await About.findOne();
    expect(about.avatar.url).toBe('');
  });
});

describe('PUT /api/about — media fields are not client-writable (PF-111)', () => {

  it('ignores an avatar sent through the ordinary profile save', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/avatar')
      .set(await authHeader()).attach('file', PNG, 'One.png');

    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ name: 'New Name', avatar: { url: '', publicId: '' } });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');   // the honest half still saves

    // ⚠️ Without the strip this wipes the publicId, and the real file becomes
    // unreachable and undeletable — the exact orphan PF-111 exists to prevent,
    // reachable from the ordinary save button.
    const about = await About.findOne();
    expect(about.avatar.publicId).toBe('portfolio/profile/one');
    expect(about.avatar.url).toContain('res.cloudinary.com');
  });

  it('ignores a resume sent through the ordinary profile save', async () => {
    const about = await About.create({});
    about.resume = {
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/portfolio/documents/cv.pdf',
      publicId: 'portfolio/documents/cv',
      fileName: 'CV.pdf', ext: 'PDF', bytes: 1234, uploadedAt: new Date(),
    };
    await about.save();

    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ title: 'Engineer', resume: { url: '', publicId: '' } });

    expect(res.status).toBe(200);

    const after = await About.findOne();
    expect(after.resume.publicId).toBe('portfolio/documents/cv');
    expect(after.hasResume).toBe(true);
  });
});
