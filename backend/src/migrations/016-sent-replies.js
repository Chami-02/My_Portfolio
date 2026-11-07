#!/usr/bin/env node
// backend/src/migrations/016-sent-replies.js
//
// PF-154 — the owner's replies get their own SENT record (owner, 2026-11-07).
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// PF-153 kept each reply inside the message it answered (`contacts.replies`), so
// deleting a message deleted what the owner had sent. From PF-154 every reply is
// a row in `sentreplies`, which outlives the message. This copies the replies
// already sent into it, so SENT starts complete.
//
// EXPAND only: the old `replies` arrays are left where they are, and nothing
// reads them any more. Removing them is the CONTRACT step, a release later.
//
// ⚠️ Idempotent by its key: a reply is the message it answered + the moment it
// was sent. One already copied (an earlier run, or the new code sending it) is
// skipped, so a rerun adds nothing.
//
// Raw driver throughout (migration 007's rule).
//
// Usage:
//   node src/migrations/016-sent-replies.js --dry-run
//   node src/migrations/016-sent-replies.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

// The subject contactController sends every reply with.
const SUBJECT = 'Re: Your message to Parindra Gallage';

// Read inside run(), not at module scope — see 007 for the trap.
const isDryRun = () => process.argv.includes('--dry-run');

const keyOf = (contactId, sentAt) => `${contactId}|${new Date(sentAt).toISOString()}`;

async function run() {
  const DRY_RUN = isDryRun();
  const targetDb = databaseNameFrom(process.env.MONGO_URI);

  console.log('');
  console.log(`Target database: ${targetDb ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN — writes nothing' : 'LIVE — will write'}`);
  if (!DRY_RUN && targetDb === 'portfolio_prod') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(56));

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const contacts = mongoose.connection.collection('contacts');
    const sent = mongoose.connection.collection('sentreplies');

    const withReplies = await contacts
      .find({ 'replies.0': { $exists: true } },
        { projection: { name: 1, email: 1, message: 1, createdAt: 1, replies: 1 } })
      .toArray();
    const have = new Set((await sent.find({}, { projection: { contact: 1, sentAt: 1 } }).toArray())
      .map((r) => keyOf(r.contact, r.sentAt)));

    const rows = [];
    let skipped = 0;
    for (const c of withReplies) {
      for (const r of c.replies) {
        if (!r || typeof r.message !== 'string' || !(r.sentAt instanceof Date)) { skipped += 1; continue; }
        const key = keyOf(c._id, r.sentAt);
        if (have.has(key)) { skipped += 1; continue; }
        have.add(key);
        rows.push({
          contact:  c._id,
          toName:   c.name,
          toEmail:  c.email,
          subject:  SUBJECT,
          message:  r.message,
          original: { message: c.message, receivedAt: c.createdAt || c._id.getTimestamp() },
          sentAt:   r.sentAt,
        });
        console.log(`  ${DRY_RUN ? '🔎 WOULD COPY' : '✏️  COPY      '}  reply to ${c._id} (${c.name}) sent ${r.sentAt.toISOString()}`);
      }
    }
    if (rows.length === 0) console.log('  (nothing to copy)');

    console.log('\n' + '─'.repeat(56));
    console.log(`Replies copied: ${rows.length}   already there or unreadable: ${skipped}`);

    if (!DRY_RUN && rows.length > 0) await sent.insertMany(rows);
    if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { run };
