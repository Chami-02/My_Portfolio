// backend/src/__tests__/007-media-public-ids.test.js
//
// PF-111 — migration 007.
//
// ⚠️ THIS FILE RUNS THE REAL SCRIPT AGAINST A REAL DATABASE, deliberately, and
// that is the whole point of it. 005's test pins seed.js's SOURCE TEXT against
// an exported constant — it never touches Mongo, never runs a hook, and its own
// header says it is not proof the fix works. A migration whose entire job is to
// move data cannot be verified by reading the file that moves it.
//
// ⚠️ EVERY TEST HERE PLANTS THE DIRTY STATE FIRST. A migration that finds
// nothing prints exactly what a correctly-migrated database prints, so "it said
// already correct" is not evidence of anything until the script has been shown
// to SEE a document that needs work. This is the control that caught 006's
// validateSync bug, where a broken script and a working one were
// indistinguishable from their output.
//
// The planting goes through the RAW COLLECTION, not the models — the whole
// reason the migration exists is that these fields are no longer in the
// schemas, and Mongoose's strict mode would silently drop them on the way in,
// leaving the fixture clean and the test vacuous.

const mongoose = require('mongoose');
const About   = require('../models/About');
const Project = require('../models/Project');
const Blog    = require('../models/Blog');
const { run } = require('../migrations/007-media-public-ids');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

// run() connects and disconnects on its own — that is its real entry path and
// is worth exercising. Reconnect afterwards so the assertions have a
// connection. Verified: mongoose.connect() on an already-open connection with
// the same URI is a no-op, and reconnecting after disconnect works.
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

const output = () => logSpy.mock.calls.map(c => c.join(' ')).join('\n');

const plantAbout = async (fields) => {
  const doc = await About.create({});
  await mongoose.connection.collection('abouts')
    .updateOne({ _id: doc._id }, fields);
  return doc._id;
};

const plantProject = async (fields) => {
  const doc = await Project.create({
    title: 'ClearDrive', description: 'd',
    githubUrl: 'https://github.com/a/b', tech: ['React'],
  });
  await mongoose.connection.collection('projects')
    .updateOne({ _id: doc._id }, fields);
  return doc._id;
};

const plantPost = async (fields) => {
  const doc = await Blog.create({
    title: 'A post', excerpt: 'e',
    sections: [{ heading: 'H', body: ['b'], bullets: [] }],
  });
  await mongoose.connection.collection('blogs')
    .updateOne({ _id: doc._id }, fields);
  return doc._id;
};

const raw = (collection, id) =>
  mongoose.connection.collection(collection).findOne({ _id: id });

describe('Migration 007 — the CONTROL: it sees a dirty document', () => {

  it('reports a legacy avatarUrl in a dry run and writes nothing', async () => {
    const id = await plantAbout({ $set: { avatarUrl: 'https://example.com/old.png' } });

    // the plant really landed — otherwise everything below is vacuous
    expect((await raw('abouts', id)).avatarUrl).toBe('https://example.com/old.png');

    await runMigration('--dry-run');

    expect(output()).toMatch(/WOULD/);
    expect(output()).toMatch(/DRY RUN — no changes were written/);

    // untouched
    const after = await raw('abouts', id);
    expect(after.avatarUrl).toBe('https://example.com/old.png');
  });

  it('a model-based read would NOT have seen it — which is why this uses the raw driver', async () => {
    // ⚠️ The trap this migration is most likely to fall into, pinned as a fact
    // about Mongoose rather than a claim in a comment: the field is no longer
    // in the schema, so the model cannot see it, so a model-based script would
    // report "nothing to do" on a database full of work.
    const id = await plantAbout({ $set: { avatarUrl: 'https://example.com/old.png' } });

    const viaModel = await About.findById(id);
    expect(viaModel.avatarUrl).toBeUndefined();          // invisible

    const viaDriver = await raw('abouts', id);
    expect(viaDriver.avatarUrl).toBe('https://example.com/old.png');   // there all along
  });
});

describe('Migration 007 — About.avatarUrl → avatar{}', () => {

  it('moves the URL into avatar.url and unsets the old field', async () => {
    const id = await plantAbout({
      $set:   { avatarUrl: 'https://example.com/old.png' },
      $unset: { avatar: '' },
    });

    await runMigration();

    const after = await raw('abouts', id);
    expect(after.avatarUrl).toBeUndefined();
    expect(after.avatar.url).toBe('https://example.com/old.png');
    expect(after.avatar.publicId).toBe('');      // a bare URL never had one
    expect(after.avatar.bytes).toBe(0);
  });

  it('warns that a migrated URL has no publicId and is therefore not deletable', async () => {
    await plantAbout({
      $set:   { avatarUrl: 'https://example.com/old.png' },
      $unset: { avatar: '' },
    });

    await runMigration('--dry-run');
    expect(output()).toMatch(/no publicId/);
  });

  it('leaves an already-migrated document alone and reports it correct', async () => {
    const doc = await About.create({
      avatar: {
        url: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/profile/me.png',
        publicId: 'portfolio/profile/me', fileName: 'me.png', format: 'png',
        bytes: 10, width: 1, height: 1, uploadedAt: new Date(),
      },
    });

    await runMigration();

    const after = await raw('abouts', doc._id);
    expect(after.avatar.publicId).toBe('portfolio/profile/me');
    expect(output()).toMatch(/✅ OK/);
  });

  it('is idempotent — a second run changes nothing', async () => {
    const id = await plantAbout({
      $set:   { avatarUrl: 'https://example.com/old.png' },
      $unset: { avatar: '' },
    });

    await runMigration();
    const first = await raw('abouts', id);

    logSpy.mockClear();
    await runMigration();
    const second = await raw('abouts', id);

    expect(second).toEqual(first);
    expect(output()).not.toMatch(/UPDATE/);
  });
});

describe('Migration 007 — dead field removal', () => {

  it('unsets Project.imageUrl', async () => {
    const id = await plantProject({ $set: { imageUrl: 'https://example.com/card.png' } });
    expect((await raw('projects', id)).imageUrl).toBeDefined();   // control

    await runMigration();

    expect((await raw('projects', id)).imageUrl).toBeUndefined();
  });

  it('adds backgroundImage.publicId where it is absent, without disturbing src or opacity', async () => {
    const id = await plantProject({
      $set: { backgroundImage: { src: 'https://example.com/bg.png', opacity: 0.4 } },
    });
    expect((await raw('projects', id)).backgroundImage.publicId).toBeUndefined();   // control

    await runMigration();

    const bg = (await raw('projects', id)).backgroundImage;
    expect(bg.publicId).toBe('');
    expect(bg.src).toBe('https://example.com/bg.png');
    expect(bg.opacity).toBe(0.4);
  });

  it('unsets Blog.coverImage', async () => {
    const id = await plantPost({ $set: { coverImage: 'https://example.com/cover.png' } });
    expect((await raw('blogs', id)).coverImage).toBeDefined();     // control

    await runMigration();

    expect((await raw('blogs', id)).coverImage).toBeUndefined();
  });

  it('prints the value it is about to drop, so the log is the record of it', async () => {
    await plantPost({ $set: { coverImage: 'https://example.com/cover.png' } });

    await runMigration('--dry-run');

    expect(output()).toContain('https://example.com/cover.png');
  });

  it('is idempotent across all three collections', async () => {
    await plantProject({ $set: { imageUrl: 'https://example.com/card.png' } });
    await plantPost({ $set: { coverImage: 'https://example.com/cover.png' } });
    await plantAbout({ $set: { avatarUrl: 'https://example.com/old.png' } });

    await runMigration();

    logSpy.mockClear();
    await runMigration();

    expect(output()).not.toMatch(/UPDATE/);
    expect(output()).toMatch(/Updated: 0/);
  });
});

describe('Migration 007 — an empty database', () => {

  it('runs clean and reports zero', async () => {
    await runMigration('--dry-run');

    expect(output()).toMatch(/Documents: 0/);
    expect(output()).toMatch(/\(no projects\)/);
    expect(output()).toMatch(/\(no posts\)/);
  });
});
