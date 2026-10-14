// PF-120 — the magic-byte gate on its own. Its only direct tests used to live
// in upload.test.js, deleted with POST /api/upload; the four media handlers
// still depend on every branch here.
const { detectFileType, isPdf, isAllowedImage } = require('../utils/fileType');

const bytes = (...parts) => Buffer.concat(parts.map((p) =>
  (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))));
const pad = (buf) => Buffer.concat([buf, Buffer.alloc(32)]);

const SAMPLES = {
  'image/png':  pad(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': pad(bytes([0xff, 0xd8, 0xff, 0xe0])),
  'image/webp': pad(bytes('RIFF', [0, 0, 0, 0], 'WEBP')),
  'image/avif': pad(bytes([0, 0, 0, 0x1c], 'ftypmif1', [0, 0, 0, 0], 'avif')),
  'application/pdf': pad(bytes('%PDF-1.7')),
  'image/gif':  pad(bytes('GIF89a')),
  'image/bmp':  pad(bytes('BM')),
  'image/tiff': pad(bytes([0x49, 0x49, 0x2a, 0x00])),
};

describe('detectFileType (PF-111, PF-120)', () => {
  it.each(Object.entries(SAMPLES))('recognises %s by its bytes', (mime, buf) => {
    expect(detectFileType(buf)).toEqual({ mime });
  });

  it('also recognises big-endian TIFF', () => {
    expect(detectFileType(pad(bytes([0x4d, 0x4d, 0x00, 0x2a])))).toEqual({ mime: 'image/tiff' });
  });

  it.each([
    ['an SVG — XML, no magic number', pad(bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))],
    ['an SVG with leading whitespace', pad(bytes('   <svg onload="alert(1)"/>'))],
    ['HTML', pad(bytes('<!doctype html><script>alert(1)</script>'))],
    ['plain text', pad(bytes('just some text'))],
    ['a buffer under 5 bytes', bytes([0x89, 0x50])],
    ['not a buffer at all', '%PDF-1.7'],
  ])('returns null for %s', (_label, input) => {
    expect(detectFileType(input)).toBeNull();
  });
});

describe('the two gates', () => {
  it('isAllowedImage accepts PNG, JPEG and WebP only', () => {
    const accepted = Object.entries(SAMPLES).filter(([, buf]) => isAllowedImage(buf)).map(([m]) => m);
    expect(accepted).toEqual(['image/png', 'image/jpeg', 'image/webp']);
  });

  it('isPdf accepts the PDF only', () => {
    const accepted = Object.entries(SAMPLES).filter(([, buf]) => isPdf(buf)).map(([m]) => m);
    expect(accepted).toEqual(['application/pdf']);
  });
});
