const mongoose = require('mongoose');

// PF-154 (owner, 2026-11-07) — the SENT record: one row per reply the owner sent
// from the Messages panel, written only after the email service accepted it.
//
// Its own collection, like a mail client's Sent folder: deleting a message from
// the inbox leaves what the owner sent to it. So the row keeps everything needed
// to read it on its own — who it went to, the subject, the words, and a COPY of
// the message it answered. `contact` still names that message, which may be gone.
//
// Written once and never edited; the owner can delete it (`DELETE /sent/:id`).
// No timestamps: `sentAt` is the one moment that matters.
const sentReplySchema = new mongoose.Schema(
  {
    contact: {
      type:     mongoose.Schema.Types.ObjectId,
      required: [true, 'A sent reply must name the message it answered'],
    },
    toName: {
      type:      String,
      required:  [true, 'A sent reply needs the name it went to'],
      trim:      true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    toEmail: {
      type:      String,
      required:  [true, 'A sent reply needs the address it went to'],
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    subject: {
      type:      String,
      required:  [true, 'A sent reply needs its subject'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    message: {
      type:      String,
      required:  [true, 'A sent reply needs its words'],
      maxlength: [3000, 'Reply cannot exceed 3000 characters'],
    },
    original: {
      _id: false,
      message:    { type: String, required: [true, 'A sent reply keeps the message it answered'], maxlength: 1000 },
      receivedAt: { type: Date,   required: [true, 'A sent reply keeps when that message arrived'] },
    },
    sentAt: {
      type:     Date,
      required: [true, 'A sent reply needs the time it was sent'],
    },
  },
  { timestamps: false }
);

sentReplySchema.index({ sentAt: -1 });
sentReplySchema.index({ contact: 1, sentAt: 1 });

module.exports = mongoose.model('SentReply', sentReplySchema);
