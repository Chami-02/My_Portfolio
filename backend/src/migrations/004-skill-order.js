// backend/src/migrations/004-skill-order.js
//
// PF-82 — Align Skill.order with the prototype's pill sequence.
//
// WHY THIS EXISTS. PF-82 corrected the `order` values in seed.js, but
// seed.js only runs on a fresh environment — and it deletes every
// Project, Skill, Blog, About and User before it writes, so re-running it
// against a live database to pick up an ordering change is not an option.
// The public Skills section renders by `order`, so without this script
// the live site keeps the old sequence no matter what seed.js says.
//
// WHAT CHANGES. Only the `order` field, only on skills matched by exact
// name. No document is created, deleted, or otherwise modified. The three
// groups that were out of step:
//
//   language   Java moved from 3rd to last
//   frontend   Vite up to 2nd, Next.js down to last
//   database   Mongoose and SQLAlchemy swapped
//
// `backend` and `devops` already matched the prototype and are listed
// here anyway — the table is the complete target order, so it stays
// readable as one thing rather than as a diff, and those rows simply
// report as already-correct.
//
// IDEMPOTENT: sets absolute values, so running it twice is a no-op.
// NON-DESTRUCTIVE: no deletes, no upserts. A name not present in the
// database is reported and skipped, never created.
//
// Usage:
//   node src/migrations/004-skill-order.js --dry-run
//   node src/migrations/004-skill-order.js

require('dotenv').config();
const mongoose = require('mongoose');
const Skill    = require('../models/Skill');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * The target order, transcribed from
 * `docs/design/Portfolio Revolution.dc.html` lines 253-307.
 * Index in this array + 1 is the `order` value. Must stay identical to
 * SKILLS in seed.js — the two are the same fact written twice, once for
 * a fresh database and once for an existing one.
 */
const TARGET_ORDER = [
  // language
  'JavaScript', 'Python', 'HTML5', 'CSS3', 'Java',
  // frontend
  'React', 'Vite', 'Tailwind CSS', 'React Router', 'Next.js',
  // backend
  'FastAPI', 'Node.js', 'Express.js', 'REST APIs', 'JWT Authentication',
  // database
  'PostgreSQL', 'MongoDB', 'Redis', 'Mongoose', 'SQLAlchemy',
  // devops
  'Docker', 'Git', 'GitHub', 'GitHub Actions', 'Linux CLI', 'Jira',
];

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set — refusing to guess a database.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Connected — database: ${mongoose.connection.name}`);
  console.log(DRY_RUN ? '🔍 DRY RUN — nothing will be written\n' : '✍️  LIVE RUN\n');

  let updated = 0, already = 0, missing = 0;

  for (const [i, name] of TARGET_ORDER.entries()) {
    const order = i + 1;
    const skill = await Skill.findOne({ name });

    if (!skill) {
      console.log(`  ❓ MISSING  ${String(order).padStart(2)}  ${name}`);
      missing++;
      continue;
    }
    if (skill.order === order) {
      console.log(`  ⏭  OK       ${String(order).padStart(2)}  ${name}`);
      already++;
      continue;
    }

    console.log(`  ✅ UPDATE   ${String(order).padStart(2)}  ${name}  (was ${skill.order})`);
    // updateOne rather than save(): `order` is the only field being
    // touched, and a full save would re-run validators over fields this
    // migration has no opinion about.
    if (!DRY_RUN) await Skill.updateOne({ _id: skill._id }, { $set: { order } });
    updated++;
  }

  // Anything in the collection that is NOT in the target list keeps
  // whatever order it has. Reported so it cannot silently collide with
  // the 1-26 range this script owns.
  const extras = await Skill.find({ name: { $nin: TARGET_ORDER } }, 'name category order');
  if (extras.length) {
    console.log('\n  Skills outside the prototype\'s 26 — left untouched:');
    extras.forEach((s) => console.log(`     ${s.name} (${s.category}, order ${s.order})`));
  }

  console.log('\n' + '─'.repeat(56));
  console.log(`Updated: ${updated}   Already correct: ${already}   Missing: ${missing}   Extra: ${extras.length}`);
  if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration crashed:', err);
    process.exit(1);
  });
}

module.exports = { run, TARGET_ORDER };
