const storage  = require('../services/storage');
const AppError = require('../utils/AppError');
const {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  ALLOWED_IMAGE_MIME,
} = require('../middleware/upload');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Magic-byte sniffer for the five formats this endpoint accepts.
 *
 * The ticket used the `file-type` package. Deliberately not used, for the same
 * reason recorded against the PDF check in aboutController: v17+ is pure ESM
 * and will not require() from this CommonJS backend, while the last CommonJS
 * line (v16) is EOL and carries GHSA-5v7r-6r5c-r473 — an infinite loop in its
 * ASF parser, which would hang Node's single event loop and take the whole
 * server with it.
 *
 * Sniffing only the formats we allow is also strictly safer than a general
 * detector: a malformed ASF file never reaches a parser at all, it just fails
 * every check and gets rejected.
 *
 * Returns { mime } — the shape the calling code expects — or null.
 */
const detectFileType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) return null;

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { mime: 'image/png' };
  }

  // JPEG always opens FF D8 FF; the fourth byte varies by marker.
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg' };
  }

  // RIFF container: "RIFF" <4-byte length> "WEBP"
  if (buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('latin1')  === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp' };
  }

  // ISO-BMFF: <4-byte box size> "ftyp" <major brand> ... <compatible brands>.
  // Some encoders declare avif only in the compatible-brand list, so scan the
  // whole brand region rather than just the major brand.
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brands = buffer.subarray(8, Math.min(buffer.length, 32)).toString('latin1');
    if (brands.includes('avif') || brands.includes('avis')) {
      return { mime: 'image/avif' };
    }
  }

  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { mime: 'application/pdf' };
  }

  // ── Recognised but NOT allowed ───────────────────────────────────────────
  // Identifying these buys a precise 415 naming the real type, instead of a
  // misleading 400 telling the user their perfectly valid GIF is corrupt.
  // Uploading a GIF or a screenshot-as-BMP is an ordinary mistake, not an
  // attack, and the error should say so.
  if (buffer.subarray(0, 4).toString('latin1') === 'GIF8') return { mime: 'image/gif' };

  if (buffer.length >= 14 && buffer.subarray(0, 2).toString('latin1') === 'BM') {
    return { mime: 'image/bmp' };
  }

  // TIFF: "II" 2A 00 (little-endian) or "MM" 00 2A (big-endian). Compared as raw
  // bytes, not text — the marker contains a NUL that a string literal mangles.
  if (buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) {
    return { mime: 'image/tiff' };
  }

  return null;
};

// ── POST /api/upload ─────────────────────────────────────────────────────────
// Protected. Accepts one file, validates it properly, stores it, returns a URL.
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded — send a "file" field', 400));
    }

    const buffer = req.file.buffer;

    // ── THE REAL CHECK ──────────────────────────────────────────
    // Read the magic bytes. This is what the file ACTUALLY is,
    // regardless of its extension or the Content-Type the client sent.
    const detected = detectFileType(buffer);

    if (!detected) {
      return next(new AppError('Could not determine the file type — file may be corrupt', 400));
    }

    const isImage = ALLOWED_IMAGE_MIME.includes(detected.mime);
    const isPdf   = detected.mime === 'application/pdf';

    if (!isImage && !isPdf) {
      return next(new AppError(
        `File is actually "${detected.mime}", which is not allowed. ` +
        `Allowed: PNG, JPEG, WebP, AVIF, PDF.`,
        415
      ));
    }

    // Per-type size limit
    const limit = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (buffer.length > limit) {
      return next(new AppError(
        `File is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ` +
        `${limit / 1024 / 1024} MB for ${isPdf ? 'PDFs' : 'images'}.`,
        413
      ));
    }

    const result = await storage.upload(buffer, {
      resourceType: isPdf ? 'raw' : 'image',
      folder:       isPdf ? `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/documents`
                          : `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/projects`,
    });

    res.status(201).json({ status: 'success', data: result });

  } catch (err) {
    next(err);
  }
};

module.exports = { uploadFile };