const Project  = require('../models/Project');
const AppError = require('../utils/AppError');
const storage  = require('../services/storage');

// PF-111 — see utils/fileType.js. Same magic-byte gate as the About portrait.
const { isAllowedImage, MEDIA_IMAGE_MIME } = require('../utils/fileType');
const { MAX_IMAGE_BYTES } = require('../middleware/upload');

const BACKGROUND_FOLDER = () => `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/projects`;

/**
 * Strip the media half of `backgroundImage` out of a client payload and flatten
 * what remains onto DOT PATHS (PF-111).
 *
 * ⚠️ TWO SEPARATE BUGS ARE FIXED HERE, and they are easy to conflate.
 *
 * 1. `src` and `publicId` are removed because they are written only by
 *    PUT /api/projects/:id/background, which derives the publicId from
 *    Cloudinary's own upload response. A client that could send a publicId
 *    could aim a delete at any file in the bucket.
 *
 * 2. `opacity` is rewritten as the dot path `backgroundImage.opacity`, because
 *    Mongoose turns a nested OBJECT in an update into `$set` of the WHOLE
 *    sub-document. `{ backgroundImage: { opacity: 0.5 } }` therefore replaces
 *    the sub-document and wipes `src` and `publicId` — the image vanishes from
 *    the card and its file is orphaned, from an ordinary save. This has no
 *    symptom today only because nothing sends opacity yet; PF-113's slider
 *    would have hit it on its very first save.
 */
const sanitiseProjectBody = (body) => {
  const { backgroundImage, ...rest } = body ?? {};
  const update = { ...rest };

  if (backgroundImage && typeof backgroundImage === 'object' &&
      !Array.isArray(backgroundImage) &&
      backgroundImage.opacity !== undefined) {
    update['backgroundImage.opacity'] = backgroundImage.opacity;
  }

  return update;
};

// ── GET /api/projects ────────────────────────────────────────────────────────
// Returns all projects, sorted by order ASC then newest first
const getAllProjects = async (req, res, next) => {
  try {
    const projects = await Project.find().sort({ order: 1, createdAt: -1 });
    res.json({ status: 'success', data: projects });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/projects/:id ────────────────────────────────────────────────────
const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    res.json({ status: 'success', data: project });
  } catch (err) {
    // Mongoose throws CastError when the ID format is invalid (not a valid ObjectId)
    if (err.name === 'CastError') {
      return next(new AppError('Invalid project ID format', 400));
    }
    next(err);
  }
};

// ── POST /api/projects ───────────────────────────────────────────────────────
// Protected route — JWT required (added in PF-35)
const createProject = async (req, res, next) => {
  try {
    // Same strip as updateProject, for the same reason — but flattened dot
    // paths are meaningless to create(), so rebuild the nested shape. A new
    // project has no old file to orphan; what this prevents is a client
    // planting a publicId the delete path would later act on.
    const safe = sanitiseProjectBody(req.body);
    if (safe['backgroundImage.opacity'] !== undefined) {
      safe.backgroundImage = { opacity: safe['backgroundImage.opacity'] };
      delete safe['backgroundImage.opacity'];
    }

    const project = await Project.create(safe);
    res.status(201).json({ status: 'success', data: project });
  } catch (err) {
    if (err.name === 'ValidationError') {
      // Collect all field-level validation messages into one string
      const message = Object.values(err.errors)
        .map((e) => e.message)
        .join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── PUT /api/projects/:id ────────────────────────────────────────────────────
// Protected route — JWT required (added in PF-35)
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: sanitiseProjectBody(req.body) },
      {
        returnDocument: 'after',  // Return the updated document (not the old one)
        runValidators:  true,  // Re-run schema validators on the updated fields
      }
    );

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    res.json({ status: 'success', data: project });
  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError('Invalid project ID format', 400));
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── DELETE /api/projects/:id ─────────────────────────────────────────────────
// Protected route — JWT required (added in PF-35)
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    // ── PF-111: the background image goes with the project ──────
    // Owner requirement, 2026-09-23: a file is permanently deleted when it is
    // replaced AND when the record owning it is deleted. Without this, every
    // deleted project left its background in Cloudinary with nothing anywhere
    // still naming its publicId — unreachable and undeletable forever.
    //
    // ⚠️ The ROW IS DELETED FIRST, deliberately. A Cloudinary outage must not
    // be able to block a delete, and the failure it would cause is the
    // recoverable direction: an orphaned file that is logged, rather than a
    // project the admin cannot remove. Non-fatal for the same reason the
    // résumé path is.
    const publicId = project.backgroundImage && project.backgroundImage.publicId;
    if (publicId) {
      try {
        const del = await storage.destroy(publicId, 'image');
        if (del.result !== 'ok') {
          console.warn(`[PF-111] Background not deleted (${del.result}): ${publicId}`);
        }
      } catch (e) {
        console.warn(`[PF-111] Failed to delete background ${publicId}:`, e.message);
      }
    }

    // 204 No Content — successful deletion sends no body
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError('Invalid project ID format', 400));
    }
    next(err);
  }
};

// ── PUT /api/projects/:id/background ─────────────────────────────────────────
// Protected. Uploads a new card background and DELETES the previous one.
// The About portrait's twin — see uploadAvatar for why these are not merged.
const uploadBackground = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded — send a "file" field', 400));
    }

    const buffer = req.file.buffer;

    // Request first, server state second — a 415 is actionable, a 503 is not.
    if (!isAllowedImage(buffer)) {
      return next(new AppError(
        `Background must be a ${MEDIA_IMAGE_MIME.map(m => m.replace('image/', '').toUpperCase()).join(', ')} image.`,
        415
      ));
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      return next(new AppError(
        `Background is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ` +
        `${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        413
      ));
    }

    if (!storage.isConfigured()) {
      return next(new AppError('File storage is not configured on this server', 503));
    }

    // findById + save(), never findByIdAndUpdate: the update helpers run no
    // pre('save') hook, and the upload → save → destroy ordering below only
    // holds if this handler owns the whole sequence.
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));

    const oldPublicId = project.backgroundImage && project.backgroundImage.publicId;

    // 1. Upload the new file first
    const result = await storage.upload(buffer, {
      resourceType: 'image',
      folder:       BACKGROUND_FOLDER(),
    });

    // 2. Save the new metadata — opacity is content and is left untouched, so
    //    replacing the image does not reset a value the admin already tuned.
    project.backgroundImage.src      = result.url;
    project.backgroundImage.publicId = result.publicId;
    await project.save();

    // 3. Only NOW delete the old file. Non-fatal; 'image', not 'raw'.
    let oldDeleted = false;
    if (oldPublicId && oldPublicId !== result.publicId) {
      try {
        const del = await storage.destroy(oldPublicId, 'image');
        oldDeleted = del.result === 'ok';

        if (!oldDeleted) {
          console.warn(`[PF-111] Old background not deleted (${del.result}): ${oldPublicId}`);
        }
      } catch (e) {
        console.warn(`[PF-111] Failed to delete old background ${oldPublicId}:`, e.message);
      }
    }

    res.json({
      status: 'success',
      data: {
        project,
        replaced: Boolean(oldPublicId),
        oldDeleted,
      },
    });

  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError('Invalid project ID format', 400));
    }
    next(err);
  }
};

// ── DELETE /api/projects/:id/background ──────────────────────────────────────
// Protected. Clears the background and deletes the file. The project itself,
// and its opacity setting, survive.
const removeBackground = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));

    if (!project.backgroundImage || !project.backgroundImage.src) {
      return next(new AppError('No background image to remove', 404));
    }

    const publicId = project.backgroundImage.publicId;

    // Clear first, delete second — the card must stop pointing at a file that
    // is about to disappear.
    project.backgroundImage.src      = '';
    project.backgroundImage.publicId = '';
    await project.save();

    let deleted = false;
    if (publicId) {
      try {
        const del = await storage.destroy(publicId, 'image');
        deleted = del.result === 'ok';
      } catch (e) {
        console.warn(`[PF-111] Failed to delete background ${publicId}:`, e.message);
      }
    }

    res.json({ status: 'success', data: { project, removed: true, deleted } });

  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError('Invalid project ID format', 400));
    }
    next(err);
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  uploadBackground,   // PF-111
  removeBackground,   // PF-111
  sanitiseProjectBody, // exported for tests — the strip is a security boundary
};
