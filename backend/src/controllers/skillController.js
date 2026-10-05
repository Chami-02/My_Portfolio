const { body } = require('express-validator');
const mongoose = require('mongoose');
const Skill    = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const { ensureDefaults } = require('./skillCategoryController');
const AppError = require('../utils/AppError');

// ── PF-114: where a skill lands ─────────────────────────────────────────────
// The public section groups by category, then sorts by `order` WITHIN a card.
// The seed numbers all 26 skills 1–26 across every card, so a new skill that
// took the schema's `default: 0` sorted BEFORE every seeded one and appeared
// at the FRONT of its card. One past the global maximum is last in every card
// at once, and keeps `order` unique across the collection — which is what lets
// `reorderSkills` below reuse a card's own values without touching any other.
const nextOrder = async () => {
  const last = await Skill.findOne().sort({ order: -1 }).select('order').lean();
  return (last?.order ?? 0) + 1;
};

// The two write errors a skill can hit, mapped the same way on create AND
// update. ⚠️ Before PF-114 only create mapped them: a rename to an existing
// name reached errorHandler as a raw Mongo 11000, which is not an AppError, so
// production answered 500 "Something went wrong" to a plain duplicate.
const writeError = (err, name) => {
  if (err.code === 11000) {
    return new AppError(`A skill named "${name}" already exists`, 409);
  }
  if (err.name === 'ValidationError') {
    return new AppError(Object.values(err.errors).map((e) => e.message).join(', '), 400);
  }
  if (err.name === 'CastError') return new AppError('Invalid skill ID', 400);
  return err;
};

// PF-114 — `category` must name a section that exists. The enum used to do
// this; the list is the owner's now, so the check reads the collection.
const unknownSection = async (key) => {
  if (key === undefined) return false;
  await ensureDefaults();
  return !(await SkillCategory.exists({ key }));
};

// ── GET /api/skills ──────────────────────────────────────────────────────────
const getAllSkills = async (req, res, next) => {
  try {
    const skills = await Skill.find().sort({ order: 1, category: 1 });
    res.json({ status: 'success', data: skills });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/skills ─────────────────────────────────────────────────────────
// Protected — JWT required (PF-35)
const createSkill = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.category !== undefined && await unknownSection(data.category)) {
      return next(new AppError('Choose a section that exists', 400));
    }
    if (typeof data.order !== 'number') data.order = await nextOrder();
    const skill = await Skill.create(data);
    res.status(201).json({ status: 'success', data: skill });
  } catch (err) {
    next(writeError(err, req.body.name));
  }
};

// ── PUT /api/skills/:id ──────────────────────────────────────────────────────
// Protected — JWT required (PF-35)
//
// ⚠️ findByIdAndUpdate is safe HERE because the Skill schema has no hooks — the
// "update runs no pre('save')" trap (Silent failures) has nothing to skip.
const updateSkill = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (await unknownSection(data.category)) {
      return next(new AppError('Choose a section that exists', 400));
    }

    // A skill moved to another card goes to the END of that card, by the same
    // rule as a new one — otherwise it keeps its old slot number and lands
    // wherever that number happens to fall among its new neighbours.
    if (data.category !== undefined && typeof data.order !== 'number') {
      const current = await Skill.findById(req.params.id).select('category').lean();
      if (current && current.category !== data.category) data.order = await nextOrder();
    }

    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      data,
      { returnDocument: 'after', runValidators: true }
    );

    if (!skill) return next(new AppError('Skill not found', 404));

    res.json({ status: 'success', data: skill });
  } catch (err) {
    next(writeError(err, req.body.name));
  }
};

// ── PUT /api/skills/reorder ──────────────────────────────────────────────────
// Protected — JWT required. PF-114.
//
// Body `{ ids: [...] }` — EVERY skill of ONE category, in the new order.
//
// The card's own `order` values are collected, sorted, and handed back out in
// the new sequence. ⚠️ Reusing the card's values rather than writing 1..n is
// what keeps every OTHER card untouched: `order` is unique across the whole
// collection (see nextOrder), so 1..n would collide with another card's slots.
//
// One request and one bulkWrite, rather than a PUT per moved skill: two
// sequential PUTs can half-apply a swap and leave two skills tied.
const reorderRules = [
  body('ids')
    .isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
  body('ids.*')
    .custom((id) => mongoose.isValidObjectId(id)).withMessage('Invalid skill ID'),
];

const reorderSkills = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (new Set(ids).size !== ids.length) {
      return next(new AppError('ids must not repeat a skill', 400));
    }

    const skills = await Skill.find({ _id: { $in: ids } }).select('category order').lean();
    if (skills.length !== ids.length) {
      return next(new AppError('One or more skills were not found', 400));
    }

    const categories = new Set(skills.map((s) => s.category));
    if (categories.size !== 1) {
      return next(new AppError('Skills can only be reordered within one category', 400));
    }

    // ⚠️ The WHOLE card, not a subset. Reordering two of five would hand those
    // two each other's slots and could interleave them with the three left
    // out — the result would depend on values the client never saw.
    const [category] = categories;
    const cardSize = await Skill.countDocuments({ category });
    if (cardSize !== ids.length) {
      return next(new AppError('Send every skill in the category, in the new order', 400));
    }

    const slots = skills.map((s) => s.order).sort((a, b) => a - b);
    await Skill.bulkWrite(ids.map((id, i) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: slots[i] } } },
    })));

    const updated = await Skill.find().sort({ order: 1, category: 1 });
    res.json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/skills/:id ───────────────────────────────────────────────────
// Protected — JWT required (PF-35)
const deleteSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findByIdAndDelete(req.params.id);

    if (!skill) return next(new AppError('Skill not found', 404));

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid skill ID', 400));
    next(err);
  }
};

module.exports = {
  getAllSkills, createSkill, updateSkill, reorderSkills, reorderRules, deleteSkill,
};
