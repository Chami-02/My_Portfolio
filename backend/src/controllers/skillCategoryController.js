const { body } = require('express-validator');
const mongoose      = require('mongoose');
const SkillCategory = require('../models/SkillCategory');
const Skill         = require('../models/Skill');
const AppError      = require('../utils/AppError');

/**
 * The six sections the site shipped with — the old `Skill.category` enum, so
 * every stored skill points at one of them already. `other` had no box before
 * PF-114; it now gets one as soon as it holds a skill.
 */
const DEFAULT_CATEGORIES = Object.freeze([
  { key: 'language', label: 'Languages', order: 1 },
  { key: 'frontend', label: 'Frontend',  order: 2 },
  { key: 'backend',  label: 'Backend',   order: 3 },
  { key: 'database', label: 'Database',  order: 4 },
  { key: 'devops',   label: 'DevOps',    order: 5 },
  { key: 'other',    label: 'Other',     order: 6 },
]);

/**
 * Create the defaults the first time the collection is found EMPTY.
 *
 * ⚠️ Lazy, not migration-only — the `getAbout()` pattern. A database that
 * never ran a migration (a fresh E2E or CI database, a preview deploy) would
 * otherwise have skills pointing at sections that do not exist and a Skills
 * section that renders nothing. `deleteCategory` refuses to remove the LAST
 * section, so "empty" only ever means "never set up", and this can never
 * resurrect sections the owner deleted.
 *
 * `ordered: false` + swallowing 11000: two first requests racing each insert
 * the same keys, and the loser's duplicates are exactly the rows that exist.
 */
const ensureDefaults = async () => {
  if (await SkillCategory.exists({})) return;
  try {
    await SkillCategory.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c })), { ordered: false });
  } catch (err) {
    if (err.code !== 11000 && !err.writeErrors?.every((e) => e.code === 11000)) throw err;
  }
};

/** "Soft Skills" → "soft-skills"; collisions get "-2", "-3"… */
const slugify = (label) =>
  label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';

const uniqueKey = async (label) => {
  const base = slugify(label);
  let key = base;
  for (let n = 2; await SkillCategory.exists({ key }); n += 1) key = `${base}-${n}`;
  return key;
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Names are unique CASE-INSENSITIVELY. "Tools" beside "tools" would be two
 * boxes the owner cannot tell apart in the dropdown.
 */
const labelTaken = async (label, exceptId = null) => {
  const filter = { label: new RegExp(`^${escape(label)}$`, 'i') };
  if (exceptId) filter._id = { $ne: exceptId };
  return SkillCategory.exists(filter);
};

const labelRule = body('label')
  .isString().withMessage('Section name is required')
  .trim()
  .notEmpty().withMessage('Section name is required')
  .isLength({ max: 40 }).withMessage('Section name cannot exceed 40 characters');

const createRules = [labelRule];
const renameRules = [labelRule];
const reorderRules = [
  body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
  body('ids.*').custom((id) => mongoose.isValidObjectId(id)).withMessage('Invalid section ID'),
];

const sorted = () => SkillCategory.find().sort({ order: 1, createdAt: 1 });

// ── GET /api/skill-categories ────────────────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    await ensureDefaults();
    res.json({ status: 'success', data: await sorted() });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/skill-categories ───────────────────────────────────────────────
// A new section goes LAST. It is invisible on the home page until it holds a
// skill, so creating one publishes nothing.
const createCategory = async (req, res, next) => {
  try {
    await ensureDefaults();
    const { label } = req.body;
    if (await labelTaken(label)) {
      return next(new AppError(`A section named "${label}" already exists`, 409));
    }
    const last = await SkillCategory.findOne().sort({ order: -1 }).select('order').lean();
    const category = await SkillCategory.create({
      key: await uniqueKey(label),
      label,
      order: (last?.order ?? 0) + 1,
    });
    res.status(201).json({ status: 'success', data: category });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/skill-categories/:id ────────────────────────────────────────────
// Rename only. ⚠️ `key` is never touched — see the model.
const renameCategory = async (req, res, next) => {
  try {
    const { label } = req.body;
    if (await labelTaken(label, req.params.id)) {
      return next(new AppError(`A section named "${label}" already exists`, 409));
    }
    const category = await SkillCategory.findByIdAndUpdate(
      req.params.id, { label }, { returnDocument: 'after', runValidators: true },
    );
    if (!category) return next(new AppError('Section not found', 404));
    res.json({ status: 'success', data: category });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid section ID', 400));
    next(err);
  }
};

// ── PUT /api/skill-categories/reorder ────────────────────────────────────────
// EVERY section, in the new order — a partial list could interleave with the
// sections left out, the same reasoning as skills' reorder.
const reorderCategories = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (new Set(ids).size !== ids.length) {
      return next(new AppError('ids must not repeat a section', 400));
    }
    const total = await SkillCategory.countDocuments();
    const found = await SkillCategory.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length || total !== ids.length) {
      return next(new AppError('Send every section, in the new order', 400));
    }
    await SkillCategory.bulkWrite(ids.map((id, i) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: i + 1 } } },
    })));
    res.json({ status: 'success', data: await sorted() });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/skill-categories/:id ─────────────────────────────────────────
// Owner, 2026-10-05 — three outcomes, chosen in the admin's dialog:
//   {}                     an EMPTY section is deleted; a non-empty one is
//                          refused (409) so nothing is lost by accident
//   { moveTo: <id> }       its skills move to the END of that section, then
//                          the section goes
//   { deleteSkills: true } the section AND its skills go
//
// ⚠️ Skills first, the section LAST: a failure part-way then leaves skills
// still pointing at a section that exists, never at one that does not.
const deleteCategory = async (req, res, next) => {
  try {
    const category = await SkillCategory.findById(req.params.id);
    if (!category) return next(new AppError('Section not found', 404));

    if (await SkillCategory.countDocuments() <= 1) {
      return next(new AppError('Keep at least one section — every skill needs one', 400));
    }

    const { moveTo, deleteSkills } = req.body || {};
    const skills = await Skill.find({ category: category.key }).sort({ order: 1 }).select('_id').lean();

    if (skills.length > 0) {
      if (moveTo) {
        if (!mongoose.isValidObjectId(moveTo) || String(moveTo) === String(category._id)) {
          return next(new AppError('Choose another section to move the skills to', 400));
        }
        const target = await SkillCategory.findById(moveTo);
        if (!target) return next(new AppError('The section to move the skills to was not found', 400));

        // To the END of the target, keeping their relative order.
        const last = await Skill.findOne().sort({ order: -1 }).select('order').lean();
        const start = (last?.order ?? 0) + 1;
        await Skill.bulkWrite(skills.map((s, i) => ({
          updateOne: {
            filter: { _id: s._id },
            update: { $set: { category: target.key, order: start + i } },
          },
        })));
      } else if (deleteSkills === true) {
        await Skill.deleteMany({ category: category.key });
      } else {
        const n = skills.length;
        return next(new AppError(
          `"${category.label}" still has ${n} skill${n === 1 ? '' : 's'} — move or delete ${n === 1 ? 'it' : 'them'} first`,
          409,
        ));
      }
    }

    await category.deleteOne();
    res.json({ status: 'success', data: { moved: moveTo ? skills.length : 0, deleted: deleteSkills === true ? skills.length : 0 } });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid section ID', 400));
    next(err);
  }
};

module.exports = {
  DEFAULT_CATEGORIES, ensureDefaults, slugify,
  getCategories, createCategory, renameCategory, reorderCategories, deleteCategory,
  createRules, renameRules, reorderRules,
};
