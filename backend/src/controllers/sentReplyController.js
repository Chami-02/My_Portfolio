const { body }  = require('express-validator');
const SentReply = require('../models/SentReply');
const AppError  = require('../utils/AppError');

// PF-154 (owner, 2026-11-07) — the SENT list in the Messages panel. Rows are
// written by contactController.replyToMessage, only after the email went; here
// they are only read and deleted. Deleting removes the panel's copy: the email
// the visitor received cannot be taken back, and the panel says so.

// ── GET /api/contact/sent ────────────────────────────────────────────────────
// Protected. Every reply, newest first — the whole list, like GET /api/contact:
// the panel searches what it holds (utils/messageSearch.js says why).
const getSentReplies = async (req, res, next) => {
  try {
    const replies = await SentReply.find().sort({ sentAt: -1, _id: -1 }).select('-__v').lean();
    res.json({ status: 'success', data: replies });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/contact/sent/:id ─────────────────────────────────────────────
// Protected.
const deleteSentReply = async (req, res, next) => {
  try {
    const reply = await SentReply.findByIdAndDelete(req.params.id);
    if (!reply) return next(new AppError("We couldn't find that sent reply. It may have been deleted already.", 404));
    res.status(204).end();
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError("We couldn't find that sent reply.", 400));
    next(err);
  }
};

// ── POST /api/contact/sent/bulk ──────────────────────────────────────────────
// Protected. Several ticked replies deleted at once — the messages bulk route's
// rules: 200 at most, and the client sends a longer list in batches.
const MAX_BULK_IDS = 200;

const sentBulkRules = [
  body('ids').isArray({ min: 1, max: MAX_BULK_IDS }).withMessage(`Choose between 1 and ${MAX_BULK_IDS} replies`),
  // isString first: isMongoId would pass a one-item array inside the list.
  body('ids.*').isString().bail().isMongoId().withMessage('Unknown reply'),
];

const deleteSentReplies = async (req, res, next) => {
  try {
    // One already gone (another device) is not a failure: the goal is met.
    const { deletedCount } = await SentReply.deleteMany({ _id: { $in: req.body.ids } });
    res.json({ status: 'success', data: { count: deletedCount } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSentReplies, deleteSentReply, sentBulkRules, deleteSentReplies };
