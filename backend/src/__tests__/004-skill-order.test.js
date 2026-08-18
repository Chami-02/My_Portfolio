// backend/src/__tests__/004-skill-order.test.js
//
// PF-82. The prototype's pill sequence is written down twice — once in
// seed.js (for a fresh database) and once in migration 004 (for an
// existing one). Two copies of one fact drift, and the drift is
// invisible: each file reads fine on its own, and the only symptom is
// that a freshly seeded environment renders Skills in a different order
// from production. These tests pin the two together.

const { readFileSync } = require('fs');
const { resolve } = require('path');
const { TARGET_ORDER } = require('../migrations/004-skill-order');

// seed.js calls seed() at module scope, so it cannot be require()d from
// a test without connecting to a database and calling process.exit().
// Read as text and parse out the one array this test cares about.
const seedSrc = readFileSync(resolve(__dirname, '../seed.js'), 'utf8');

function seededSkills() {
  const start = seedSrc.indexOf('const SKILLS = [');
  expect(start).toBeGreaterThan(-1);
  const block = seedSrc.slice(start, seedSrc.indexOf('];', start));

  const re = /\{\s*name:\s*'([^']+)',\s*category:\s*'([^']+)',\s*level:\s*'([^']+)',\s*order:\s*(\d+)\s*\}/g;
  const out = [];
  let m;
  while ((m = re.exec(block)) !== null) {
    out.push({ name: m[1], category: m[2], level: m[3], order: Number(m[4]) });
  }
  return out;
}

/** The prototype's five cards, lines 253-307 — the categories in the
 *  order they are rendered, and how many pills each holds. */
const CARDS = [
  ['language', 5],
  ['frontend', 5],
  ['backend',  5],
  ['database', 5],
  ['devops',   6],
];

describe('Migration 004 — skill order (PF-82)', () => {
  const skills = seededSkills();

  it('parses all 26 skills out of seed.js', () => {
    expect(skills).toHaveLength(26);
  });

  it('seeds exactly the migration\'s target sequence', () => {
    const byOrder = [...skills].sort((a, b) => a.order - b.order).map((s) => s.name);
    expect(byOrder).toEqual(TARGET_ORDER);
  });

  it('numbers the seeded skills 1..26 with no gaps or duplicates', () => {
    const orders = skills.map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it('lists every skill name exactly once in the migration target', () => {
    expect(new Set(TARGET_ORDER).size).toBe(TARGET_ORDER.length);
  });

  // The section renders five cards in a fixed sequence and sorts within
  // each by `order`. If a category's orders interleave with another's,
  // the cards still render — the pills just come out in an order nobody
  // chose. Contiguity is what makes the flat 1..26 numbering safe.
  it('keeps each category\'s orders contiguous, in the cards\' render order', () => {
    const byOrder = [...skills].sort((a, b) => a.order - b.order);
    let i = 0;
    for (const [category, count] of CARDS) {
      const slice = byOrder.slice(i, i + count);
      expect(slice.map((s) => s.category)).toEqual(Array(count).fill(category));
      i += count;
    }
    expect(i).toBe(26);
  });

  it('files nothing under the unused "other" category', () => {
    expect(skills.some((s) => s.category === 'other')).toBe(false);
  });

  it('uses only levels the Skill schema accepts', () => {
    const allowed = ['beginner', 'intermediate', 'advanced'];
    skills.forEach((s) => expect(allowed).toContain(s.level));
  });

  // The three groups PF-82 actually changed, pinned by name rather than
  // by index so the assertion says what it means.
  it('places the three corrected entries where the prototype has them', () => {
    const at = (n) => skills.find((s) => s.name === n).order;
    expect(at('Java')).toBe(5);        // last of language, was 3rd
    expect(at('Vite')).toBe(7);        // 2nd of frontend, was 3rd
    expect(at('Next.js')).toBe(10);    // last of frontend, was 2nd
    expect(at('Mongoose')).toBe(19);   // 4th of database, was 5th
    expect(at('SQLAlchemy')).toBe(20); // last of database, was 4th
  });
});
