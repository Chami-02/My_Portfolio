#!/usr/bin/env node
// backend/src/migrations/009-admin-accounts.js
//
// Give the admin account its two real addresses (PF-119, owner 2026-10-12).
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// The site has ONE admin. Until now it signed in with whatever address the
// database was seeded with — the old demo address on most environments. The
// owner's rule: the admin signs in as `pcgallege@gmail.com` (primary, shown
// in the panel) OR `parindrachameekara@gmail.com`, by password or by Google,
// and nothing else. Google sign-in matches the VERIFIED address Google returns
// against exactly these fields and never creates an account — so on a
// database this has not run against, every Google sign-in is refused.
//
// ── ⚠️ APPLY IT. NEVER BASELINE IT. ─────────────────────────────────────────
// `migrate:baseline` records a file as applied WITHOUT running it. Baselined,
// production keeps its old address while the code expects these two, and
// Google sign-in refuses the owner with a generic "not allowed" — the only
// trace is the server's `has migration 009 run?` warning. After applying,
// `npm run migrate:status` must show 009 WITH A DATE, not `[baselined]`.
//
// ── WHAT IT DOES ────────────────────────────────────────────────────────────
// Exactly one User → set `email` and `loginEmails` to the owner's pair,
// whatever the address was before. The password is untouched, so the owner
// signs in with the same password under the new addresses.
//
//   0 Users    nothing to do (a fresh database — `npm run seed` writes the
//              pair itself)
//   1 User     set the pair; a second run reports it already correct
//   2+ Users   REFUSES and exits non-zero. The User collection is the admin
//              allowlist (no route reads `role`), so a second account is
//              either a mistake or an intruder — a human decides which,
//              not a migration.
//
// Raw driver throughout (migration 007's rule): it must not depend on the
// model's current shape.
//
// Usage:
//   node src/migrations/009-admin-accounts.js --dry-run
//   node src/migrations/009-admin-accounts.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

// Read inside run(), never at module scope — 007's lesson.
const isDryRun = () => process.argv.includes('--dry-run');

const PRIMARY_EMAIL = 'pcgallege@gmail.com';
const LOGIN_EMAILS  = ['parindrachameekara@gmail.com'];

const isCorrect = (user) =>
  user.email === PRIMARY_EMAIL &&
  Array.isArray(user.loginEmails) &&
  user.loginEmails.length === LOGIN_EMAILS.length &&
  LOGIN_EMAILS.every((e, i) => user.loginEmails[i] === e);

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
    const users = await mongoose.connection.collection('users')
      .find({}, { projection: { email: 1, loginEmails: 1 } })
      .toArray();

    console.log('\nUsers');
    if (users.length === 0) {
      console.log('  (no User — nothing to do)');
    } else if (users.length > 1) {
      throw new Error(
        `Refusing: ${users.length} User documents exist, and this site has ONE admin. ` +
        'Every account is a full administrator, so decide by hand which one is ' +
        'the owner before running this again.'
      );
    } else {
      const [user] = users;
      if (isCorrect(user)) {
        console.log(`  ✅ OK       ${user._id}  (already ${PRIMARY_EMAIL} + ${LOGIN_EMAILS.join(', ')})`);
      } else {
        console.log(
          `  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${user._id}\n` +
          `       sign-in addresses → ${PRIMARY_EMAIL} (primary), ${LOGIN_EMAILS.join(', ')}`
        );
        if (!DRY_RUN) {
          await mongoose.connection.collection('users').updateOne(
            { _id: user._id },
            { $set: { email: PRIMARY_EMAIL, loginEmails: [...LOGIN_EMAILS], updatedAt: new Date() } }
          );
        }
      }
    }

    console.log('\n' + '─'.repeat(56));
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

module.exports = { run, PRIMARY_EMAIL, LOGIN_EMAILS, isCorrect };
