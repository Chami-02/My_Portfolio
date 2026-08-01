const { body } = require('express-validator');
const About    = require('../models/About');
const AppError = require('../utils/AppError');
const storage  = require('../services/storage');

// ── Résumé constants (PF-60) ─────────────────────────────────────────────────
const MAX_RESUME_BYTES = 5 * 1024 * 1024;   // 5 MB

/**
 * True if the buffer really is a PDF.
 *
 * Checks magic bytes, not the extension or the Content-Type header — both of
 * those are supplied by the client and trivially spoofed. Every PDF begins
 * with the five bytes "%PDF-" (25 50 44 46 2D).
 *
 * The ticket suggested the `file-type` package. Deliberately not used: v17+ is
 * pure ESM and `require()`ing it from this CommonJS backend throws
 * ERR_REQUIRE_ESM, so it would mean either pinning an EOL v16 or reworking the
 * import. For a PDF-only check the signature is five bytes — a dependency buys
 * nothing here.
 */
const isPdf = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.length >= 5 &&
  buffer.subarray(0, 5).toString('latin1') === '%PDF-';

// ── Validation rules ─────────────────────────────────────────────────────────
const aboutRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('bio')
    .optional()
    .isArray().withMessage('Bio must be an array of strings'),
  body('email')
    .optional()
    .isEmail().withMessage('Must be a valid email'),
];

// ── GET /api/about ────────────────────────────────────────────────────────────
// Public — returns your profile for the About section
const getAbout = async (req, res, next) => {
  try {
    // findOne with no filter — returns the only document in the collection
    let about = await About.findOne();

    // If no document exists yet, create one with defaults from the schema
    if (!about) {
      about = await About.create({});
    }

    res.json({ status: 'success', data: about });
  } catch (err) { next(err); }
};

// ── PUT /api/about ────────────────────────────────────────────────────────────
// Protected — admin only (JWT protect added in PF-35)
// Updates the SINGLE about document (upserts if missing)
const updateAbout = async (req, res, next) => {
  try {
    const about = await About.findOneAndUpdate(
      {},                    // No filter — matches the only document
      { $set: req.body },    // $set = only update the provided fields
      {
        returnDocument: 'after',
        runValidators:  true,
        upsert:         true,  // Create if doesn't exist
      }
    );
    res.json({ status: 'success', data: about });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── PATCH /api/about/availability ────────────────────────────────────────────
// Protected — quick toggle for "available for work" status
const toggleAvailability = async (req, res, next) => {
  try {
    const about = await About.findOne();
    if (!about) return next(new AppError('Profile not found', 404));

    about.availableForWork = !about.availableForWork;
    await about.save();

    res.json({
      status:  'success',
      message: `Availability set to: ${about.availableForWork ? 'Open to work ✅' : 'Not available ❌'}`,
      data:    about,
    });
  } catch (err) { next(err); }
};

// ── PUT /api/about/resume ────────────────────────────────────────────────────
// Protected. Uploads a new résumé and DELETES the previous one.
// The order of operations matters — see the note at the end.
const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded — send a "file" field', 400));
    }

    const buffer = req.file.buffer;

    // Validate the REQUEST before inspecting server state: a JPEG is wrong
    // whether or not storage happens to be configured, and the client can act
    // on 415 but can do nothing about a 503.
    if (!isPdf(buffer)) {
      return next(new AppError('Résumé must be a PDF.', 415));
    }

    // multer enforces this too; kept as defence in depth for any future caller
    // that reaches the controller without going through uploadSingle.
    if (buffer.length > MAX_RESUME_BYTES) {
      return next(new AppError(
        `Résumé is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`,
        413
      ));
    }

    // Only now is it a server problem. Fail loudly rather than letting the
    // SDK throw something opaque about missing credentials.
    if (!storage.isConfigured()) {
      return next(new AppError('File storage is not configured on this server', 503));
    }

    // Single About document
    let about = await About.findOne();
    if (!about) about = await About.create({});

    // Remember the old file so it can be deleted AFTER the new one lands
    const oldPublicId = about.resume && about.resume.publicId;

    // ── 1. Upload the new file first ────────────────────────────
    // resource_type 'raw', not 'image': Cloudinary's PDF delivery restriction
    // is enabled by default on free accounts, so an 'image' upload succeeds
    // and then returns 401 to anyone who opens the URL.
    const folder = `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/documents`;
    const result = await storage.upload(buffer, { resourceType: 'raw', folder });

    // ── 2. Save the new metadata ────────────────────────────────
    about.resume = {
      url:        result.url,
      publicId:   result.publicId,
      fileName:   req.file.originalname || 'resume.pdf',
      ext:        'PDF',
      bytes:      result.bytes || buffer.length,
      uploadedAt: new Date(),
    };

    await about.save();

    // ── 3. Only NOW delete the old file ─────────────────────────
    // Non-fatal: if this fails there is still a working résumé, so the orphan
    // is logged rather than failing the request.
    let oldDeleted = false;
    if (oldPublicId && oldPublicId !== result.publicId) {
      try {
        const del = await storage.destroy(oldPublicId, 'raw');
        oldDeleted = del.result === 'ok';

        if (!oldDeleted) {
          console.warn(`[PF-60] Old résumé not deleted (${del.result}): ${oldPublicId}`);
        }
      } catch (e) {
        console.warn(`[PF-60] Failed to delete old résumé ${oldPublicId}:`, e.message);
      }
    }

    res.json({
      status: 'success',
      data: {
        resume:      about.resume,
        hasResume:   true,
        replaced:    Boolean(oldPublicId),
        oldDeleted,
        downloadUrl: storage.attachmentUrl(about.resume.url, about.resume.fileName),
      },
    });

  } catch (err) { next(err); }
};

// ── DELETE /api/about/resume ─────────────────────────────────────────────────
// Protected. Removes the résumé entirely — the admin card returns to MISSING
// and the public Download CV buttons stop rendering.
const removeResume = async (req, res, next) => {
  try {
    const about = await About.findOne();
    if (!about) return next(new AppError('About document not found', 404));

    if (!about.resume || !about.resume.url) {
      return next(new AppError('No résumé to remove', 404));
    }

    const publicId = about.resume.publicId;

    // Clear the slot first so the site stops advertising a file that is
    // about to disappear.
    about.resume = {
      url: '', publicId: '', fileName: '', ext: '', bytes: 0, uploadedAt: null,
    };
    await about.save();

    let deleted = false;
    if (publicId) {
      try {
        const del = await storage.destroy(publicId, 'raw');
        deleted = del.result === 'ok';
      } catch (e) {
        console.warn(`[PF-60] Failed to delete résumé ${publicId}:`, e.message);
      }
    }

    res.json({ status: 'success', data: { removed: true, deleted, hasResume: false } });

  } catch (err) { next(err); }
};

// ── GET /api/resume ──────────────────────────────────────────────────────────
// Public. 302-redirects to the current résumé as a forced download.
//
// Gives one permanent URL that survives every replacement — safe to put in an
// email signature, unlike the Cloudinary URL which changes on each upload.
const downloadResume = async (req, res, next) => {
  try {
    const about = await About.findOne().select('resume');

    if (!about || !about.resume || !about.resume.url) {
      return next(new AppError('No résumé is currently available', 404));
    }

    res.redirect(302, storage.attachmentUrl(about.resume.url, about.resume.fileName));

  } catch (err) { next(err); }
};

module.exports = {
  aboutRules,
  getAbout,
  updateAbout,
  toggleAvailability,
  uploadResume,
  removeResume,
  downloadResume,
  isPdf,              // exported for tests — magic-byte checking is the
  MAX_RESUME_BYTES,   // security-critical part and deserves direct coverage
};
