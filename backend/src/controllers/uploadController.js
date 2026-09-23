const storage  = require('../services/storage');
const AppError = require('../utils/AppError');
const {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  ALLOWED_IMAGE_MIME,
} = require('../middleware/upload');

// PF-111 — the sniffer moved to utils/fileType.js when the About portrait and
// project background handlers became its third and fourth callers. Nothing
// about the detection changed; this file simply stopped owning it.
const { detectFileType } = require('../utils/fileType');

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

    // PF-111 — only NOW is it a server problem, the same ordering uploadResume
    // uses: the request is judged on its own merits first, because a GIF is
    // wrong whether or not storage happens to be configured, and the caller can
    // act on a 415 but can do nothing at all about a 503.
    //
    // ⚠️ THIS ROUTE HAD NO SUCH GUARD until PF-111, and the asymmetry was
    // invisible: PUT /api/about/resume returned a clean 503 while this one let
    // the SDK throw something opaque about missing credentials. Both upload
    // paths now fail the same way.
    if (!storage.isConfigured()) {
      return next(new AppError('File storage is not configured on this server', 503));
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