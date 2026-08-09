const storage = require('../services/storage');
const { isPdf, MAX_RESUME_BYTES } = require('../controllers/aboutController');

// No network here — every one of these is pure logic, so the suite runs
// without a Cloudinary account existing.

describe('storage.attachmentUrl (PF-60 Step 4)', () => {

  const base = 'https://res.cloudinary.com/demo/raw/upload/v1/portfolio/documents/abc.pdf';

  it('injects the fl_attachment flag', () => {
    expect(storage.attachmentUrl(base, 'CV.pdf')).toContain('/upload/fl_attachment:CV/');
  });

  it('strips the file extension from the flag', () => {
    // Left on, Cloudinary would serve the file as "CV.pdf.pdf"
    expect(storage.attachmentUrl(base, 'CV.pdf')).not.toContain('fl_attachment:CV.pdf');
  });

  it('sanitises spaces and parentheses that would corrupt the URL', () => {
    const out = storage.attachmentUrl(base, 'My CV (2026)!.pdf');

    expect(out).toMatch(/fl_attachment:[A-Za-z0-9._-]+\//);
    expect(out).not.toMatch(/[ ()!]/);
  });

  it('replaces unsafe characters one-for-one rather than dropping them', () => {
    expect(storage.attachmentUrl(base, '!!!.pdf')).toContain('fl_attachment:___/');
  });

  it('falls back to "resume" when the name is nothing but an extension', () => {
    // '.pdf' → extension stripped → empty → would emit "fl_attachment:/"
    expect(storage.attachmentUrl(base, '.pdf')).toContain('fl_attachment:resume/');
  });

  it('falls back to "resume" when no filename is given', () => {
    expect(storage.attachmentUrl(base, '')).toContain('fl_attachment:resume/');
  });

  it('returns an empty string for empty input', () => {
    expect(storage.attachmentUrl('', 'CV.pdf')).toBe('');
  });

  it('leaves the rest of the URL untouched', () => {
    expect(storage.attachmentUrl(base, 'CV.pdf'))
      .toBe('https://res.cloudinary.com/demo/raw/upload/fl_attachment:CV/v1/portfolio/documents/abc.pdf');
  });

});

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

  it('caps résumés at 5 MB', () => {
    expect(MAX_RESUME_BYTES).toBe(5 * 1024 * 1024);
  });

});
