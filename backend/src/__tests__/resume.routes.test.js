// Cloudinary is mocked at the storage-service boundary so these run with no
// credentials and no network. What they verify is the wiring and the ORDER of
// operations — the parts that stay the same whatever the provider is.
jest.mock('../services/storage', () => {
  const actual = jest.requireActual('../services/storage');

  return {
    // attachmentUrl is pure string work — keep the real one
    attachmentUrl: actual.attachmentUrl,
    isConfigured:  jest.fn(() => true),
    upload:        jest.fn(),
    destroy:       jest.fn(),
  };
});

const request = require('supertest');
const jwt     = require('jsonwebtoken');
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
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
};

const PDF  = Buffer.from('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n', 'latin1');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

const uploaded = (id) => ({
  url:      `https://res.cloudinary.com/demo/raw/upload/v1/portfolio/documents/${id}.pdf`,
  publicId: `portfolio/documents/${id}`,
  bytes:    PDF.length,
  format:   'pdf',
});

describe('PUT /api/about/resume', () => {

  it('rejects an anonymous upload with 401', async () => {
    const res = await request(app)
      .put('/api/about/resume')
      .attach('file', PDF, 'CV.pdf');

    expect(res.status).toBe(401);
    // protect must run BEFORE multer — the body is never buffered
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('stores metadata and reports the first upload as not a replacement', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));

    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', PDF, 'Parindra_CV.pdf');

    expect(res.status).toBe(200);
    expect(res.body.data.hasResume).toBe(true);
    expect(res.body.data.replaced).toBe(false);
    expect(res.body.data.resume.fileName).toBe('Parindra_CV.pdf');
    expect(res.body.data.resume.publicId).toBe('portfolio/documents/abc');
    expect(res.body.data.resume.ext).toBe('PDF');
    expect(res.body.data.downloadUrl).toContain('fl_attachment:Parindra_CV/');
    expect(storage.destroy).not.toHaveBeenCalled();
  });

  it('uploads the new file BEFORE deleting the old one', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/resume')
      .set(await authHeader()).attach('file', PDF, 'One.pdf');

    const order = [];
    storage.upload.mockImplementation(async () => { order.push('upload'); return uploaded('two'); });
    storage.destroy.mockImplementation(async () => { order.push('destroy'); return { result: 'ok' }; });

    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', PDF, 'Two.pdf');

    expect(res.status).toBe(200);
    expect(order).toEqual(['upload', 'destroy']);
    expect(res.body.data.replaced).toBe(true);
    expect(res.body.data.oldDeleted).toBe(true);
    // 'raw', not 'image' — otherwise Cloudinary silently fails to delete
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/documents/one', 'raw');
  });

  it('still succeeds when deleting the old file fails, reporting the orphan', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/resume')
      .set(await authHeader()).attach('file', PDF, 'One.pdf');

    storage.upload.mockResolvedValue(uploaded('two'));
    storage.destroy.mockRejectedValue(new Error('Cloudinary down'));

    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', PDF, 'Two.pdf');

    // A dead Download CV button would be worse than one wasted file
    expect(res.status).toBe(200);
    expect(res.body.data.oldDeleted).toBe(false);
    expect(res.body.data.resume.publicId).toBe('portfolio/documents/two');
  });

  it('reports oldDeleted:false when Cloudinary silently declines the delete', async () => {
    storage.upload.mockResolvedValue(uploaded('one'));
    await request(app).put('/api/about/resume')
      .set(await authHeader()).attach('file', PDF, 'One.pdf');

    storage.upload.mockResolvedValue(uploaded('two'));
    // The dangerous case: destroy RESOLVES rather than throwing. This is what
    // Cloudinary returns for a raw file deleted with the wrong resource_type —
    // no error, no deletion, an orphan accumulating unnoticed.
    storage.destroy.mockResolvedValue({ result: 'not found' });

    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', PDF, 'Two.pdf');

    expect(res.status).toBe(200);
    expect(res.body.data.replaced).toBe(true);
    expect(res.body.data.oldDeleted).toBe(false);   // must not claim success
  });

  it('rejects a JPEG with 415 and never uploads it', async () => {
    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', JPEG, 'photo.jpg');

    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a spoofed PDF — right name, right mime, wrong bytes', async () => {
    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', Buffer.from('not a pdf at all'), {
        filename:    'fake.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('returns 400 when no file field is sent', async () => {
    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader());

    expect(res.status).toBe(400);
  });

  it('rejects a file over 5 MB with 413 before it reaches storage', async () => {
    // Valid PDF signature, but 6 MB — multer must stop it, not the controller
    const huge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(6 * 1024 * 1024, 0x20)]);

    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', huge, 'huge.pdf');

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/i);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('names the offending field when the wrong form field is used', async () => {
    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('resume', PDF, 'CV.pdf');     // should be "file"

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('"resume"');
    expect(res.body.message).toContain('"file"');
  });

  it('returns 503 when storage is not configured', async () => {
    storage.isConfigured.mockReturnValue(false);

    const res = await request(app)
      .put('/api/about/resume')
      .set(await authHeader())
      .attach('file', PDF, 'CV.pdf');

    expect(res.status).toBe(503);
    expect(storage.upload).not.toHaveBeenCalled();
  });

});

describe('DELETE /api/about/resume', () => {

  it('rejects an anonymous request with 401', async () => {
    const res = await request(app).delete('/api/about/resume');

    expect(res.status).toBe(401);
  });

  it('clears the slot and deletes the file from storage', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));
    await request(app).put('/api/about/resume')
      .set(await authHeader()).attach('file', PDF, 'CV.pdf');

    storage.destroy.mockResolvedValue({ result: 'ok' });

    const res = await request(app)
      .delete('/api/about/resume')
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/documents/abc', 'raw');

    const about = await About.findOne();
    expect(about.resume.url).toBe('');
    expect(about.resume.publicId).toBe('');
    expect(about.hasResume).toBe(false);
  });

  it('returns 404 when there is nothing to remove', async () => {
    await About.create({});

    const res = await request(app)
      .delete('/api/about/resume')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });

  it('still clears the slot when the storage delete throws', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));
    await request(app).put('/api/about/resume')
      .set(await authHeader()).attach('file', PDF, 'CV.pdf');

    storage.destroy.mockRejectedValue(new Error('Cloudinary down'));

    const res = await request(app)
      .delete('/api/about/resume')
      .set(await authHeader());

    // The site must stop advertising a CV even if the file lingers upstream
    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(true);
    expect(res.body.data.deleted).toBe(false);

    const about = await About.findOne();
    expect(about.hasResume).toBe(false);
  });

});

describe('GET /api/resume', () => {

  it('is public and 302-redirects with fl_attachment', async () => {
    storage.upload.mockResolvedValue(uploaded('abc'));
    await request(app).put('/api/about/resume')
      .set(await authHeader()).attach('file', PDF, 'Parindra_CV.pdf');

    const res = await request(app).get('/api/resume');   // no auth header

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('fl_attachment:Parindra_CV/');
    expect(res.headers.location).toContain('res.cloudinary.com');
  });

  it('returns 404 when no résumé exists', async () => {
    await About.create({});

    const res = await request(app).get('/api/resume');

    expect(res.status).toBe(404);
  });

});
