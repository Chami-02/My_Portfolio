// frontend/src/utils/resizeImage.js
//
// PF-113 batch 2 — shrink a picked photo IN THE BROWSER before it is staged.
//
// ── WHY ───────────────────────────────────────────────────────────────────────
// A phone photo is commonly 4000+ px and 3–12 MB. The home page shows it in a
// card roughly 400–610 px wide (`background-size: cover`), so every visitor
// would download 10–20× the pixels the card can use — and visitor downloads are
// Cloudinary BANDWIDTH, which spends the same 25 free monthly credits as
// storage. Resizing here also means an oversized photo is fixed rather than
// refused, and the upload stays far under Vercel's 4.5 MB request cap.
//
// Native canvas only — "no frontend libraries" is a locked decision.
//
// ⚠️ NOT A SECURITY CONTROL. The server's magic-byte check and 4 MB limit are
// the gate; this is a courtesy that makes the common case work.

/** The long edge, in px, an image is reduced to. 2400 covers the widest card
 *  (~610 CSS px) at 3× density and the About portrait with room to spare. */
export const MAX_EDGE = 2400;

/** WebP quality. 0.86 is visually clean on photographs; 0.72 is the one retry
 *  used only when the first pass is still over the byte limit. */
const QUALITIES = [0.86, 0.72];

/** Thrown when the browser cannot decode the file at all (e.g. HEIC in Chrome). */
export class UndecodableImageError extends Error {
  constructor() {
    super('This image could not be opened in the browser.');
    this.name = 'UndecodableImageError';
  }
}

const extFor = (type) => ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[type] || 'img');

const renameTo = (name, type) => `${String(name).replace(/\.[^.]+$/, '') || 'image'}.${extFor(type)}`;

/** Does any pixel carry transparency? Only asked on the fallback path. */
const hasAlpha = (ctx, w, h) => {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
};

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * @param {File} file
 * @param {{ maxBytes: number, maxEdge?: number }} opts
 * @returns {Promise<{ file: File, resized: boolean }>}
 *
 * Returns the ORIGINAL file untouched when it is already within both limits —
 * re-encoding a small, correct image would only lose quality.
 */
export async function resizeImage(file, { maxBytes, maxEdge = MAX_EDGE }) {
  let bitmap;
  try {
    // 'from-image' applies the photo's EXIF orientation, so a portrait shot on
    // a phone stays upright instead of arriving on its side.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UndecodableImageError();
  }

  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (file.size <= maxBytes && longEdge <= maxEdge) {
    bitmap.close?.();
    return { file, resized: false };
  }

  const scale = Math.min(1, maxEdge / longEdge);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let blob = null;
  for (const quality of QUALITIES) {
    blob = await toBlob(canvas, 'image/webp', quality);

    // ⚠️ A browser that cannot ENCODE WebP silently hands back a PNG instead —
    // `toBlob` does not fail. Detect it by the type it actually produced.
    if (!blob || blob.type !== 'image/webp') {
      // JPEG has no transparency and would paint it black, so a transparent
      // image falls back to PNG; everything else to JPEG.
      blob = hasAlpha(ctx, w, h)
        ? await toBlob(canvas, 'image/png')
        : await toBlob(canvas, 'image/jpeg', quality);
    }
    if (blob && blob.size <= maxBytes) break;
  }

  if (!blob) throw new UndecodableImageError();

  return {
    file: new File([blob], renameTo(file.name, blob.type), { type: blob.type, lastModified: Date.now() }),
    resized: true,
  };
}
