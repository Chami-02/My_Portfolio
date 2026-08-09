// PF-61 — Populate the Vocabulary collection from tech and tags
// already present on Projects and Blog posts.
//
// IDEMPOTENT: uses upsert, so running twice creates no duplicates.
//
// Usage:
//   node src/migrations/003-seed-vocabulary.js --dry-run
//   node src/migrations/003-seed-vocabulary.js

require('dotenv').config();
const mongoose   = require('mongoose');
const Project    = require('../models/Project');
const Blog       = require('../models/Blog');
const Vocabulary = require('../models/Vocabulary');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  console.log(DRY_RUN ? '\n🔍 DRY RUN — nothing will be written\n'
                      : '\n⚠️  LIVE RUN — vocabulary will be created\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  // ── Collect distinct tech values from all projects ──────────────
  const projects = await Project.find({}, 'tech');
  const techSet  = new Set();
  for (const p of projects) {
    for (const t of (p.tech || [])) {
      const clean = String(t).trim();
      if (clean) techSet.add(clean);
    }
  }

  // ── Collect distinct tags from all blog posts ───────────────────
  const posts   = await Blog.find({}, 'tags');
  const tagSet  = new Set();
  for (const post of posts) {
    for (const t of (post.tags || [])) {
      const clean = String(t).trim();
      if (clean) tagSet.add(clean);
    }
  }

  console.log(`Found ${techSet.size} distinct tech values`);
  console.log(`Found ${tagSet.size} distinct tag values\n`);

  let created = 0, existing = 0, rejected = 0;

  const insert = async (type, value) => {
    // Skip anything the schema would reject rather than crashing
    if (!/^[A-Za-z0-9 .+#\-/]+$/.test(value) || value.length > 40) {
      console.log(`  ❌ REJECT  ${type}: "${value}" — fails validation`);
      rejected++;
      return;
    }

    const found = await Vocabulary.findOne({ type, value });
    if (found) {
      console.log(`  ⏭  EXISTS  ${type}: ${value}`);
      existing++;
      return;
    }

    console.log(`  ✅ CREATE  ${type}: ${value}`);
    if (!DRY_RUN) await Vocabulary.create({ type, value });
    created++;
  };

  console.log('TECH:');
  for (const v of [...techSet].sort()) await insert('tech', v);

  console.log('\nTAGS:');
  for (const v of [...tagSet].sort()) await insert('tag', v);

  console.log('\n' + '─'.repeat(56));
  console.log(`Created: ${created}   Already existed: ${existing}   Rejected: ${rejected}`);
  if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  run().catch(err => {
    console.error('\n💥 Seed crashed:', err);
    process.exit(1);
  });
}

module.exports = { run };