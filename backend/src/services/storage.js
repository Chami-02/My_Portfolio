const { cloudinary, isConfigured } = require('../config/cloudinary');

// ── Storage service (PF-63, written early because PF-60 depends on it) ───────
// One adapter object so the rest of the app never imports the Cloudinary SDK
// directly. If storage ever moves to S3, only this file changes.
//
// Everything here takes a Buffer, never a file path: the backend runs on
// Vercel serverless, where the filesystem is read-only apart from /tmp and
// nothing survives between invocations. Uploads must go straight from
// multer's memory storage to the provider.

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
   * @param {string} opts.folder
   * @returns {Promise<{url: string, publicId: string, bytes: number, format: string}>}
   */
  upload(buffer, { resourceType = 'image', folder } = {}) {
    return new Promise((resolve, reject) => {
      // upload_stream, not upload(): upload() expects a path or a data URI,
      // and base64-encoding the buffer just to hand it back would waste ~33%
      // more memory on a serverless function with a hard memory cap.
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder },
        (err, result) => {
          if (err)     return reject(err);
          if (!result) return reject(new Error('Cloudinary returned no result'));

          resolve({
            url:      result.secure_url,
            publicId: result.public_id,
            bytes:    result.bytes,
            format:   result.format || '',
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
