const storage = require('../services/storage');
const { isPdf, MAX_RESUME_BYTES } = require('../controllers/aboutController');

// No network here — every one of these is pure logic, so the suite runs
// without a Cloudinary account existing.

// storage.attachmentUrl was deleted 2026-10-04: GET /api/resume now proxies
// the file and names it itself — see resume.routes.test.js.

describe('storage.destroy guard', () => {

  it('skips without calling Cloudinary when publicId is empty', async () => {
    // Would throw on a network call — proves the guard short-circuits first
    await expect(storage.destroy('')).resolves.toEqual({ result: 'skipped' });
  });

});

describe('isPdf magic-byte validation (PF-60 Step 5)', () => {

  const pdf = (rest = '') => Buffer.from(`%PDF-1.7${rest}`, 'latin1');

  it('accepts a real PDF signature', () => {
    expect(isPdf(pdf('\n1 0 obj'))).toBe(true);
  });

  it('rejects a text file renamed to .pdf', () => {
    expect(isPdf(Buffer.from('not a pdf at all'))).toBe(false);
  });

  it('rejects a JPEG', () => {
    expect(isPdf(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe(false);
  });

  it('rejects a buffer too short to hold a signature', () => {
    expect(isPdf(Buffer.from('%PD'))).toBe(false);
  });

  it('rejects an empty buffer', () => {
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });

  it('rejects non-buffer input', () => {
    expect(isPdf('%PDF-1.7')).toBe(false);
    expect(isPdf(null)).toBe(false);
    expect(isPdf(undefined)).toBe(false);
  });

  it('is not fooled by a PDF signature further into the file', () => {
    expect(isPdf(Buffer.from('GIF89a%PDF-1.7'))).toBe(false);
  });

  // PF-113 batch 2: 5 → 4 MB. Vercel refuses any request body over 4.5 MB in
  // production, so the old 5 MB was a promise only localhost could keep.
  it('caps résumés at 4 MB — under Vercel\'s 4.5 MB request cap', () => {
    expect(MAX_RESUME_BYTES).toBe(4 * 1024 * 1024);
    expect(MAX_RESUME_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

});
