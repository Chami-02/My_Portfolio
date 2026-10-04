const { body } = require('express-validator');
const About    = require('../models/About');
const AppError = require('../utils/AppError');
const storage  = require('../services/storage');

// PF-111 — magic-byte checks live in one module now. `isPdf` used to be
// defined here; it moved when the portrait handler below needed the same
// treatment for images and a second copy would have been a second source of
// truth for a security check. See utils/fileType.js for why `file-type` is
// deliberately not a dependency.
const { isPdf, isAllowedImage, MEDIA_IMAGE_MIME } = require('../utils/fileType');

// ── Size limits — IMPORTED, never re-typed (PF-113 batch 2) ──────────────────
// Both are 4 MB and live in middleware/upload.js beside the reason they cannot
// go higher (Vercel's 4.5 MB request cap). This file used to carry its own
// `5 * 1024 * 1024` for the résumé, which is how a second number drifts.
const { MAX_IMAGE_BYTES, MAX_PDF_BYTES: MAX_RESUME_BYTES } = require('../middleware/upload');

const AVATAR_FOLDER = () => `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/profile`;

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
  // ⚠️ PF-112 — availableForWork now arrives on the profile PUT.
  // The admin About panel stages every edit and commits them together, so the
  // availability flag travels with the rest of the form rather than through
  // PATCH /about/availability. Without a rule the value reaches `$set`
  // unvalidated and Mongoose's Boolean cast decides: a stray string becomes a
  // CastError surfacing as an opaque 400 that says nothing about the field.
  //
  // ⚠️ `.optional()` skips only `undefined`, so `false` IS validated — which is
  // the case that matters. A rule (or a payload builder) treating "absent" and
  // "false" alike would silently refuse to ever mark the owner unavailable.
  body('availableForWork')
    .optional()
    .isBoolean().withMessage('Availability must be true or false'),

  // ── PF-112 — custom social links ─────────────────────────────────────────
  // The Mongoose sub-schema validates each row, so these rules exist for the
  // two things it cannot answer well: that the field is an ARRAY at all (a
  // string or object would be cast into something surprising), and that the
  // wrong TYPE gets a 400 naming the field rather than an opaque CastError.
  //
  // ⚠️ Kept deliberately thin. Duplicating the label and URL rules here would
  // give two places to change when the limit moves, and the model is the one
  // that runs on every write path including a seed.
  body('socialExtra')
    .optional()
    .isArray().withMessage('Custom links must be a list'),

  // ── The About section's stat cards ───────────────────────────────────────
  // Same thin rule as socialExtra above, and for the same two reasons: the
  // sub-schema already validates each row on every write path including the
  // seed, and what it cannot answer well is "is this an ARRAY at all" — a
  // string or a bare object would be cast into something surprising instead of
  // 400ing with the field's name on it.
  body('stats')
    .optional()
    .isArray().withMessage('Stats must be a list'),
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
    // ── PF-111: media fields are NOT client-writable ────────────
    // `$set: req.body` sets whatever arrives. Before PF-111 that meant a
    // profile save carrying `resume: {}` silently wiped the slot — including
    // the publicId — leaving the real file in Cloudinary with nothing left
    // anywhere that could identify it. The exact orphan this ticket exists
    // to prevent, reachable from the ordinary save button.
    //
    // ⚠️ The strip is the FIX, not the validation. Both fields are written
    // ONLY by their own routes, which upload first and derive the publicId
    // from Cloudinary's own response — so the client never names a publicId
    // and therefore can never aim a delete at one.
    const { avatar, resume, ...safe } = req.body ?? {};
    void avatar; void resume;   // named to document intent, deliberately unused

    const about = await About.findOneAndUpdate(
      {},                    // No filter — matches the only document
      { $set: safe },        // $set = only update the provided fields
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
        `Résumé is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ` +
        `${MAX_RESUME_BYTES / 1024 / 1024} MB.`,
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

// ── PUT /api/about/avatar ────────────────────────────────────────────────────
// Protected. Uploads a new portrait and DELETES the previous one.
//
// Deliberately a near-copy of uploadResume rather than a shared helper: the two
// differ in resource type, folder, size limit, accepted formats, the metadata
// they store and the shape they return, which is most of a handler. A helper
// taking six parameters to unify twenty lines would be harder to read than the
// two it replaced, and every one of those parameters is a place a portrait
// could accidentally be destroyed with the résumé's arguments.
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded — send a "file" field', 400));
    }

    const buffer = req.file.buffer;

    // Judge the REQUEST before inspecting server state — the same ordering
    // uploadResume uses, for the same reason: an SVG is wrong whether or not
    // storage happens to be configured, and the operator can act on a 415 but
    // can do nothing about a 503.
    if (!isAllowedImage(buffer)) {
      return next(new AppError(
        `Portrait must be a ${MEDIA_IMAGE_MIME.map(m => m.replace('image/', '').toUpperCase()).join(', ')} image.`,
        415
      ));
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      return next(new AppError(
        `Portrait is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ` +
        `${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        413
      ));
    }

    if (!storage.isConfigured()) {
      return next(new AppError('File storage is not configured on this server', 503));
    }

    let about = await About.findOne();
    if (!about) about = await About.create({});

    // Remember the old file so it can be deleted AFTER the new one lands
    const oldPublicId = about.avatar && about.avatar.publicId;

    // ── 1. Upload the new file first ────────────────────────────
    // resource_type 'image', unlike the résumé's 'raw': these ARE images, and
    // storage.upload only applies Cloudinary's fetch_format/quality auto
    // delivery optimisation on the image path.
    const result = await storage.upload(buffer, {
      resourceType: 'image',
      folder:       AVATAR_FOLDER(),
    });

    // ── 2. Save the new metadata ────────────────────────────────
    about.avatar = {
      url:        result.url,
      publicId:   result.publicId,
      fileName:   req.file.originalname || 'portrait',
      format:     result.format || '',
      bytes:      result.bytes || buffer.length,
      width:      result.width || 0,
      height:     result.height || 0,
      uploadedAt: new Date(),
    };

    await about.save();

    // ── 3. Only NOW delete the old file ─────────────────────────
    // Non-fatal: there is a working portrait either way, so a failure here is
    // logged rather than turned into an error the visitor cannot act on.
    //
    // ⚠️ 'image', NOT 'raw'. A wrong resourceType makes Cloudinary answer
    // { result: 'not found' } — a successful HTTP call that deletes nothing —
    // and the orphan this whole ticket exists to prevent is created silently.
    let oldDeleted = false;
    if (oldPublicId && oldPublicId !== result.publicId) {
      try {
        const del = await storage.destroy(oldPublicId, 'image');
        oldDeleted = del.result === 'ok';

        if (!oldDeleted) {
          console.warn(`[PF-111] Old portrait not deleted (${del.result}): ${oldPublicId}`);
        }
      } catch (e) {
        console.warn(`[PF-111] Failed to delete old portrait ${oldPublicId}:`, e.message);
      }
    }

    res.json({
      status: 'success',
      data: {
        avatar:    about.avatar,
        hasAvatar: true,
        replaced:  Boolean(oldPublicId),
        oldDeleted,
      },
    });

  } catch (err) { next(err); }
};

// ── DELETE /api/about/avatar ─────────────────────────────────────────────────
// Protected. Removes the portrait entirely — the public About section falls
// back to its bundled photograph.
const removeAvatar = async (req, res, next) => {
  try {
    const about = await About.findOne();
    if (!about) return next(new AppError('About document not found', 404));

    if (!about.avatar || !about.avatar.url) {
      return next(new AppError('No portrait to remove', 404));
    }

    const publicId = about.avatar.publicId;

    // Clear the slot first so the site stops pointing at a file that is about
    // to disappear — the same ordering removeResume uses.
    about.avatar = {
      url: '', publicId: '', fileName: '', format: '',
      bytes: 0, width: 0, height: 0, uploadedAt: null,
    };
    await about.save();

    let deleted = false;
    if (publicId) {
      try {
        const del = await storage.destroy(publicId, 'image');
        deleted = del.result === 'ok';
      } catch (e) {
        console.warn(`[PF-111] Failed to delete portrait ${publicId}:`, e.message);
      }
    }

    res.json({ status: 'success', data: { removed: true, deleted, hasAvatar: false } });

  } catch (err) { next(err); }
};

// ── GET /api/resume ──────────────────────────────────────────────────────────
// Public. Sends the current résumé as a download named after the file the
// owner uploaded — `PC Gallage.pdf`, extension included.
//
// Gives one permanent URL that survives every replacement — safe to put in an
// email signature, unlike the Cloudinary URL which changes on each upload.
//
// ⚠️ This PROXIES the bytes; it used to 302 to a Cloudinary `fl_attachment`
// URL, and that download arrived with NO EXTENSION (`PC_Gallage`, typed
// application/octet-stream) so the OS could not tell it was a PDF. Measured
// 2026-10-04, Cloudinary cannot be made to name it correctly on a free account:
//   - the résumé is a `raw` asset with no format, so `fl_attachment` has no
//     extension to append (it does for images, not for raw);
//   - a dot inside the flag is a parse error (400 "Invalid flag … pdf");
//   - storing the public id WITH `.pdf` makes every URL 401 "deny or ACL
//     failure" — the free plan's PDF delivery restriction applies to raw too.
//     The extension-less id is what lets the file be delivered at all.
// A résumé is ≤ 4 MB (MAX_PDF_BYTES), under Vercel's 4.5 MB response cap.
const RESUME_ORIGIN = 'https://res.cloudinary.com/';

// Header-safe download name. The quoted `filename` must be plain ASCII, so it
// gets a sanitised copy; `filename*` (RFC 6266/5987) carries the real name for
// every browser that reads it, which is all current ones.
const resumeDisposition = (fileName) => {
  const stem  = String(fileName || '').replace(/\.pdf$/i, '').trim() || 'resume';
  const real  = `${stem}.pdf`;
  const ascii = real.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  // encodeURIComponent leaves ' ( ) * alone; RFC 5987 does not allow them.
  const encoded = encodeURIComponent(real)
    .replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

const downloadResume = async (req, res, next) => {
  try {
    const about = await About.findOne().select('resume');

    if (!about || !about.resume || !about.resume.url) {
      return next(new AppError('No résumé is currently available', 404));
    }

    // The url is server-written (PUT /api/about strips `resume`), so this is
    // defence in depth: this route never fetches anywhere but Cloudinary.
    if (!about.resume.url.startsWith(RESUME_ORIGIN)) {
      return next(new AppError('Résumé is unavailable', 502));
    }

    let upstream;
    try {
      upstream = await fetch(about.resume.url, { signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      console.warn('[resume] Fetch from storage failed:', e.message);
      return next(new AppError('Résumé is temporarily unavailable', 502));
    }

    if (!upstream.ok) {
      console.warn(`[resume] Storage answered ${upstream.status} for ${about.resume.publicId}`);
      return next(new AppError('Résumé is temporarily unavailable', 502));
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': resumeDisposition(about.resume.fileName),
      'Content-Length':      String(bytes.length),
      // A replaced résumé must not be served from a browser cache.
      'Cache-Control':       'no-cache',
    });
    res.send(bytes);

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
  uploadAvatar,       // PF-111
  removeAvatar,       // PF-111
  isPdf,              // re-exported from utils/fileType for tests — magic-byte
  MAX_RESUME_BYTES,   // checking is the security-critical part and deserves
  MAX_IMAGE_BYTES,    // direct coverage. storage.test.js imports isPdf here.
};
