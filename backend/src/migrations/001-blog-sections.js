// backend/src/migrations/001-blog-sections.js
//
// PF-59 — Convert Blog.content (Markdown string) into Blog.sections[].
//
// IDEMPOTENT: posts that already have sections are skipped.
// NON-DESTRUCTIVE: `content` is never deleted by this script.
//
// Usage:
//   node src/migrations/001-blog-sections.js --dry-run
//   node src/migrations/001-blog-sections.js

require('dotenv').config();
const mongoose = require('mongoose');
const Blog     = require('../models/Blog');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Parse a Markdown string into structured sections.
 *
 * Recognises:
 *   ## Heading      → starts a new section
 *   - bullet        → adds to the current section's bullets
 *   * bullet        → same
 *   plain text      → adds to the current section's body
 *
 * If no headings are found, everything becomes one section
 * titled "Introduction". Nothing is ever lost.
 */
function parseContentToSections(content) {
  if (!content || !content.trim()) return [];

  const lines    = content.split('\n');
  const sections = [];

  let current      = null;
  let paragraphBuf = [];

  // Push any buffered paragraph lines into the current section
  const flushParagraph = () => {
    const text = paragraphBuf.join(' ').trim();
    if (text && current) current.body.push(text);
    paragraphBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Blank line ends the current paragraph
    if (!line) { flushParagraph(); continue; }

    // Markdown heading (##, ###, or #)
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      if (current) sections.push(current);
      current = { heading: headingMatch[1].trim(), body: [], bullets: [] };
      continue;
    }

    // Bullet point
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!current) current = { heading: 'Introduction', body: [], bullets: [] };
      current.bullets.push(bulletMatch[1].trim());
      continue;
    }

    // Ordinary text — buffer it until the paragraph ends
    if (!current) current = { heading: 'Introduction', body: [], bullets: [] };
    paragraphBuf.push(line);
  }

  flushParagraph();
  if (current) sections.push(current);

  // Safety net: if parsing produced nothing usable, keep the
  // whole text as a single section rather than losing it.
  if (sections.length === 0) {
    return [{ heading: 'Introduction', body: [content.trim()], bullets: [] }];
  }

  // Drop any section that ended up completely empty
  return sections.filter(s => s.body.length > 0 || s.bullets.length > 0);
}

async function run() {
  console.log(DRY_RUN ? '\n🔍 DRY RUN — nothing will be written\n'
                      : '\n⚠️  LIVE RUN — data will be modified\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  const posts = await Blog.find({});
  console.log(`Found ${posts.length} blog posts\n`);

  let migrated = 0, skipped = 0, failed = 0;

  for (const post of posts) {
    // IDEMPOTENCY: already migrated → leave it alone
    if (post.sections && post.sections.length > 0) {
      console.log(`⏭  SKIP    "${post.title}" — already has ${post.sections.length} sections`);
      skipped++;
      continue;
    }

    if (!post.content || !post.content.trim()) {
      console.log(`⚠️  EMPTY   "${post.title}" — no content to migrate`);
      skipped++;
      continue;
    }

    const sections = parseContentToSections(post.content);

    if (sections.length === 0) {
      console.log(`❌ FAILED  "${post.title}" — parser produced no sections`);
      failed++;
      continue;
    }

    // Word-count sanity check: did we lose text?
    const before = post.content.trim().split(/\s+/).length;
    const after  = sections.reduce((sum, s) =>
        sum + s.heading.split(/\s+/).length
            + s.body.reduce((a, p) => a + p.split(/\s+/).length, 0)
            + s.bullets.reduce((a, b) => a + b.split(/\s+/).length, 0), 0);

    const lossPercent = ((before - after) / before) * 100;

    console.log(`✅ MIGRATE "${post.title}"`);
    console.log(`     sections : ${sections.length}`);
    console.log(`     headings : ${sections.map(s => s.heading).join(' | ')}`);
    console.log(`     words    : ${before} → ${after}  (${lossPercent.toFixed(1)}% diff)`);

    if (lossPercent > 5) {
      console.log(`     ⚠️  WARNING: more than 5% of words missing — inspect manually`);
    }

    if (!DRY_RUN) {
      post.sections = sections;
      await post.save();        // pre-save hook recalculates readingTimeMinutes
    }

    migrated++;
    console.log('');
  }

  console.log('─'.repeat(56));
  console.log(`Migrated: ${migrated}   Skipped: ${skipped}   Failed: ${failed}`);
  if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
  console.log('');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

// Export for testing
module.exports = { parseContentToSections };

// Only auto-run when executed directly, not when imported by a test
if (require.main === module) {
  run().catch(err => {
    console.error('\n💥 Migration crashed:', err);
    process.exit(1);
  });
}
