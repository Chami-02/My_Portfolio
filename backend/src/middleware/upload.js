const multer  = require('multer');
const AppError = require('../utils/AppError');

// ── Upload middleware (PF-63, written early because PF-60 depends on it) ─────
// memoryStorage, NOT diskStorage. The backend runs on Vercel serverless: the
// filesystem is read-only apart from /tmp, and nothing written there survives
// the next invocation. Files stay in RAM just long enough to be validated and
// streamed to Cloudinary.

// ── 4 MB for EVERYTHING, and NEVER above it (PF-113 batch 2, owner 2026-10-03) ──
// ⚠️ THE REAL CEILING IS VERCEL'S, NOT OURS. Production runs these routes as a
// Vercel Function, and Vercel refuses any request body over 4.5 MB on every
// plan (413 FUNCTION_PAYLOAD_TOO_LARGE) BEFORE this code runs. 4 MB plus the
// multipart wrapping stays under it with ~0.5 MB to spare.
//
// Raising either number past 4.5 MB fails SILENTLY IN THE WRONG PLACE: every
// upload still works locally (no Vercel in front of `npm run dev`), and only
// production refuses — with Vercel's own error, which no message here explains.
// That is exactly what the old 5 MB résumé cap did for any 4.5–5 MB PDF.
//
// Was 2 MB (images) / 5 MB (PDFs). The panel now resizes large photos in the
// browser first (frontend/src/utils/resizeImage.js), so 4 MB is a safety
// margin, not the normal size. A 10 MB route (direct browser → Cloudinary
// uploads) was offered and DECLINED — see locked-decisions.md.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;   // 4 MB — images
const MAX_PDF_BYTES   = 4 * 1024 * 1024;   // 4 MB — résumé PDFs

// The multer-level ceiling is the largest file we ever accept. Equal to both
// limits now, so multer is what refuses an oversized file of either kind; the
// handlers' own checks stay as defence in depth for a caller that skips
// uploadSingle. Kept under the original name — PF-60 imports it.
const MAX_UPLOAD_BYTES = Math.max(MAX_IMAGE_BYTES, MAX_PDF_BYTES);

// PF-120 — the image types multer lets through are EXACTLY the ones the
// handlers accept (utils/fileType.js). This list used to add image/avif for
// POST /api/upload; that route is deleted, and a wider screen than the gate
// only buffers 4 MB of a file that is certain to be refused.
const { MEDIA_IMAGE_MIME } = require('../utils/fileType');

/**
 * First pass, on the CLIENT-DECLARED mime type.
 *
 * A convenience check only: the browser supplies this header and it is
 * trivially spoofed. The real gate is the magic-byte check in the controller.
 * Its value is rejecting obvious mistakes before 4 MB is buffered into RAM.
 */
const fileFilter = (req, file, cb) => {
  const allowed = [...MEDIA_IMAGE_MIME, 'application/pdf'];

  if (!allowed.includes(file.mimetype)) {
    return cb(new AppError(
      `Unsupported file type "${file.mimetype}". Allowed: PNG, JPEG, WebP, PDF.`,
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
 * PF-135 — the backup file for a restore. JSON, not an image, so it has its
 * own courtesy filter: the browser's declared type is trivially spoofed and
 * some send `application/octet-stream` (or nothing) for a .json file. The
 * real gate is parsing + validating every row (services/backupFile.js), as
 * the magic bytes are for images. Same 4 MB ceiling as every upload; the
 * password travels as a text field beside the file, capped at 1 KB.
 */
const BACKUP_MIME = ['application/json', 'text/json', 'application/octet-stream', 'text/plain', ''];

const backupFilter = (_req, file, cb) => {
  if (BACKUP_MIME.includes(file.mimetype) || /\.json$/i.test(file.originalname || '')) return cb(null, true);
  cb(new AppError('That is not a backup file — choose the .json file DOWNLOAD BACKUP saved.', 415));
};

const backupUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: backupFilter,
  limits:  { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, fieldSize: 1024 },
});

/**
 * Wraps a multer middleware so its own errors become AppErrors with sensible
 * status codes. Left unwrapped, an oversized upload surfaces as a generic 500
 * with the unhelpful message "File too large".
 */
const translateErrors = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
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

/** Accepts a single file sent as the form field "file". */
const uploadSingle = translateErrors(upload.single('file'));

/** PF-135 — the backup JSON, as the form field "file" (plus `password`). */
const uploadBackup = translateErrors(backupUpload.single('file'));

module.exports = {
  uploadSingle,
  uploadBackup,
  MAX_UPLOAD_BYTES,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
};
