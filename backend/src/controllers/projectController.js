const Project  = require('../models/Project');
const AppError = require('../utils/AppError');

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
      return next(new AppError('No project found with that ID', 404));
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
    const project = await Project.create(req.body);
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
      req.body,
      {
        new:            true,  // Return the updated document (not the old one)
        runValidators:  true,  // Re-run schema validators on the updated fields
      }
    );

    if (!project) {
      return next(new AppError('No project found with that ID', 404));
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
      return next(new AppError('No project found with that ID', 404));
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

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};