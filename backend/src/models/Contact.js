const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    message: {
      type:      String,
      required:  [true, 'Message is required'],
      trim:      true,
      minlength: [10, 'Message must be at least 10 characters'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    read: {
      type:    Boolean,
      default: false,     // Shows as unread in admin panel
    },
    // PF-115 (owner, 2026-10-07): a message the owner has marked to come back
    // to. Admin-only — `submitContact` copies name/email/message by name, so a
    // visitor cannot star their own message. No migration: a row without the
    // field reads as unstarred (`!m.starred`), as `read` does for unread.
    starred: {
      type:    Boolean,
      default: false,
    },
    // PF-123: when the owner's email copy went out. `null` = it did not (mail
    // off, or the send failed) — the message itself is saved either way; the
    // email is a notification, the Messages panel is the record. No
    // migration: older rows read as null, which is true — they were never
    // emailed.
    notifiedAt: {
      type:    Date,
      default: null,
    },
    // PF-123: the sender's APPROXIMATE location ("New York, NY, United
    // States"), from Vercel's IP headers (utils/requestLocation.js). Null off
    // Vercel, for older rows, and when Vercel had nothing. Admin-only:
    // submitContact sets it from the request, never from the body.
    location: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);