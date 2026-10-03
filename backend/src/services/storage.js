const { cloudinary, isConfigured } = require('../config/cloudinary');

// ── Storage service (PF-63, written early because PF-60 depends on it) ───────
// One adapter object so the rest of the app never imports the Cloudinary SDK
// directly. If storage ever moves to S3, only this file changes.
//
// Everything here takes a Buffer, never a file path: the backend runs on
// Vercel serverless, where the filesystem is read-only apart from /tmp and
// nothing survives between invocations. Uploads must go straight from
// multer's memory storage to the provider.

// Read lazily rather than at module load: the config tests mutate the
// environment between requires, and a captured constant would go stale.
const defaultFolder = () => process.env.CLOUDINARY_FOLDER || 'portfolio';


/**
 * The address a VISITOR's browser is given for an uploaded image.
 *
 * `f_auto,q_auto` is a Cloudinary delivery transformation: the CDN picks the
 * format the requesting browser supports best (WebP/AVIF, else the original)
 * and a quality setting that is visually indistinguishable. Measured
 * 2026-10-03 on this account: the same image delivered as a 1.19 MB WebP to a
 * modern browser, versus the 3.97 MB PNG the old URL served. Visitors' downloads
 * are bandwidth, and bandwidth spends the same 25 free monthly credits as
 * storage — this is the single biggest lever on how far the free plan stretches.
 *
 * Each derived version is generated once and then cached; that costs
 * transformation credits (1,000 per credit), a few per image, once.
 *
 * Images only. A PDF must be served as exactly the bytes uploaded.
 * Inserted after `/upload/` — the one place Cloudinary reads transformations
 * — and only once, so a URL that already carries it is left alone.
 */
const deliveryUrl = (secureUrl) =>
  secureUrl.includes('/upload/f_auto,q_auto/')
    ? secureUrl
    : secureUrl.replace('/upload/', '/upload/f_auto,q_auto/');
const storage = {

  isConfigured,

  /**
   * Upload a buffer.
   *
   * @param {Buffer} buffer
   * @param {object} opts
   * @param {'image'|'raw'} opts.resourceType
   *        'raw' for PDFs and other documents, 'image' for pictures.
   *        See the note on destroy() — this choice is sticky.
   * @param {string} opts.folder  defaults to CLOUDINARY_FOLDER, else 'portfolio'
   * @returns {Promise<{url: string, publicId: string, bytes: number,
   *                    format: string, width?: number, height?: number}>}
   */
  upload(buffer, { resourceType = 'image', folder = defaultFolder() } = {}) {
    return new Promise((resolve, reject) => {
      // ⚠️ NO `quality` / `fetch_format` here (removed PF-113 batch 2).
      // PF-63 passed both at UPLOAD time believing they made Cloudinary serve
      // WebP/AVIF. Measured against the real account on 2026-10-03, they do the
      // opposite: a 2.88 MB PNG was STORED as a 3.97 MB PNG (re-encoded,
      // bigger), and the returned URL served that PNG to every browser. Upload
      // options shape the STORED file; what a visitor downloads is decided by
      // the DELIVERY URL — see deliveryUrl() above.
      const options = { resource_type: resourceType, folder };

      // upload_stream, not upload(): upload() expects a path or a data URI,
      // and base64-encoding the buffer just to hand it back would waste ~33%
      // more memory on a serverless function with a hard memory cap.
      const stream = cloudinary.uploader.upload_stream(
        options,
        (err, result) => {
          if (err)     return reject(err);
          if (!result) return reject(new Error('Cloudinary returned no result'));

          resolve({
            url:      resourceType === 'image' ? deliveryUrl(result.secure_url) : result.secure_url,
            publicId: result.public_id,
            bytes:    result.bytes,
            format:   result.format || '',
            // Undefined on raw uploads — a PDF has no pixel dimensions. The
            // image picker needs them to size its thumbnail without a reflow.
            width:    result.width,
            height:   result.height,
          });
        }
      );

      stream.end(buffer);
    });
  },

  /**
   * Remove a previously uploaded asset.
   *
   * ⚠️ resourceType MUST match how the file was uploaded.
   * Cloudinary defaults to 'image'. Calling destroy() on a raw file without
   * specifying 'raw' returns { result: 'not found' } and silently does
   * nothing — the file stays, you get no error, and orphans build up
   * invisibly until the free tier fills.
   *
   * @param {string} publicId
   * @param {'image'|'raw'} resourceType
   */
  async destroy(publicId, resourceType = 'image') {
    if (!publicId) return { result: 'skipped' };

    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  },

  /**
   * Build a URL that forces a download with a proper filename.
   *
   * ⚠️ The HTML `download` attribute is IGNORED for cross-origin URLs. A plain
   * Cloudinary link opens the PDF in a browser tab instead of downloading it,
   * and if it does save, the file is named after the random public ID.
   * `fl_attachment` fixes both, server-side.
   *
   * @param {string} url       the stored secure_url
   * @param {string} fileName  desired download name
   */
  attachmentUrl(url, fileName) {
    if (!url) return '';

    // Strip the extension — Cloudinary appends it automatically, so leaving
    // it on produces "CV.pdf.pdf".
    const base = String(fileName || 'resume').replace(/\.[^.]+$/, '');

    // Cloudinary only accepts safe characters in a transformation flag value.
    // Spaces and parentheses in a filename would corrupt the URL.
    const safe = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'resume';

    return url.replace('/upload/', `/upload/fl_attachment:${safe}/`);
  },
};

module.exports = storage;
