// PF-113 batch 2 — prepareFile is the ONE path for both the upload pill and a
// drag-and-drop. The resize itself is mocked (jsdom has no canvas).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const resize = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../resizeImage', async (orig) => ({ ...(await orig()), resizeImage: resize.fn }));

const { prepareFile, imageSpec, RESUME_SPEC, MAX_UPLOAD_MB } = await import('../mediaFile');
const { UndecodableImageError } = await import('../resizeImage');

const MB = 1024 * 1024;
const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, { type });
const IMG = imageSpec('Background');

beforeEach(() => {
  resize.fn.mockReset();
  resize.fn.mockImplementation(async (f) => ({ file: f, resized: false }));
});

describe('the limits', () => {
  // ⚠️ Vercel refuses any request over 4.5 MB in production. Never above 4.
  it('is 4 MB for images and the résumé alike', () => {
    expect(MAX_UPLOAD_MB).toBe(4);
    expect(IMG.maxBytes).toBe(4 * MB);
    expect(RESUME_SPEC.maxBytes).toBe(4 * MB);
    expect(IMG.maxBytes).toBeLessThan(4.5 * MB);
  });
});

describe('prepareFile', () => {
  it('refuses a wrong type BEFORE trying to resize it', async () => {
    const out = await prepareFile(file(10, 'logo.svg', 'image/svg+xml'), IMG);
    expect(out).toEqual({ error: 'Background must be a PNG, JPEG or WEBP image.' });
    expect(resize.fn).not.toHaveBeenCalled();
  });

  it('passes a small image through untouched', async () => {
    const f = file(300 * 1024, 'bg.jpg', 'image/jpeg');
    expect(await prepareFile(f, IMG)).toEqual({ file: f, resizedFrom: null });
  });

  it('returns the RESIZED file and the size it came from', async () => {
    const big = file(9 * MB, 'phone.jpg', 'image/jpeg');
    const small = file(500 * 1024, 'phone.webp', 'image/webp');
    resize.fn.mockResolvedValue({ file: small, resized: true });

    expect(await prepareFile(big, IMG)).toEqual({ file: small, resizedFrom: 9 * MB });
  });

  it('still refuses when even the resized file is over the limit', async () => {
    resize.fn.mockResolvedValue({ file: file(4.2 * MB, 'x.webp', 'image/webp'), resized: true });
    const out = await prepareFile(file(9 * MB, 'x.jpg', 'image/jpeg'), IMG);
    expect(out.error).toBe('Background is 4.2 MB — the limit is 4 MB.');
  });

  it('an undecodable but SMALL image is let through — the server decides by its bytes', async () => {
    resize.fn.mockRejectedValue(new UndecodableImageError());
    const f = file(100 * 1024, 'odd.jpg', 'image/jpeg');
    expect(await prepareFile(f, IMG)).toEqual({ file: f, resizedFrom: null });
  });

  it('an undecodable OVERSIZED image gets the "export as JPEG or PNG" message', async () => {
    resize.fn.mockRejectedValue(new UndecodableImageError());
    const out = await prepareFile(file(6 * MB, 'odd.jpg', 'image/jpeg'), IMG);
    expect(out.error).toMatch(/could not be opened for resizing — export it as JPEG or PNG/);
  });

  it('never resizes a PDF, and refuses one over 4 MB', async () => {
    const out = await prepareFile(file(4.5 * MB, 'cv.pdf', 'application/pdf'), RESUME_SPEC);
    expect(resize.fn).not.toHaveBeenCalled();
    expect(out.error).toBe('Résumé is 4.5 MB — the limit is 4 MB.');
  });

  it('rethrows an UNEXPECTED resize failure rather than hiding it', async () => {
    resize.fn.mockRejectedValue(new TypeError('boom'));
    await expect(prepareFile(file(6 * MB, 'x.jpg', 'image/jpeg'), IMG)).rejects.toThrow('boom');
  });
});
