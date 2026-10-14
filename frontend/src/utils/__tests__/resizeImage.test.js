// PF-113 batch 2 — the browser-side resize. jsdom has no createImageBitmap and
// no real canvas, so both are stubbed; what is tested is the DECISION logic —
// when to resize, to what size, which format, and the fallbacks.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resizeImage, UndecodableImageError, MAX_EDGE } from '../resizeImage';

const MB = 1024 * 1024;
let drawn;          // [w, h] the canvas was sized to
let produce;        // (type, quality) => Blob | null — what toBlob returns
let alphaPixels;    // does getImageData report a transparent pixel?

const bitmap = (width, height) => ({ width, height, close: vi.fn() });

beforeEach(() => {
  drawn = null;
  alphaPixels = false;
  produce = (type) => new Blob([new Uint8Array(200 * 1024)], { type });
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag !== 'canvas') return realCreate(tag);
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({
        drawImage: () => { drawn = [canvas.width, canvas.height]; },
        getImageData: (_x, _y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4).fill(255);
          if (alphaPixels) data[3] = 0;
          return { data };
        },
      }),
      toBlob: (cb, type, quality) => cb(produce(type, quality)),
    };
    return canvas;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.createImageBitmap;
});

const source = (bytes, name = 'photo.jpg', type = 'image/jpeg') =>
  new File([new Uint8Array(bytes)], name, { type });

describe('resizeImage', () => {
  it('leaves a small, modest image COMPLETELY untouched', async () => {
    globalThis.createImageBitmap = vi.fn(async () => bitmap(1600, 900));
    const f = source(500 * 1024);

    const out = await resizeImage(f, { maxBytes: 4 * MB });

    expect(out).toEqual({ file: f, resized: false });
    expect(drawn).toBeNull();
  });

  it('shrinks a large phone photo to 2400px on the long edge, keeping proportions', async () => {
    globalThis.createImageBitmap = vi.fn(async () => bitmap(4032, 3024));

    const out = await resizeImage(source(6 * MB), { maxBytes: 4 * MB });

    expect(drawn).toEqual([MAX_EDGE, 1800]);
    expect(out.resized).toBe(true);
    expect(out.file.type).toBe('image/webp');
    expect(out.file.name).toBe('photo.webp');
  });

  it('resizes a PORTRAIT image by its long (vertical) edge', async () => {
    globalThis.createImageBitmap = vi.fn(async () => bitmap(3000, 4000));
    await resizeImage(source(1 * MB), { maxBytes: 4 * MB });
    expect(drawn).toEqual([1800, 2400]);
  });

  it('re-encodes a byte-heavy image even when its pixels already fit', async () => {
    globalThis.createImageBitmap = vi.fn(async () => bitmap(2000, 1500));
    const out = await resizeImage(source(5 * MB, 'scan.png', 'image/png'), { maxBytes: 4 * MB });
    expect(drawn).toEqual([2000, 1500]);
    expect(out.resized).toBe(true);
  });

  // ⚠️ EXIF orientation: without it a phone portrait arrives on its side.
  it('asks the browser to apply the photo\'s own orientation', async () => {
    globalThis.createImageBitmap = vi.fn(async () => bitmap(100, 100));
    await resizeImage(source(1024), { maxBytes: 4 * MB });
    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
  });

  it('throws UndecodableImageError when the browser cannot read the file (e.g. HEIC)', async () => {
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error('InvalidStateError'); });
    await expect(resizeImage(source(5 * MB, 'IMG.heic', 'image/heic'), { maxBytes: 4 * MB }))
      .rejects.toBeInstanceOf(UndecodableImageError);
  });

  describe('when the browser cannot ENCODE WebP (toBlob silently returns PNG)', () => {
    beforeEach(() => {
      produce = (type) => new Blob([new Uint8Array(1000)], { type: type === 'image/webp' ? 'image/png' : type });
      globalThis.createImageBitmap = vi.fn(async () => bitmap(4000, 3000));
    });

    it('falls back to JPEG for an opaque photo', async () => {
      const out = await resizeImage(source(6 * MB), { maxBytes: 4 * MB });
      expect(out.file.type).toBe('image/jpeg');
      expect(out.file.name).toBe('photo.jpg');
    });

    // JPEG has no transparency — it would paint the clear areas black.
    it('keeps a TRANSPARENT image as PNG', async () => {
      alphaPixels = true;
      const out = await resizeImage(source(6 * MB, 'logo.png', 'image/png'), { maxBytes: 4 * MB });
      expect(out.file.type).toBe('image/png');
    });
  });

  it('retries at a lower quality when the first pass is still over the limit', async () => {
    const qualities = [];
    produce = (type, quality) => {
      qualities.push(quality);
      return new Blob([new Uint8Array(quality > 0.8 ? 5 * MB : 1 * MB)], { type });
    };
    globalThis.createImageBitmap = vi.fn(async () => bitmap(4000, 3000));

    const out = await resizeImage(source(9 * MB), { maxBytes: 4 * MB });

    expect(qualities).toEqual([0.86, 0.72]);
    expect(out.file.size).toBe(1 * MB);
  });
});
