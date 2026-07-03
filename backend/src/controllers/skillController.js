const Skill    = require('../models/Skill');
const AppError = require('../utils/AppError');

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
    const skill = await Skill.create(req.body);
    res.status(201).json({ status: 'success', data: skill });
  } catch (err) {
    // Duplicate skill name (unique: true on schema)
    if (err.code === 11000) {
      return next(
        new AppError(
          `A skill named "${req.body.name}" already exists`,
          409
        )
      );
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── PUT /api/skills/:id ──────────────────────────────────────────────────────
// Protected — JWT required (PF-35)
const updateSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!skill) return next(new AppError('Skill not found', 404));

    res.json({ status: 'success', data: skill });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid skill ID', 400));
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

module.exports = { getAllSkills, createSkill, updateSkill, deleteSkill };