const mongoose = require('mongoose');
const { body } = require('express-validator');
const AppError = require('../utils/AppError');
const storage  = require('../services/storage');
const { isAllowedImage, isPdf } = require('../utils/fileType');
const { MAX_IMAGE_BYTES } = require('../middleware/upload');

// PF-143 — the controller for a plain ORDERED LIST of owner-written entries:
// Education and Certificates. Both have exactly the same life (draft → publish,
// reorder, one picture), so one factory makes both; each route file passes its
// model and its fields. Projects/Skills keep their own controllers — they carry
// rules (categories, opacity) these lists do not.

const PUBLIC_FILTER = { published: true };
const SORT = { order: 1, createdAt: 1 };

/**
 * Body → `{ data }` or `{ error }`. ⚠️ Only the named fields are copied, each
 * only as its own type — a body is never handed to the database whole (an
 * operator key like `$rename` would run as a command; the media slot is written
 * only by its upload route). Same rule as skillController's `skillPayload`.
 */
const payload = (fields, input) => {
  const data = {};
  for (const [field, type] of Object.entries(fields)) {
    const value = input?.[field];
    if (value === undefined) continue;
    const ok = type === 'string[]'
      ? Array.isArray(value) && value.every((v) => typeof v === 'string')
      : typeof value === type;
    if (!ok) return { error: `${field} must be ${type === 'string[]' ? 'a list of text' : `a ${type}`}` };
    data[field] = value;
  }
  return { data };
};

/** Cloudinary's answer → the stored picture. A PDF is shown as its FIRST PAGE. */
const pictureFrom = (result) => {
  const isPdfUpload = result.format === 'pdf';
  return {
    // Measured 2026-10-30 on the free account: the .pdf itself is refused
    // (401, PDF delivery is off) but page 1 as an image is served (200).
    url: isPdfUpload
      ? result.url.replace('/upload/f_auto,q_auto/', '/upload/pg_1,f_auto,q_auto/').replace(/\.pdf$/i, '.jpg')
      : result.url,
    publicId:   result.publicId,
    format:     result.format || '',
    width:      result.width  || 0,
    height:     result.height || 0,
    bytes:      result.bytes  || 0,
    uploadedAt: new Date(),
  };
};

const destroyQuietly = async (publicId, what) => {
  if (!publicId) return false;
  try {
    const del = await storage.destroy(publicId, 'image');
    if (del.result !== 'ok') console.warn(`[PF-143] ${what} not deleted (${del.result}): ${publicId}`);
    return del.result === 'ok';
  } catch (e) {
    console.warn(`[PF-143] Failed to delete ${what} ${publicId}:`, e.message);
    return false;
  }
};

const reorderRules = [
  body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
  body('ids.*').custom((id) => mongoose.isValidObjectId(id)).withMessage('Invalid id'),
];

/**
 * @param {object} opts
 * @param {import('mongoose').Model} opts.Model
 * @param {string} opts.label        "Certificate" — used in messages
 * @param {object} opts.fields       field → 'string' | 'number' | 'boolean' | 'string[]'
 * @param {string} opts.media        the picture's field name ('image' / 'logo')
 * @param {string} opts.folder       Cloudinary sub-folder
 * @param {boolean} [opts.allowPdf]  a PDF may be the picture (certificates); else images only
 * @param {Function} [opts.isNewer]  (a, b) → true when a belongs ABOVE b; a new entry is then
 *                                   placed by it instead of at the end (education: by date)
 */
const makeEntryController = ({ Model, label, fields, media, folder, allowPdf = false, isNewer }) => {
  const mediaFolder = () => `${process.env.CLOUDINARY_FOLDER || 'portfolio'}/${folder}`;

  const writeError = (err, next) => {
    if (err.name === 'CastError') return next(new AppError(`Invalid ${label.toLowerCase()} ID format`, 400));
    if (err.name === 'ValidationError') {
      return next(new AppError(Object.values(err.errors).map((e) => e.message).join(', '), 400));
    }
    if (err.code === 11000) return next(new AppError(`Another ${label.toLowerCase()} already uses that address`, 409));
    return next(err);
  };

  const find = async (id) => {
    const doc = await Model.findById(id);
    if (!doc) throw new AppError(`${label} not found`, 404);
    return doc;
  };

  const getPublic = async (_req, res, next) => {
    try {
      res.json({ status: 'success', data: await Model.find(PUBLIC_FILTER).sort(SORT) });
    } catch (err) { next(err); }
  };

  const getAdmin = async (_req, res, next) => {
    try {
      res.json({ status: 'success', data: await Model.find().sort(SORT) });
    } catch (err) { next(err); }
  };

  const create = async (req, res, next) => {
    try {
      const { data, error } = payload(fields, req.body);
      if (error) return next(new AppError(error, 400));
      if (data.order === undefined) {
        const list = await Model.find().sort(SORT).select('order start end').lean();
        // Above the first entry it is newer than (when the list has a rule),
        // shifting that one and every one below it down a place; else the END.
        // The order stays the owner's to drag afterwards.
        const below = isNewer ? list.find((e) => isNewer(data, e)) : undefined;
        if (below) {
          data.order = below.order;
          await Model.updateMany({ order: { $gte: below.order } }, { $inc: { order: 1 } });
        } else {
          data.order = (list.at(-1)?.order ?? -1) + 1;
        }
      }
      res.status(201).json({ status: 'success', data: await Model.create(data) });
    } catch (err) { writeError(err, next); }
  };

  const update = async (req, res, next) => {
    try {
      const { data, error } = payload(fields, req.body);
      if (error) return next(new AppError(error, 400));
      const doc = await find(req.params.id);
      doc.set(data);
      await doc.save();
      res.json({ status: 'success', data: doc });
    } catch (err) { writeError(err, next); }
  };

  const remove = async (req, res, next) => {
    try {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return next(new AppError(`${label} not found`, 404));
      // The row first, then its file: a failed delete leaves an orphaned file,
      // never a row pointing at nothing.
      await destroyQuietly(doc[media]?.publicId, `${label} picture`);
      res.status(204).end();
    } catch (err) { writeError(err, next); }
  };

  /** Body `{ ids }` — EVERY entry, in the new order; written as 0..n-1 in one bulkWrite. */
  const reorder = async (req, res, next) => {
    try {
      const ids = req.body.ids.map(String);
      // Exactly the stored set: as many ids as entries (no extra, unknown id),
      // and every entry among them — together that also rules out a repeat.
      const total = await Model.countDocuments();
      const found = await Model.countDocuments({ _id: { $in: ids } });
      if (ids.length !== total || found !== total) {
        return next(new AppError(`Send every ${label.toLowerCase()} exactly once`, 400));
      }

      await Model.bulkWrite(ids.map((_id, order) => ({ updateOne: { filter: { _id }, update: { $set: { order } } } })));
      res.json({ status: 'success', data: await Model.find().sort(SORT) });
    } catch (err) { writeError(err, next); }
  };

  const uploadPicture = async (req, res, next) => {
    try {
      if (!req.file) return next(new AppError('No file uploaded — send a "file" field', 400));
      const buffer = req.file.buffer;

      // The magic bytes decide, never the file name or its claimed type.
      if (!isAllowedImage(buffer) && !(allowPdf && isPdf(buffer))) {
        return next(new AppError(`The file must be a PNG, JPEG or WebP picture${allowPdf ? ', or a PDF' : ''}.`, 415));
      }
      if (buffer.length > MAX_IMAGE_BYTES) {
        return next(new AppError(
          `The file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
          413,
        ));
      }
      if (!storage.isConfigured()) return next(new AppError('File storage is not configured on this server', 503));

      const doc = await find(req.params.id);
      const oldPublicId = doc[media]?.publicId;

      // ⚠️ 'image' for a PDF too: Cloudinary renders an image-type PDF's pages.
      const result = await storage.upload(buffer, { resourceType: 'image', folder: mediaFolder() });
      doc[media] = pictureFrom(result);
      await doc.save();

      const oldDeleted = oldPublicId && oldPublicId !== result.publicId
        ? await destroyQuietly(oldPublicId, `old ${label.toLowerCase()} picture`)
        : false;

      res.json({ status: 'success', data: { entry: doc, replaced: Boolean(oldPublicId), oldDeleted } });
    } catch (err) { writeError(err, next); }
  };

  const removePicture = async (req, res, next) => {
    try {
      const doc = await find(req.params.id);
      const publicId = doc[media]?.publicId;
      if (!doc[media]?.url) return next(new AppError('No picture to remove', 404));

      doc[media] = { url: '', publicId: '', format: '', width: 0, height: 0, bytes: 0, uploadedAt: null };
      await doc.save();
      const deleted = await destroyQuietly(publicId, `${label} picture`);

      res.json({ status: 'success', data: { entry: doc, removed: true, deleted } });
    } catch (err) { writeError(err, next); }
  };

  return { getPublic, getAdmin, create, update, remove, reorder, uploadPicture, removePicture };
};

module.exports = { makeEntryController, reorderRules, payload, pictureFrom };
