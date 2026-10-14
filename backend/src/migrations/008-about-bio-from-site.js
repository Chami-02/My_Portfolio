#!/usr/bin/env node
// backend/src/migrations/008-about-bio-from-site.js
//
// Move the About section's bio from the CODE into the DATABASE.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// `AboutSection.jsx` rendered two HARDCODED paragraphs, so editing the bio in
// the admin panel saved correctly and changed nothing on the public page. The
// component now reads `About.bio` — but the stored bio is the SEED's text,
// which is a different pair of paragraphs from the ones the site has actually
// been showing. Wiring the component without this script would silently swap
// the page's copy on the day it deployed.
//
// So this writes the paragraphs that were on screen into the document. Nothing
// visible changes; from here on, editing the panel does change the page.
//
// ── ⚠️ IT ONLY OVERWRITES THE SEED'S OWN TEXT ───────────────────────────────
// A document whose bio has already been edited is LEFT ALONE. The guard is an
// exact match against SEED_BIO below, not a length or emptiness check: the
// owner may legitimately have typed something that is two paragraphs long, and
// "looks like the default" is not the same question as "is the default".
//
// That makes the script idempotent in both directions — a second run finds the
// site text (not the seed text) and reports it already correct.
//
// ── ⚠️ `.save()`, NOT `findOneAndUpdate` ────────────────────────────────────
// `findOneAndUpdate` / `findByIdAndUpdate` run NO `pre('save')` hook. About has
// none today, so this would work either way — which is exactly why it is worth
// writing down: the next person to add a derived field to this model should
// not have to discover that a migration quietly bypassed it. The document reads
// back perfectly in Compass in both cases, so there is no tell.
//
// ── ⚠️ AND NEVER `validateSync()` ───────────────────────────────────────────
// It runs no middleware and returns `undefined` for a valid document exactly as
// it does for a successful validation, which is what made migration 006's dry
// run print `Already correct: 4` — byte for byte the output a correct run
// produces. `await doc.validate()` is the call if one is ever needed.
//
// ⚠️ A DRY RUN THAT FINDS NOTHING LOOKS EXACTLY LIKE A CLEAN DATABASE. Before
// trusting `Already correct`, plant the dirty state and check this script SEES
// it:
//
//   node -e "require('dotenv').config();const m=require('mongoose');
//     const {SEED_BIO}=require('./src/migrations/008-about-bio-from-site');
//     m.connect(process.env.MONGO_URI).then(async()=>{
//       await m.connection.collection('abouts').updateOne({},{\$set:{bio:SEED_BIO}});
//       await m.disconnect();})"
//
// then re-run with --dry-run. A working script reports 1 About to migrate; a
// broken one still reports `Already correct`.
//
// Usage:
//   node src/migrations/008-about-bio-from-site.js --dry-run
//   node src/migrations/008-about-bio-from-site.js

require('dotenv').config();
const mongoose = require('mongoose');
const About = require('../models/About');
const { databaseNameFrom } = require('../config/db');

// ⚠️ READ INSIDE run(), NOT AT MODULE SCOPE — migration 007's note, and its
// test caught this for real: a module-level const binds the flag to whatever
// argv held when the file was first require()d, so a programmatic caller
// passing --dry-run gets a LIVE run.
const isDryRun = () => process.argv.includes('--dry-run');

/**
 * What `seed.js` and `models/About.js` have been putting in the database.
 *
 * ⚠️ BOTH variants, because they are not the same text. The schema default is
 * the shorter pair; `seed.js` writes the longer pair. A document created by
 * `getAbout()`'s `About.create({})` carries the first; a seeded one carries the
 * second. Matching only one would leave half the environments unmigrated, and
 * the symptom — "it works on my machine and not on the server" — points nowhere
 * near this file.
 */
const SEED_BIO = [
  "I'm a Computer Science undergraduate at the University of Westminster, building production-grade software one real project at a time. I enjoy turning ideas into real-world software using modern technologies and engineering best practices.",
  "I've contributed to projects ranging from full-stack web applications to REST APIs and enterprise-style systems such as ClearDrive.lk. My experience includes Python, FastAPI, JavaScript, React, Next.js, PostgreSQL, Docker, GitHub Actions, and Agile development using Jira.",
];

const SCHEMA_DEFAULT_BIO = [
  "I'm a Computer Science undergraduate at the University of Westminster, building production-grade software one real project at a time.",
  "This portfolio is not a template — it's a live MERN application tracked in Jira, containerized with Docker, and deployed through a CI/CD pipeline.",
];

/**
 * The paragraphs the public About section has actually been rendering.
 *
 * ⚠️ These must stay character-for-character identical to `BIO_FALLBACK` in
 * `frontend/src/components/sections/AboutSection.jsx`. They are the same two
 * sentences in two packages, which cannot import from each other; the fallback
 * is what a failed fetch shows and this is what a successful one shows, so a
 * drift between them appears only when the API is down.
 */
const SITE_BIO = [
  "I'm a Computer Science undergraduate at the University of Westminster, "
  + 'passionate about building scalable web applications and continuously '
  + 'improving my backend and full-stack development skills. I enjoy turning '
  + 'ideas into real-world software using modern technologies and engineering '
  + 'best practices.',

  "I've contributed to projects ranging from full-stack web applications to "
  + 'REST APIs and enterprise-style systems such as ClearDrive.lk. My '
  + 'experience includes Python, Java, Node.js, FastAPI, JavaScript, React, '
  + 'Next.js, PostgreSQL, MongoDB, Docker, GitHub Actions, and Agile '
  + 'development using Jira.',
];

const sameBio = (a, b) =>
  Array.isArray(a) && Array.isArray(b) &&
  a.length === b.length &&
  a.every((p, i) => String(p).trim() === String(b[i]).trim());

/** An untouched bio is one that still matches a value this repo wrote. */
const isUntouched = (bio) =>
  !Array.isArray(bio) || bio.length === 0 ||
  sameBio(bio, SEED_BIO) || sameBio(bio, SCHEMA_DEFAULT_BIO);

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

  let updated = 0;
  let already = 0;
  let skipped = 0;

  console.log('\nAbout');
  const abouts = await About.find({});

  for (const doc of abouts) {
    if (sameBio(doc.bio, SITE_BIO)) {
      console.log(`  ✅ OK       ${doc._id}  (bio already matches the site's)`);
      already += 1;
      continue;
    }

    if (!isUntouched(doc.bio)) {
      // ⚠️ SKIPPED is a THIRD outcome, not a silent no-op folded into "OK".
      // This is the case the operator most needs to see: the script chose not
      // to touch a hand-written bio, and if that was not intended, the only
      // moment to notice is now.
      console.log(
        `  ⏭️  SKIP     ${doc._id}  (bio has been edited — leaving it alone)\n` +
        `       first paragraph: "${String(doc.bio[0] ?? '').slice(0, 64)}…"`
      );
      skipped += 1;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  UPDATE'}  ${doc._id}\n` +
      `       ${doc.bio?.length ?? 0} stored paragraph(s) → ${SITE_BIO.length} from the site`
    );

    if (!DRY_RUN) {
      doc.bio = [...SITE_BIO];
      await doc.save();
    }
    updated += 1;
  }

  if (abouts.length === 0) console.log('  (no About document)');

  console.log('\n' + '─'.repeat(56));
  console.log(
    `Documents: ${abouts.length}   Updated: ${updated}   ` +
    `Already correct: ${already}   Skipped: ${skipped}`
  );
  if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
  console.log('');

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration crashed:', err);
    process.exit(1);
  });
}

module.exports = { run, SITE_BIO, SEED_BIO, SCHEMA_DEFAULT_BIO, sameBio, isUntouched };
