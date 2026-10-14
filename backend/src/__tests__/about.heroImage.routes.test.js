// backend/src/__tests__/about.heroImage.routes.test.js
//
// PUT/DELETE /api/about/hero-image — the hero cut-out (owner, 2026-10-14).
//
// The same handler factory as the portrait (aboutController's
// imageSlotHandlers), so about.avatar.routes.test.js proves the shared steps.
// This file proves the hero SLOT is wired to them: its own field, its own
// folder, delete-on-replace, the request-before-state ordering, and that it
// can never be written through the ordinary profile save. Storage is mocked at
// the service boundary, as in the avatar file.
jest.mock('../services/storage', () => ({
  isConfigured: jest.fn(() => true),
  upload:       jest.fn(),
  destroy:      jest.fn(),
}));

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

// Real magic bytes
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n', 'latin1');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'latin1');

const uploaded = (id) => ({
  url:      `https://res.cloudinary.com/demo/image/upload/v1/portfolio/hero/${id}.png`,
  publicId: `portfolio/hero/${id}`,
  bytes:    PNG.length,
  format:   'png',
  width:    820,
  height:   1028,
});

const put = async (name = 'cutout.png', buf = PNG) =>
  request(app).put('/api/about/hero-image').set(await authHeader()).attach('file', buf, name);

describe('PUT /api/about/hero-image', () => {
  it('rejects an anonymous upload with 401 and never buffers the body', async () => {
    const res = await request(app).put('/api/about/hero-image').attach('file', PNG, 'me.png');
    expect(res.status).toBe(401);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('stores the metadata under heroImage, in the hero folder', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));

    const res = await put('Cutout.png');

    expect(res.status).toBe(200);
    expect(res.body.data.heroImage.publicId).toBe('portfolio/hero/abc');
    expect(res.body.data.heroImage.fileName).toBe('Cutout.png');
    expect(res.body.data.heroImage.width).toBe(820);
    expect(res.body.data.replaced).toBe(false);
    expect(res.body.data).not.toHaveProperty('avatar');
    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      { resourceType: 'image', folder: expect.stringMatching(/\/hero$/) },
    );

    const about = await About.findOne();
    expect(about.heroImage.url).toContain('/portfolio/hero/abc');
    expect(about.avatar.url).toBe('');   // the portrait slot is untouched
  });

  it('uploads the new file BEFORE deleting the old one, as an image', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await put('One.png');

    const order = [];
    storage.upload.mockImplementation(async () => { order.push('upload'); return uploaded('two'); });
    storage.destroy.mockImplementation(async () => { order.push('destroy'); return { result: 'ok' }; });

    const res = await put('Two.png');

    expect(res.status).toBe(200);
    expect(order).toEqual(['upload', 'destroy']);
    expect(res.body.data.replaced).toBe(true);
    expect(res.body.data.oldDeleted).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/hero/one', 'image');
  });

  it('still succeeds when deleting the old file fails', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await put('One.png');
    storage.upload.mockResolvedValue(uploaded('two'));
    storage.destroy.mockRejectedValue(new Error('cloudinary down'));

    const res = await put('Two.png');

    expect(res.status).toBe(200);
    expect(res.body.data.oldDeleted).toBe(false);
    expect((await About.findOne()).heroImage.publicId).toBe('portfolio/hero/two');
  });

  it.each([['an SVG', SVG, 'x.svg'], ['a PDF', PDF, 'x.pdf']])(
    'rejects %s with 415 and names the hero image',
    async (_label, buf, name) => {
      const res = await put(name, buf);
      expect(res.status).toBe(415);
      expect(storage.upload).not.toHaveBeenCalled();
    },
  );

  it('names the hero image in its byte-check refusal', async () => {
    // Claimed as a PNG so multer's claimed-type screen lets it through and the
    // HANDLER's magic-byte check is what answers.
    const res = await request(app)
      .put('/api/about/hero-image')
      .set(await authHeader())
      .attach('file', PDF, { filename: 'fake.png', contentType: 'image/png' });
    expect(res.status).toBe(415);
    expect(res.body.message).toMatch(/^Hero image must be a PNG, JPEG, WEBP image\.$/);
  });

  it('rejects an oversized image with 413', async () => {
    const res = await put('huge.png', Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]));
    expect(res.status).toBe(413);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('returns 503 when storage is not configured — after judging the request', async () => {
    storage.isConfigured.mockReturnValue(false);
    expect((await put('ok.png')).status).toBe(503);
    expect((await put('CV.pdf', PDF)).status).toBe(415);
  });
});

describe('DELETE /api/about/hero-image', () => {
  it('clears the slot and destroys the file', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await put('One.png');
    storage.destroy.mockResolvedValue({ result: 'ok' });

    const res = await request(app).delete('/api/about/hero-image').set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ removed: true, deleted: true });
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/hero/one', 'image');
    const about = await About.findOne();
    expect(about.heroImage.url).toBe('');
    expect(about.heroImage.publicId).toBe('');
  });

  it('404s when there is no hero image', async () => {
    await About.create({});
    const res = await request(app).delete('/api/about/hero-image').set(await authHeader());
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('No hero image to remove');
    expect(storage.destroy).not.toHaveBeenCalled();
  });

  it('rejects an anonymous delete with 401', async () => {
    expect((await request(app).delete('/api/about/hero-image')).status).toBe(401);
  });

  it('leaves the portrait alone', async () => {
    const about = await About.create({});
    about.avatar    = { url: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/profile/p.webp', publicId: 'portfolio/profile/p' };
    about.heroImage = { url: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/hero/h.webp', publicId: 'portfolio/hero/h' };
    await about.save();
    storage.destroy.mockResolvedValue({ result: 'ok' });

    await request(app).delete('/api/about/hero-image').set(await authHeader());

    expect(storage.destroy).toHaveBeenCalledTimes(1);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/hero/h', 'image');
    expect((await About.findOne()).avatar.publicId).toBe('portfolio/profile/p');
  });
});

describe('PUT /api/about — heroImage is not client-writable', () => {
  const seeded = async () => {
    const about = await About.create({});
    about.heroImage = { url: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/hero/one.webp', publicId: 'portfolio/hero/one' };
    await about.save();
  };

  it('ignores a heroImage object on the profile save', async () => {
    await seeded();
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ name: 'New Name', heroImage: { url: '', publicId: '' } });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
    expect((await About.findOne()).heroImage.publicId).toBe('portfolio/hero/one');
  });

  // PF-120's rule for the new slot: `$set` reads a dotted key as the nested path.
  it.each([['heroImage.publicId', 'publicId'], ['heroImage.url', 'url']])(
    'ignores a DOTTED %s',
    async (key, field) => {
      await seeded();
      const before = (await About.findOne()).heroImage[field];
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ title: 'Engineer', [key]: 'https://res.cloudinary.com/demo/raw/upload/victim' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Engineer');
      expect((await About.findOne()).heroImage[field]).toBe(before);
    },
  );
});

describe('About.heroImage — the model', () => {
  it('a document saved before the field existed reads empty defaults', async () => {
    await About.collection.insertOne({ name: 'Old doc' });   // raw: no heroImage on disk
    const about = await About.findOne();
    expect(about.heroImage.url).toBe('');
    expect(about.heroImage.publicId).toBe('');
    expect(about.heroImage.uploadedAt).toBeNull();
  });

  it('refuses a data: URI', async () => {
    const about = new About({ heroImage: { url: 'data:image/png;base64,AAAA' } });
    await expect(about.validate()).rejects.toThrow(/Hero image URL must be an http\(s\) URL/);
  });
});
