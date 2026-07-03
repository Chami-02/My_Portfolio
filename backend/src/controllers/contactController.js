const { body }   = require('express-validator');
const Contact    = require('../models/Contact');
const AppError   = require('../utils/AppError');

// ── Validation rules array ────────────────────────────────────────────────────
// These run BEFORE the controller function.
// The validate middleware (PF-17) checks results and returns 400 on failure.
const contactRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10 }).withMessage('Message must be at least 10 characters long')
    .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
];

// ── POST /api/contact ────────────────────────────────────────────────────────
// Public — anyone can submit
const submitContact = async (req, res, next) => {
  try {
    await Contact.create({
      name:    req.body.name,
      email:   req.body.email,
      message: req.body.message,
    });

    // Don't send the saved document back — just a friendly message
    res.status(201).json({
      status:  'success',
      message: "Message received — I'll get back to you within 24 hours.",
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/contact ─────────────────────────────────────────────────────────
// Protected — admin only (JWT protect added in PF-35)
const getAllMessages = async (req, res, next) => {
  try {
    // Newest messages first, unread first
    const messages = await Contact.find().sort({ read: 1, createdAt: -1 });
    res.json({ status: 'success', data: messages });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/contact/:id/read ──────────────────────────────────────────────
// Protected — mark a message as read in admin panel
const markAsRead = async (req, res, next) => {
  try {
    const message = await Contact.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!message) return next(new AppError('Message not found', 404));
    res.json({ status: 'success', data: message });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/contact/:id ──────────────────────────────────────────────────
// Protected — admin can delete messages
const deleteMessage = async (req, res, next) => {
  try {
    const message = await Contact.findByIdAndDelete(req.params.id);
    if (!message) return next(new AppError('Message not found', 404));
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { contactRules, submitContact, getAllMessages, markAsRead, deleteMessage };