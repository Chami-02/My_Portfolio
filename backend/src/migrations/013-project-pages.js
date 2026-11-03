#!/usr/bin/env node
// backend/src/migrations/013-project-pages.js
//
// PF-144 — give every existing project what its own page needs.
//
// ── WHAT CHANGES ────────────────────────────────────────────────────────────
//   Project  slug      →  made from the title where absent, unique by a numeric
//                         suffix (the model's own rule, models/Project.js)
//   Project  sections  →  ONE "Description" section holding `description`,
//                         where the project has no sections yet
//
// WHY: a published project now needs a slug (its address, /projects/<slug>)
// and at least one section (its page). Rows written before PF-144 have
// neither, so without this the first SAVE of an existing project in the
// admin panel would be refused, and none of them would have a page.
//
// EXPAND only: `description` is COPIED, never moved — it stays the card's
// short summary. Nothing is removed.
//
// IDEMPOTENT: each step runs only where its field is still missing, so a
// second run writes nothing and reports every project as already correct.
//
// ⚠️ RAW DRIVER, like 007 and 011: the work is decided by what is really in
// the database, and the model's pre('validate') would invent a slug on load.
// No Mongoose middleware runs on this path, deliberately.
//
// Usage:
//   node src/migrations/013-project-pages.js --dry-run
//   node src/migrations/013-project-pages.js

require('dotenv').config();
const mongoose = require('mongoose');
const slugify  = require('slugify');
const { databaseNameFrom } = require('../config/db');

// Read inside run(), not at module scope — see 007 for the trap.
const isDryRun = () => process.argv.includes('--dry-run');

const baseSlug = (title) =>
  slugify(title || '', { lower: true, strict: true, trim: true }) || 'project';

/**
 * The update one project needs, or null when it is already correct. Pure, so
 * the decision is testable without a database. `taken` is every slug already
 * in use; a slug chosen here is added to it, so two projects with the same
 * title get `x` and `x-2` within one run.
 */
function planFor(doc, taken) {
  const set = {};

  if (typeof doc.slug !== 'string' || !doc.slug.trim()) {
    const base = baseSlug(doc.title);
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    taken.add(slug);
    set.slug = slug;
  }

  const description = typeof doc.description === 'string' ? doc.description.trim() : '';
  if ((!Array.isArray(doc.sections) || doc.sections.length === 0) && description) {
    set.sections = [{ heading: 'Description', body: [description], bullets: [] }];
  }

  return Object.keys(set).length ? set : null;
}

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

  const projects = mongoose.connection.collection('projects');
  const docs = await projects.find({}).sort({ order: 1, createdAt: 1 }).toArray();
  const taken = new Set(docs.map((d) => d.slug).filter((s) => typeof s === 'string' && s.trim()));

  let updated = 0;
  let already = 0;

  console.log('\nProject');
  for (const doc of docs) {
    const set = planFor(doc, taken);
    if (!set) {
      console.log(`  ✅ OK       ${doc._id}  "${doc.title}"`);
      already += 1;
      continue;
    }

    const what = [
      set.slug && `slug → ${set.slug}`,
      set.sections && 'sections → [Description]',
    ].filter(Boolean).join(', ');
    console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  SET    '}  ${doc._id}  "${doc.title}"  ${what}`);

    if (!DRY_RUN) await projects.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }
  if (docs.length === 0) console.log('  (no projects)');

  console.log('\n' + '─'.repeat(56));
  console.log(`Documents: ${docs.length}   Updated: ${updated}   Already correct: ${already}`);
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

module.exports = { run, planFor };
