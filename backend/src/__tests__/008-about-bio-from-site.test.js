// backend/src/__tests__/008-about-bio-from-site.test.js
//
// Migration 008 — move the About bio from the code into the database.
//
// ⚠️ RUNS THE REAL SCRIPT AGAINST A REAL DATABASE, for the reason 007's test
// spells out: a migration whose whole job is to move data cannot be verified by
// reading the file that moves it. 005's test regex-pins `seed.js`'s source and
// would pass even if the value never survived a write.
//
// ⚠️ AND EVERY CASE PLANTS ITS OWN STARTING STATE. A migration that finds
// nothing prints byte-for-byte what a correctly-migrated database prints, so
// `Already correct` is not evidence until the script has been shown to SEE a
// document that needs work. That control is what caught 006's validateSync bug.
//
// The case this file exists for is the SKIP: a bio the owner has already edited
// must survive. It is the one outcome that is silent when it goes wrong — the
// owner's paragraphs are simply replaced, and the log says `UPDATE`, which is
// what a correct run on a fresh database also says.

const About = require('../models/About');
const {
  run, SITE_BIO, SEED_BIO, SCHEMA_DEFAULT_BIO, sameBio, isUntouched,
} = require('../migrations/008-about-bio-from-site');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

// run() connects and disconnects on its own — its real entry path, worth
// exercising. Reconnect afterwards so the assertions have a connection.
const runMigration = async (...argv) => {
  const original = process.argv;
  process.argv = ['node', 'script', ...argv];
  try {
    await run();
  } finally {
    process.argv = original;
    await connectTestDB();
  }
};

let logSpy;

beforeAll(connectTestDB);
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(async () => {
  logSpy.mockRestore();
  await connectTestDB();
  await clearDB();
});
afterAll(async () => {
  await connectTestDB();
  await disconnectTestDB();
});

const output = () => logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
const storedBio = async () => (await About.findOne()).bio.map(String);

describe('the guard predicates', () => {
  it('recognises both texts this repo has written', () => {
    // ⚠️ TWO defaults, not one, and they differ. A document created by
    // `About.create({})` carries the SCHEMA's pair; a seeded one carries
    // seed.js's longer pair. Matching only one leaves half the environments
    // unmigrated, and the symptom — "it works locally, not on the server" —
    // points nowhere near this script.
    expect(isUntouched(SEED_BIO)).toBe(true);
    expect(isUntouched(SCHEMA_DEFAULT_BIO)).toBe(true);
    expect(isUntouched([])).toBe(true);
    expect(isUntouched(undefined)).toBe(true);
  });

  it('treats anything hand-written as touched', () => {
    expect(isUntouched(['Something the owner typed.'])).toBe(false);
    // Same length, one word different — the guard is an exact match, not a
    // shape check, so this must NOT read as a default.
    expect(isUntouched([SEED_BIO[0], 'Replaced second paragraph.'])).toBe(false);
  });

  it('sameBio ignores surrounding whitespace but nothing else', () => {
    expect(sameBio(['  a  ', 'b'], ['a', 'b'])).toBe(true);
    expect(sameBio(['a'], ['a', 'b'])).toBe(false);
    expect(sameBio(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});

describe('--dry-run', () => {
  it('SEES a seeded document and writes nothing', async () => {
    // ⚠️ The control. Both halves: it must REPORT the work and must NOT do it.
    // A script that reported nothing would also "write nothing", and the two
    // are indistinguishable from the database afterwards.
    await About.create({ bio: [...SEED_BIO] });

    await runMigration('--dry-run');

    expect(output()).toMatch(/WOULD/);
    expect(output()).toMatch(/DRY RUN — no changes were written/);
    await expect(storedBio()).resolves.toEqual([...SEED_BIO]);
  });

  it('reports a hand-edited bio as SKIP, not as work to do', async () => {
    await About.create({ bio: ['My own words.'] });

    await runMigration('--dry-run');

    expect(output()).toMatch(/SKIP/);
    expect(output()).not.toMatch(/WOULD/);
    expect(output()).toMatch(/Skipped: 1/);
  });
});

describe('a real run', () => {
  it('replaces the seeded bio with the site\'s', async () => {
    await About.create({ bio: [...SEED_BIO] });

    await runMigration();

    await expect(storedBio()).resolves.toEqual([...SITE_BIO]);
    expect(output()).toMatch(/Updated: 1/);
  });

  it('replaces the SCHEMA default too, not just seed.js\'s', async () => {
    await About.create({ bio: [...SCHEMA_DEFAULT_BIO] });

    await runMigration();

    await expect(storedBio()).resolves.toEqual([...SITE_BIO]);
  });

  it('LEAVES A HAND-EDITED BIO ALONE', async () => {
    // The case the whole guard exists for. Getting this wrong destroys the
    // owner's own writing, and the log line for it reads exactly like a
    // correct first run.
    const mine = ['My own first paragraph.', 'My own second.'];
    await About.create({ bio: [...mine] });

    await runMigration();

    await expect(storedBio()).resolves.toEqual(mine);
    expect(output()).toMatch(/Skipped: 1/);
    expect(output()).toMatch(/Updated: 0/);
  });

  it('is idempotent — a second run finds nothing to do', async () => {
    await About.create({ bio: [...SEED_BIO] });

    await runMigration();
    logSpy.mockClear();
    await runMigration();

    expect(output()).toMatch(/Updated: 0/);
    expect(output()).toMatch(/Already correct: 1/);
    await expect(storedBio()).resolves.toEqual([...SITE_BIO]);
  });

  it('fills an empty bio rather than leaving the section blank', async () => {
    await About.create({ bio: [] });

    await runMigration();

    await expect(storedBio()).resolves.toEqual([...SITE_BIO]);
  });

  it('does nothing at all on an empty collection', async () => {
    await runMigration();
    expect(output()).toMatch(/\(no About document\)/);
    await expect(About.countDocuments()).resolves.toBe(0);
  });
});

describe('--dry-run is read from argv at call time', () => {
  it('honours the flag when run() is called programmatically', async () => {
    // ⚠️ Migration 007's own test caught this for real: a module-scope
    // `const isDryRun = process.argv.includes(...)` binds the flag to whatever
    // argv held when the file was first require()d, so a programmatic caller
    // passing --dry-run gets a LIVE run that writes. This file require()s the
    // module at the top with no flags, so if the flag were captured there, the
    // dry run below would write.
    await About.create({ bio: [...SEED_BIO] });

    await runMigration('--dry-run');

    await expect(storedBio()).resolves.toEqual([...SEED_BIO]);
  });
});

describe('the three copies of the bio text', () => {
  // ⚠️ THE SAME TWO PARAGRAPHS EXIST IN THREE PLACES, in two packages that
  // cannot import from each other:
  //
  //   1. this migration's SITE_BIO          — what a migrated database holds
  //   2. seed.js's `bio`                    — what a re-seeded database holds
  //   3. AboutSection.jsx's BIO_FALLBACK    — what a FAILED FETCH renders
  //
  // A drift between 1 and 2 shows up only as "the wording is different on the
  // server"; a drift between those and 3 shows up only while the API is down,
  // which is precisely when nobody is comparing paragraphs. Neither has a
  // natural moment of discovery, so the check has to be automatic.
  //
  // Parsed by bracket-matching the array literal rather than by regex on the
  // text: the strings contain apostrophes, commas and concatenation across
  // lines, and a regex over that is its own bug.
  const { readFileSync } = require('fs');
  const { resolve } = require('path');

  const ROOT = resolve(__dirname, '../../..');

  const arrayLiteralAfter = (file, marker) => {
    const src = readFileSync(resolve(ROOT, file), 'utf8');
    const at = src.indexOf(marker);
    if (at === -1) throw new Error(`marker "${marker}" not found in ${file}`);

    const start = src.indexOf('[', at);
    let depth = 0;
    let end = start;
    for (; end < src.length; end += 1) {
      if (src[end] === '[') depth += 1;
      else if (src[end] === ']') { depth -= 1; if (depth === 0) break; }
    }
    // eslint-disable-next-line no-eval -- a string-array literal from this repo
    return eval(src.slice(start, end + 1));
  };

  it('seed.js writes exactly what the migration writes', () => {
    expect(arrayLiteralAfter('backend/src/seed.js', '  bio: [')).toEqual(SITE_BIO);
  });

  it('AboutSection\'s fallback is exactly what the migration writes', () => {
    expect(
      arrayLiteralAfter(
        'frontend/src/components/sections/AboutSection.jsx',
        'const BIO_FALLBACK',
      ),
    ).toEqual(SITE_BIO);
  });

  it('finds real content in both files, not an empty match', () => {
    // The control: `toEqual(SITE_BIO)` against a parser that silently returned
    // SITE_BIO itself, or against two empty arrays, would pass.
    expect(SITE_BIO).toHaveLength(2);
    expect(SITE_BIO[0]).toMatch(/University of Westminster/);
    expect(arrayLiteralAfter('backend/src/seed.js', '  bio: [')).not.toBe(SITE_BIO);
  });
});
