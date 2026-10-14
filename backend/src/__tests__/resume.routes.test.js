// Cloudinary is mocked at the storage-service boundary so these run with no
// credentials and no network. What they verify is the wiring and the ORDER of
// operations — the parts that stay the same whatever the provider is.
jest.mock('../services/storage', () => {
  return {
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
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
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
    // Deleted 2026-10-04: it named the download with no extension, and no
    // client read it. GET /api/resume is the one download URL.
    expect(res.body.data).not.toHaveProperty('downloadUrl');
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

  it('rejects a file over 4 MB with 413 before it reaches storage', async () => {
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

  // GET /api/resume PROXIES the file (2026-10-04). A Cloudinary redirect
  // delivered it as `PC_Gallage` with no extension — the résumé is a `raw`
  // asset with no format, and a `.pdf` public id is refused by the free plan's
  // PDF delivery restriction. So `fetch` is stubbed here; the network is not.
  let fetchSpy;
  const pdfResponse = (status = 200) =>
    new Response(status === 200 ? PDF : 'denied', { status });

  beforeEach(() => { fetchSpy = jest.spyOn(global, 'fetch'); });
  afterEach(() => fetchSpy.mockRestore());

  const seed = (fileName, url) => About.create({
    resume: {
      url:      url ?? 'https://res.cloudinary.com/demo/raw/upload/v1/portfolio/documents/abc',
      publicId: 'portfolio/documents/abc',
      fileName,
      ext:      'PDF',
      bytes:    PDF.length,
    },
  });

  it('is public and sends the PDF bytes as an attachment named .pdf', async () => {
    fetchSpy.mockResolvedValue(pdfResponse());
    await seed('PC Gallage.pdf');

    const res = await request(app).get('/api/resume').buffer(true)
      .parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition'])
      .toBe(`attachment; filename="PC Gallage.pdf"; filename*=UTF-8''PC%20Gallage.pdf`);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(Buffer.compare(res.body, PDF)).toBe(0);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/raw/upload/v1/portfolio/documents/abc',
      expect.any(Object),
    );
  });

  it('fetches the stored url as-is — no fl_attachment, which loses the extension', async () => {
    fetchSpy.mockResolvedValue(pdfResponse());
    await seed('CV.pdf');

    await request(app).get('/api/resume');

    expect(fetchSpy.mock.calls[0][0]).not.toContain('fl_attachment');
  });

  it('adds .pdf when the stored name has none, and never doubles it', async () => {
    fetchSpy.mockResolvedValue(pdfResponse());
    await seed('My CV');
    const a = await request(app).get('/api/resume');
    expect(a.headers['content-disposition']).toContain('filename="My CV.pdf"');

    await About.deleteMany({});
    fetchSpy.mockResolvedValue(pdfResponse());
    await seed('Résumé.PDF');
    const b = await request(app).get('/api/resume');
    // ASCII fallback replaces the é; filename* carries it intact. Never .pdf.pdf.
    expect(b.headers['content-disposition'])
      .toBe(`attachment; filename="R_sum_.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9.pdf`);
  });

  it('keeps quotes and apostrophes from breaking the header', async () => {
    fetchSpy.mockResolvedValue(pdfResponse());
    await seed(`Parindra's "CV" (2026).pdf`);

    const res = await request(app).get('/api/resume');

    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="Parindra's _CV_ (2026).pdf"; ` +
      `filename*=UTF-8''Parindra%27s%20%22CV%22%20%282026%29.pdf`,
    );
  });

  it('falls back to resume.pdf when the stored name is empty', async () => {
    fetchSpy.mockResolvedValue(pdfResponse());
    await seed('');

    const res = await request(app).get('/api/resume');

    expect(res.headers['content-disposition']).toContain('filename="resume.pdf"');
  });

  it('answers 502 — not a broken file — when storage refuses', async () => {
    fetchSpy.mockResolvedValue(pdfResponse(401));
    await seed('CV.pdf');

    const res = await request(app).get('/api/resume');

    expect(res.status).toBe(502);
    expect(res.headers['content-type']).not.toBe('application/pdf');
  });

  it('answers 502 when storage cannot be reached', async () => {
    fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));
    await seed('CV.pdf');

    const res = await request(app).get('/api/resume');

    expect(res.status).toBe(502);
  });

  it('never fetches a url outside Cloudinary', async () => {
    await seed('CV.pdf', 'http://169.254.169.254/latest/meta-data');

    const res = await request(app).get('/api/resume');

    expect(res.status).toBe(502);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 404 when no résumé exists', async () => {
    await About.create({});

    const res = await request(app).get('/api/resume');

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

});
