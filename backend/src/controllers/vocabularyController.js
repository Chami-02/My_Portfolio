const mongoose   = require('mongoose');
const Vocabulary = require('../models/Vocabulary');
const Project    = require('../models/Project');
const Blog       = require('../models/Blog');
const AppError   = require('../utils/AppError');

// Which collection and field each vocabulary type maps onto
const TARGETS = {
  tech: { model: Project, field: 'tech', label: 'projects'   },
  tag:  { model: Blog,    field: 'tags', label: 'blog posts' },
};

// Guard used by every handler — rejects anything that isn't tag/tech
const resolveType = (type, next) => {
  const target = TARGETS[type];
  if (!target) {
    next(new AppError(`Invalid vocabulary type "${type}" — use "tag" or "tech"`, 400));
    return null;
  }
  return target;
};

// ── GET /api/vocabulary/:type ────────────────────────────────────────────────
// Public. Loads the chip list for the picker.
const getVocabulary = async (req, res, next) => {
  try {
    if (!resolveType(req.params.type, next)) return;

    const items = await Vocabulary
      .find({ type: req.params.type })
      .sort({ order: 1, value: 1 });

    res.json({ status: 'success', data: items });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/vocabulary/:type/:id/impact ─────────────────────────────────────
// Protected. Tells the confirm modal how much damage a delete would do.
const getDeleteImpact = async (req, res, next) => {
  try {
    const target = resolveType(req.params.type, next);
    if (!target) return;

    const item = await Vocabulary.findById(req.params.id);
    if (!item) return next(new AppError('No vocabulary item found with that ID', 404));

    const affected = await target.model.countDocuments({
      [target.field]: item.value,
    });

    res.json({
      status: 'success',
      data: {
        value:    item.value,
        type:     item.type,
        affected,
        label:    target.label,   // 'projects' or 'blog posts' — for the modal text
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError('Invalid vocabulary ID format', 400));
    }
    next(err);
  }
};

// ── POST /api/vocabulary/:type ───────────────────────────────────────────────
// Protected. Adds a chip to the pool permanently.
const createVocabulary = async (req, res, next) => {
  try {
    if (!resolveType(req.params.type, next)) return;

    const value = String(req.body.value || '').trim();
    if (!value) return next(new AppError('Value is required', 400));

    const item = await Vocabulary.create({ type: req.params.type, value });
    res.status(201).json({ status: 'success', data: item });

  } catch (err) {
    // 11000 = duplicate key — the compound unique index fired
    if (err.code === 11000) {
      return next(new AppError(`"${req.body.value}" already exists in this vocabulary`, 409));
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(e => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── DELETE /api/vocabulary/:type/:id ─────────────────────────────────────────
// Protected. OPTION B: removes the chip AND strips it from all content.
const deleteVocabulary = async (req, res, next) => {
  let session = null;

  try {
    const target = resolveType(req.params.type, next);
    if (!target) return;

    const item = await Vocabulary.findById(req.params.id);
    if (!item) return next(new AppError('No vocabulary item found with that ID', 404));

    const { model, field } = target;

    // Try a transaction first. Falls back gracefully on standalone MongoDB.
    let usedTransaction = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      usedTransaction = true;
    } catch {
      session = null;   // standalone server — no transaction support
    }

    const opts = session ? { session } : {};

    // $pull removes every matching element from the array, across all docs
    const strip = await model.updateMany(
      { [field]: item.value },
      { $pull: { [field]: item.value } },
      opts
    );

    await Vocabulary.deleteOne({ _id: item._id }, opts);

    if (session) {
      await session.commitTransaction();
      session.endSession();
      session = null;
    }

    res.json({
      status: 'success',
      data: {
        deleted:       item.value,
        strippedFrom:  strip.modifiedCount,
        label:         target.label,
        transactional: usedTransaction,
      },
    });

  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    if (err.name === 'CastError') {
      return next(new AppError('Invalid vocabulary ID format', 400));
    }
    next(err);
  }
};

module.exports = {
  getVocabulary,
  getDeleteImpact,
  createVocabulary,
  deleteVocabulary,
};