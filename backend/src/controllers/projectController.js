const Project  = require('../models/Project');
const AppError = require('../utils/AppError');
const { moveTotals } = require('../services/visitTotals');
const storage  = require('../services/storage');
const { buildProjectMatch } = require('../utils/projectQuery');

// PF-111 — see utils/fileType.js. Same magic-byte gate as the About portrait.
const { isAllowedImage, MEDIA_IMAGE_MIME } = require('../utils/fileType');
const { MAX_IMAGE_BYTES } = require('../middleware/upload');

const BACKGROUND_FOLDER = () => `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/projects`;

/**
 * Strip what a client may never write out of a project payload (PF-111).
 *
 * `backgroundImage` (`src`, `publicId`) is written only by
 * PUT /api/projects/:id/background, which derives the publicId from
 * Cloudinary's own upload response. A client that could send a publicId could
 * aim a delete at any file in the bucket.
 *
 * PF-138: `opacity`, its one client-writable part, is gone (migration 014), so
 * the WHOLE sub-document is stripped. Until then this function rewrote opacity
 * onto the dot path `backgroundImage.opacity`, because Mongoose turns a nested
 * OBJECT into `$set` of the whole sub-document and would have wiped `src` and
 * `publicId` from an ordinary save.
 */
const sanitiseProjectBody = (body) => {
  // PF-144: `slug` is DERIVED by the model (from the title, frozen once
  // published), never written by a client.
  // PF-144: `media` (the picture ledger) is written only by the upload route.
  const { backgroundImage, slug, media, ...rest } = body ?? {};
  // ⚠️ PF-120 — and every DOTTED path into them. `set()` treats
  // `"backgroundImage.publicId"` as that nested path, so stripping only the
  // top-level key let a raw request set the publicId (and `src`) anyway —
  // measured.
  return Object.fromEntries(
    Object.entries(rest).filter(([key]) => !key.startsWith('backgroundImage.') && !key.startsWith('media.'))
  );
};

/**
 * What the PUBLIC site may see (PF-113).
 *
 * ⚠️ `$ne: false`, NOT `published: true`. Every project created before PF-113
 * has no `published` field at all, and `published: true` would hide the whole
 * portfolio until a migration ran. `$ne: false` reads a missing field as
 * published — the same shape as the dashboard's `read: { $ne: true }`.
 */
const PUBLIC_FILTER = { published: { $ne: false } };

// PF-144 — the `media` ledger is the server's own bookkeeping; a visitor
// never needs it (each picture already carries its address).
const PUBLIC_FIELDS = '-media';

// ── PF-144 — pictures inside a project's sections ──────────────────────────

/** The ledger's ceiling: every section full, plus headroom for unsaved picks. */
const MAX_MEDIA = 60;

/**
 * Give every section picture its address FROM THE LEDGER (models/Project.js
 * `media`). The form sends only `{ publicId, caption }`; anything else it sends
 * about a picture is overwritten. A publicId this project never uploaded is
 * refused with a 400 — the client cannot make the site show (or a later
 * clean-up delete) a file that is not this project's.
 */
const attachSectionImages = (project) => {
  const ledger = new Map((project.media || []).map((m) => [m.publicId, m]));
  for (const section of project.sections || []) {
    for (const image of section.images || []) {
      const entry = ledger.get(image.publicId);
      if (!entry) throw new AppError("That picture couldn't be found. Please upload it again.", 400);
      image.url    = entry.url;
      image.width  = entry.width;
      image.height = entry.height;
    }
  }
};

/** publicIds the sections show right now. */
const usedPictures = (project) =>
  new Set((project.sections || []).flatMap((s) => (s.images || []).map((i) => i.publicId)));

/**
 * After a successful save: destroy every ledger file no section uses any more
 * (a picture removed in the editor, or picked and never saved), and drop it
 * from the ledger. Non-fatal, like every other clean-up (PF-111): the record is
 * already right; a failed destroy only leaves a logged orphan.
 */
const sweepUnusedPictures = async (project) => {
  const used = usedPictures(project);
  const unused = (project.media || []).filter((m) => !used.has(m.publicId));
  if (unused.length === 0) return;

  const gone = unused.map((m) => m.publicId);
  await Project.updateOne({ _id: project._id }, { $pull: { media: { publicId: { $in: gone } } } });
  project.media = project.media.filter((m) => used.has(m.publicId));

  for (const publicId of gone) {
    try {
      const del = await storage.destroy(publicId, 'image');
      if (del.result !== 'ok') console.warn(`[PF-144] Section picture not deleted (${del.result}): ${publicId}`);
    } catch (e) {
      console.warn(`[PF-144] Failed to delete section picture ${publicId}:`, e.message);
    }
  }
};

const SORT = { order: 1, createdAt: -1 };

// ── GET /api/projects ────────────────────────────────────────────────────────
// Returns every PUBLISHED project, sorted by order ASC then newest first.
// Drafts are the admin's alone — see getAllProjectsAdmin.
// PF-144: `?q=`, `?tech=` and `?category=` narrow it (utils/projectQuery.js).
const getAllProjects = async (req, res, next) => {
  try {
    const { q, tech, category } = req.query;
    const projects = await Project
      .find(buildProjectMatch({ base: PUBLIC_FILTER, q, tech, category }))
      .select(PUBLIC_FIELDS)
      .sort(SORT);
    res.json({ status: 'success', data: projects });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/projects/:slug ──────────────────────────────────────────────────
// PF-144 — one PUBLISHED project, for its page. A draft is a 404, not a 403
// ("exists but hidden" is information). Blog's getPostBySlug shape:
// `{ project, prev, next, index, total }`, the neighbours walking the SAME
// ordered public list the home section and /projects show, wrapping round,
// and null when there is nowhere else to go.
const getProjectBySlug = async (req, res, next) => {
  try {
    const project = await Project.findOne({ ...PUBLIC_FILTER, slug: String(req.params.slug) }).select(PUBLIC_FIELDS);
    if (!project) return next(new AppError('Project not found', 404));

    const ordered = await Project.find(PUBLIC_FILTER, { slug: 1, title: 1 }).sort(SORT).lean();
    const total = ordered.length;
    const index = ordered.findIndex((p) => p.slug === project.slug);

    const neighbour = (offset) => {
      if (total < 2 || index === -1) return null;
      const { slug, title } = ordered[(index + offset + total) % total];
      return { slug, title };
    };

    res.json({
      status: 'success',
      data: { project, prev: neighbour(-1), next: neighbour(1), index, total },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/projects/admin/all ──────────────────────────────────────────────
// Protected. Every project, drafts included — the admin panel's list (PF-113).
const getAllProjectsAdmin = async (req, res, next) => {
  try {
    const projects = await Project.find().sort(SORT);
    res.json({ status: 'success', data: projects });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/projects ───────────────────────────────────────────────────────
// Protected route — JWT required (added in PF-35)
const createProject = async (req, res, next) => {
  try {
    // Same strip as updateProject, for the same reason. A new project has no
    // old file to orphan; what this prevents is a client planting a publicId
    // the delete path would later act on.
    const safe = sanitiseProjectBody(req.body);

    // PF-144: a NEW project has no ledger yet, so it cannot name a picture —
    // the panel creates it first, then uploads, then saves the sections.
    const project = new Project(safe);
    attachSectionImages(project);
    await project.save();
    res.status(201).json({ status: 'success', data: project });
  } catch (err) {
    if (err instanceof AppError) return next(err);
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
//
// ⚠️ PF-113: findById + set + save(), NOT findByIdAndUpdate. The draft rule
// makes description / tech / githubUrl required only while `published !==
// false`, and that condition reads `this`. Update validators run with `this`
// as the QUERY, so `this.published` is undefined and every draft edit would be
// validated as if published — or, worse, publishing an incomplete draft would
// slip through when only `published` is sent. A document save evaluates the
// condition against the merged document, which is the only correct answer.
//
// sanitiseProjectBody()'s output is reused unchanged — it never holds any
// part of `backgroundImage` (pinned by project.background.routes.test.js).
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    const oldSlug = project.slug;
    project.set(sanitiseProjectBody(req.body));
    attachSectionImages(project);   // PF-144
    await project.save();
    await sweepUnusedPictures(project);
    await moveTotals(`/projects/${oldSlug}`, `/projects/${project.slug}`);

    res.json({ status: 'success', data: project });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'CastError') {
      return next(new AppError("We couldn't find that project.", 400));
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
    // PF-144: and every section picture in its ledger, the same way.
    const files = [
      project.backgroundImage && project.backgroundImage.publicId,
      ...(project.media || []).map((m) => m.publicId),
    ].filter(Boolean);
    for (const publicId of files) {
      try {
        const del = await storage.destroy(publicId, 'image');
        if (del.result !== 'ok') {
          console.warn(`[PF-111] File not deleted (${del.result}): ${publicId}`);
        }
      } catch (e) {
        console.warn(`[PF-111] Failed to delete ${publicId}:`, e.message);
      }
    }

    // 204 No Content — successful deletion sends no body
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError("We couldn't find that project.", 400));
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
      return next(new AppError('Please choose a file to upload.', 400));
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
      return next(new AppError("Uploads aren't working right now. Please try again later.", 503));
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

    // 2. Save the new metadata.
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
      return next(new AppError("We couldn't find that project.", 400));
    }
    next(err);
  }
};

// ── POST /api/projects/:id/images ────────────────────────────────────────────
// PF-144 — upload ONE section picture into the project's ledger. It is not
// shown anywhere until a save names it in a section (staged, owner rule), and
// a save that does not use it destroys it. Same gates, same order, as the
// cover picture: a file, then its bytes, then its size, then storage.
const uploadSectionImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please choose a file to upload.', 400));
    }
    const buffer = req.file.buffer;

    if (!isAllowedImage(buffer)) {
      return next(new AppError(
        `A picture must be a ${MEDIA_IMAGE_MIME.map(m => m.replace('image/', '').toUpperCase()).join(', ')} image.`,
        415
      ));
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      return next(new AppError(
        `This picture is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ` +
        `${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        413
      ));
    }
    if (!storage.isConfigured()) {
      return next(new AppError("Uploads aren't working right now. Please try again later.", 503));
    }

    // Exists AND has room — checked before the upload so a refused request
    // never leaves a file behind.
    const project = await Project.findById(req.params.id, { media: 1 });
    if (!project) return next(new AppError('Project not found', 404));
    if ((project.media || []).length >= MAX_MEDIA) {
      return next(new AppError('Too many unsaved pictures. Please save the project, then add more.', 409));
    }

    const result = await storage.upload(buffer, { resourceType: 'image', folder: BACKGROUND_FOLDER() });
    const entry = {
      publicId: result.publicId, url: result.url,
      width: result.width || 0, height: result.height || 0, uploadedAt: new Date(),
    };

    // ATOMIC push with the ceiling in the filter, so two quick uploads cannot
    // both slip past it. No full-document validation: only the ledger moves.
    const pushed = await Project.updateOne(
      { _id: project._id, [`media.${MAX_MEDIA - 1}`]: { $exists: false } },
      { $push: { media: entry } },
    );
    if (pushed.modifiedCount !== 1) {
      await storage.destroy(result.publicId, 'image').catch(() => {});
      return next(new AppError('Too many unsaved pictures. Please save the project, then add more.', 409));
    }

    res.status(201).json({ status: 'success', data: entry });
  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError("We couldn't find that project.", 400));
    }
    next(err);
  }
};

// ── DELETE /api/projects/:id/background ──────────────────────────────────────
// Protected. Clears the background and deletes the file. The project itself
// survives.
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
      return next(new AppError("We couldn't find that project.", 400));
    }
    next(err);
  }
};

module.exports = {
  getAllProjects,
  getProjectBySlug,    // PF-144
  getAllProjectsAdmin, // PF-113
  createProject,
  updateProject,
  deleteProject,
  uploadBackground,   // PF-111
  uploadSectionImage, // PF-144
  removeBackground,   // PF-111
  sanitiseProjectBody, // exported for tests — the strip is a security boundary
};
