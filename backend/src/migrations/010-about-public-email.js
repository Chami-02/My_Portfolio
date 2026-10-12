#!/usr/bin/env node
// backend/src/migrations/010-about-public-email.js
//
// The public contact address becomes `pcgallege@gmail.com` (PF-119, which
// absorbed PF-122 — owner, 2026-10-12).
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Contact, About and the footer render `About.email` from the database. The
// code change moves the seed and schema default, but an existing database
// keeps the address it was given — and the owner's personal inbox is too busy
// for a portfolio enquiry to be noticed in. This moves the stored value.
//
// ── ⚠️ IT ONLY REPLACES THE OLD PERSONAL ADDRESS ────────────────────────────
// `About.email` is editable in the admin panel. A value the owner typed there
// is LEFT ALONE and reported as SKIP — a migration overwriting a deliberate
// panel edit is the silent kind of wrong (the log would read UPDATE, which is
// also what a correct run says).
//
// Raw driver throughout (migration 007's rule).
//
// Usage:
//   node src/migrations/010-about-public-email.js --dry-run
//   node src/migrations/010-about-public-email.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

const isDryRun = () => process.argv.includes('--dry-run');

const OLD_EMAIL = 'parindrachameekara@gmail.com';
const NEW_EMAIL = 'pcgallege@gmail.com';

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
    const abouts = mongoose.connection.collection('abouts');
    const docs = await abouts.find({}, { projection: { email: 1 } }).toArray();

    let updated = 0;
    let already = 0;
    let skipped = 0;

    console.log('\nAbout');
    for (const doc of docs) {
      const current = typeof doc.email === 'string' ? doc.email.trim().toLowerCase() : '';
      if (current === NEW_EMAIL) {
        console.log(`  ✅ OK       ${doc._id}  (already ${NEW_EMAIL})`);
        already += 1;
      } else if (current === OLD_EMAIL) {
        console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${doc._id}  → ${NEW_EMAIL}`);
        if (!DRY_RUN) await abouts.updateOne({ _id: doc._id }, { $set: { email: NEW_EMAIL } });
        updated += 1;
      } else {
        // A third outcome, never folded into OK: the operator must SEE that a
        // panel-edited value was deliberately not touched.
        console.log(`  ⏭️  SKIP     ${doc._id}  (email was set in the panel — leaving it alone)`);
        skipped += 1;
      }
    }
    if (docs.length === 0) console.log('  (no About document)');

    console.log('\n' + '─'.repeat(56));
    console.log(
      `Documents: ${docs.length}   Updated: ${updated}   ` +
      `Already correct: ${already}   Skipped: ${skipped}`
    );
    if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration crashed:', err);
    process.exit(1);
  });
}

module.exports = { run, OLD_EMAIL, NEW_EMAIL };
