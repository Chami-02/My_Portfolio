const { body } = require('express-validator');
const About    = require('../models/About');
const AppError = require('../utils/AppError');

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

module.exports = { aboutRules, getAbout, updateAbout, toggleAvailability };
