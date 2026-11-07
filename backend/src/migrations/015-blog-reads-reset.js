#!/usr/bin/env node
// backend/src/migrations/015-blog-reads-reset.js
//
// PF-153 — every post's read count starts again from 0 (owner, 2026-11-07).
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Until PF-153 a read counted the owner's own opens, bots and anyone who left at
// once, and it had no date. From PF-153 a read is 6 seconds on the post, and each
// one also writes a dated `read` row, so `Blog.views` and those rows must start
// together for the public box and the private panel to agree.
//
// ⚠️ Idempotent by a guard, because a rerun would otherwise wipe REAL reads. The
// first real read writes a `read` row, so any such row means this has had its
// turn: it changes nothing and says so.
//
// Raw driver throughout (migration 007's rule). `updatedAt` is not touched: a
// reset is not an edit, and would reorder the admin list.
//
// Usage:
//   node src/migrations/015-blog-reads-reset.js --dry-run
//   node src/migrations/015-blog-reads-reset.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

// Read inside run(), not at module scope — see 007 for the trap.
const isDryRun = () => process.argv.includes('--dry-run');

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
    const blogs = mongoose.connection.collection('blogs');
    const totals = mongoose.connection.collection('visittotals');

    if (await totals.findOne({ dim: 'read' })) {
      console.log('\nReal reads have been counted already: nothing to reset.\n');
      return;
    }

    const docs = await blogs
      .find({ views: { $gt: 0 } }, { projection: { title: 1, views: 1 } })
      .toArray();

    console.log('\nBlog');
    for (const doc of docs) {
      console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  RESET '}  ${doc._id}  "${doc.title}"  ${doc.views} → 0`);
    }
    if (docs.length === 0) console.log('  (no post has any reads)');

    console.log('\n' + '─'.repeat(56));
    console.log(`Posts reset: ${docs.length}`);

    if (!DRY_RUN && docs.length > 0) {
      await blogs.updateMany({ _id: { $in: docs.map((doc) => doc._id) } }, { $set: { views: 0 } });
    }
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
