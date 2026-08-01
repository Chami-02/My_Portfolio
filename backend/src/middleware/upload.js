const multer  = require('multer');
const AppError = require('../utils/AppError');

// ── Upload middleware (PF-63, written early because PF-60 depends on it) ─────
// memoryStorage, NOT diskStorage. The backend runs on Vercel serverless: the
// filesystem is read-only apart from /tmp, and nothing written there survives
// the next invocation. Files stay in RAM just long enough to be validated and
// streamed to Cloudinary.

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;   // 5 MB — matches the résumé limit

const upload = multer({
  storage: multer.memoryStorage(),
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

module.exports = { uploadSingle, MAX_UPLOAD_BYTES };
