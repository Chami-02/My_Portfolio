#!/usr/bin/env node
// backend/src/migrations/014-project-opacity-removal.js
//
// PF-138 — the CONTRACT half of PF-144: `backgroundImage.opacity` leaves the data.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Until PF-144 a project's picture sat BEHIND the card's text at an opacity
// (0.1–1, default 0.75). PF-144 moved the picture on top of the card, and
// nothing has read the value since; PF-138 removed the schema path. This
// removes what is left in the database, so a field no code knows about cannot
// come back through a backup or a probe.
//
// Nothing to refuse (unlike 011): an opacity is never the only copy of
// anything — `src` and `publicId` beside it are left exactly as they are.
//
// Raw driver throughout (migration 007's rule) — the model no longer has the
// path, and `.save()` cannot remove a field; `$unset` can.
//
// Idempotent: a second run finds no opacity anywhere and reports OK.
//
// Usage:
//   node src/migrations/014-project-opacity-removal.js --dry-run
//   node src/migrations/014-project-opacity-removal.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

// Read inside run(), not at module scope — see 007 for the trap.
const isDryRun = () => process.argv.includes('--dry-run');

/** True when the stored project still carries the removed field. */
const hasOpacity = (doc) =>
  Boolean(doc.backgroundImage) && typeof doc.backgroundImage === 'object' &&
  Object.prototype.hasOwnProperty.call(doc.backgroundImage, 'opacity');

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
    const projects = mongoose.connection.collection('projects');
    const docs = await projects
      .find({}, { projection: { title: 1, backgroundImage: 1 } })
      .toArray();

    const toUnset = [];
    console.log('\nProject');
    for (const doc of docs) {
      if (hasOpacity(doc)) {
        console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UNSET '}  ${doc._id}  "${doc.title}"  backgroundImage.opacity → unset`);
        toUnset.push(doc._id);
      } else {
        console.log(`  ✅ OK       ${doc._id}  "${doc.title}"`);
      }
    }
    if (docs.length === 0) console.log('  (no projects)');

    console.log('\n' + '─'.repeat(56));
    console.log(
      `Projects: ${docs.length}   Unset: ${toUnset.length}   ` +
      `Already clean: ${docs.length - toUnset.length}`
    );

    if (!DRY_RUN && toUnset.length > 0) {
      await projects.updateMany(
        { _id: { $in: toUnset } },
        { $unset: { 'backgroundImage.opacity': '' } },
      );
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

module.exports = { run, hasOpacity };
