const { body }   = require('express-validator');
const { waitUntil } = require('@vercel/functions');
const Contact    = require('../models/Contact');
const About      = require('../models/About');
const AppError   = require('../utils/AppError');
const mailer     = require('../services/mailer');
const { requestLocation } = require('../utils/requestLocation');
const { escapeHtml }      = require('../utils/escapeHtml');

// ── Validation rules array ────────────────────────────────────────────────────
// These run BEFORE the controller function.
// The validate middleware (PF-17) checks results and returns 400 on failure.
//
// ⚠️ PF-120 — `isString().bail()` FIRST on every field (the aboutController
// pattern). This route is PUBLIC, and without it an array (`name: ['a','b']`)
// passed `trim`/`isLength` and reached Mongoose as a CastError: a 500 and an
// UNEXPECTED ERROR log. An object passed too, and was STORED as
// "[object Object]". Both measured before the fix.
const contactRules = [
  body('name')
    .isString().withMessage('Name must be text').bail()
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('email')
    .isString().withMessage('Email must be text').bail()
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('message')
    .isString().withMessage('Message must be text').bail()
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10 }).withMessage('Message must be at least 10 characters long')
    .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
];

// ── The owner's email copy (PF-123) ─────────────────────────────────────────
// A NOTIFICATION, not the record: the message is already saved when this
// runs. It never throws — a failed send leaves `notifiedAt` null and a log
// line, and the visitor's 201 has already gone.

// The owner's zone is the About panel's `timezone` — the field that already
// drives Contact and the footer (PF-118: one field, every render site). Blank
// there means "hide it on the site", not "no zone", so the email falls back
// to the model's default.
const DEFAULT_ZONE = 'Asia/Colombo';

/** `{ date: '2026/10/20', time: '11:18 PM' }` in `timeZone` — owner's format
 *  (YYYY/MM/DD; 12-hour clock, owner 2026-10-20). */
// ⚠️ Mirrored by frontend/src/utils/messageTime.js (the Messages panel shows
// the same instant) — change both together.
const formatSent = (when, timeZone) => {
  const part = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hourCycle: 'h12',
  }).formatToParts(when).forEach(({ type, value }) => { part[type] = value; });
  return {
    date: `${part.year}/${part.month}/${part.day}`,
    time: `${part.hour}:${part.minute} ${part.dayPeriod.toUpperCase()}`,
  };
};

const SAVED_NOTE = 'This message is saved in the Messages section of the admin panel.';
const REPLY_NOTE = 'Please reply within 24 hours!!';

const notifyOwner = async (contact) => {
  if (!mailer.isConfigured()) {
    console.warn(`[PF-123] Mail is not configured — message ${contact._id} saved, not emailed`);
    return;
  }
  try {
    const about = await About.findOne().select('timezone').lean();
    const zone  = about?.timezone || DEFAULT_ZONE;
    const { date, time } = formatSent(contact.createdAt, zone);
    const e = escapeHtml;

    await mailer.send({
      to:      mailer.address(),
      replyTo: contact.email,   // Reply in Gmail answers the visitor
      // Collapse line breaks: a name must never be able to start a new header.
      subject: `New portfolio message from ${contact.name.replace(/\s+/g, ' ')}`,
      // Plain text for any client that shows no HTML — same content, no colour.
      text: [
        `Name:  ${contact.name}`,
        `Email: ${contact.email}`,
        `Date:  ${date}`,
        `Time:  ${time} (${zone})`,
        ...(contact.location ? [`From:  ${contact.location} (approx.)`] : []),
        '',
        contact.message,
        '',
        '─'.repeat(48),
        SAVED_NOTE,
        REPLY_NOTE,
      ].join('\n'),
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">
<p style="margin:0 0 16px"><b>Name:</b> ${e(contact.name)}<br><b>Email:</b> ${e(contact.email)}<br><b>Date:</b> ${date}<br><b>Time:</b> ${time} (${e(zone)})${contact.location ? `<br><b>From:</b> ${e(contact.location)} (approx.)` : ''}</p>
<p style="margin:0;white-space:pre-wrap">${e(contact.message)}</p>
<hr style="border:none;border-top:1px solid #9a9a9a;margin:28px 0 16px">
<p style="margin:0 0 6px">${SAVED_NOTE}</p>
<p style="margin:0;color:#d32f2f;font-weight:bold">${REPLY_NOTE}</p>
</div>`,
    });
    await Contact.updateOne({ _id: contact._id }, { notifiedAt: new Date() });
  } catch (err) {
    // code + message only: the error object carries the transport (PF-123).
    console.error(`[PF-123] Contact email failed for ${contact._id}: ${err.code || ''} ${err.message}`);
  }
};

// ── POST /api/contact ────────────────────────────────────────────────────────
// Public — anyone can submit
const submitContact = async (req, res, next) => {
  try {
    const contact = await Contact.create({
      name:    req.body.name,
      email:   req.body.email,
      message: req.body.message,
      location: requestLocation(req),
    });

    // In the background: the visitor never waits for Gmail, and Vercel keeps
    // the function alive until the send settles. Off Vercel it just runs.
    waitUntil(notifyOwner(contact));

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
// Protected — mark a message read, or unread with `{ read: false }`. An
// EXPLICIT value like the star (never a flip); no body still means read, so a
// client sending nothing keeps its old meaning.
const readRules = [
  body('read').optional().isBoolean({ strict: true }).withMessage('read must be true or false'),
];

const markAsRead = async (req, res, next) => {
  try {
    const message = await Contact.findByIdAndUpdate(
      req.params.id,
      // A real boolean in the CODE, not only in readRules: `!== false` is
      // true for `true` and for an absent field (the old client's meaning).
      { read: req.body?.read !== false },
      { returnDocument: 'after' }
    );
    if (!message) return next(new AppError('Message not found', 404));
    res.json({ status: 'success', data: message });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/contact/:id/star ──────────────────────────────────────────────
// Protected — PF-115. Sets the star to an EXPLICIT value rather than flipping
// it, so a double-click or a retried request can never land on the opposite of
// what the owner pressed. A toggle is only correct if every request arrives
// exactly once.
const starRules = [
  body('starred').isBoolean({ strict: true }).withMessage('starred must be true or false'),
];

const setStarred = async (req, res, next) => {
  try {
    const message = await Contact.findByIdAndUpdate(
      req.params.id,
      // starRules already demands a strict boolean; `=== true` makes the
      // value a boolean here too, so nothing else can reach the update.
      { starred: req.body.starred === true },
      { returnDocument: 'after' }
    );
    if (!message) return next(new AppError('Message not found', 404));
    res.json({ status: 'success', data: message });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid message ID', 400));
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

module.exports = {
  contactRules, submitContact, getAllMessages, markAsRead, deleteMessage,
  starRules, setStarred,
  readRules,
  formatSent,   // exported for its fixed-date test only
};
