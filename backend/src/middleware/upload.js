const multer  = require('multer');
const AppError = require('../utils/AppError');

// ── Upload middleware (PF-63, written early because PF-60 depends on it) ─────
// memoryStorage, NOT diskStorage. The backend runs on Vercel serverless: the
// filesystem is read-only apart from /tmp, and nothing written there survives
// the next invocation. Files stay in RAM just long enough to be validated and
// streamed to Cloudinary.

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;   // 2 MB — images
const MAX_PDF_BYTES   = 5 * 1024 * 1024;   // 5 MB — résumé PDFs

// The multer-level ceiling is the largest file we ever accept, so a 3 MB image
// is rejected by the controller (which knows it asked for an image) rather than
// here (which does not). Kept under the original name — PF-60 imports it.
const MAX_UPLOAD_BYTES = MAX_PDF_BYTES;

const ALLOWED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
];

/**
 * First pass, on the CLIENT-DECLARED mime type.
 *
 * A convenience check only: the browser supplies this header and it is
 * trivially spoofed. The real gate is the magic-byte check in the controller.
 * Its value is rejecting obvious mistakes before 5 MB is buffered into RAM.
 */
const fileFilter = (req, file, cb) => {
  const allowed = [...ALLOWED_IMAGE_MIME, 'application/pdf'];

  if (!allowed.includes(file.mimetype)) {
    return cb(new AppError(
      `Unsupported file type "${file.mimetype}". Allowed: PNG, JPEG, WebP, AVIF, PDF.`,
      415
    ));
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits:  { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

/**
 * Accepts a single file sent as the form field "file".
 *
 * Wrapped rather than exported raw so multer's own errors become AppErrors
 * with sensible status codes. Left unwrapped, an oversized upload surfaces as
 * a generic 500 with the unhelpful message "File too large".
 */
const uploadSingle = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    // fileFilter already produced a correctly-coded AppError. Without this,
    // the catch-all below re-wraps it and the 415 silently becomes a 400.
    if (err instanceof AppError) return next(err);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(
        `File is too large — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        413
      ));
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError(
        `Unexpected field "${err.field}" — send the file as a field named "file".`,
        400
      ));
    }

    return next(new AppError(err.message || 'Upload failed', 400));
  });
};

module.exports = {
  uploadSingle,
  MAX_UPLOAD_BYTES,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  ALLOWED_IMAGE_MIME,
};
