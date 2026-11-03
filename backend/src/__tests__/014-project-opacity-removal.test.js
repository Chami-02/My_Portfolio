// backend/src/__tests__/014-project-opacity-removal.test.js
//
// Migration 014 — the contract half of PF-144: `backgroundImage.opacity`
// leaves every project (PF-138). What matters besides the unset itself: the
// picture beside it (`src`, `publicId`) is untouched — losing a publicId
// orphans the file in Cloudinary for good.

const mongoose = require('mongoose');
const { run, hasOpacity } = require('../migrations/014-project-opacity-removal');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

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
const projects = () => mongoose.connection.collection('projects');
const withOpacity = () => projects().countDocuments({ 'backgroundImage.opacity': { $exists: true } });

const PICTURE = { src: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/projects/a.png', publicId: 'portfolio/projects/a' };
const TUNED = Object.freeze({ title: 'Tuned', backgroundImage: { ...PICTURE, opacity: 0.4 } });
const CLEAN = Object.freeze({ title: 'Clean', backgroundImage: { src: '', publicId: '' } });
const NO_PICTURE = Object.freeze({ title: 'No picture' });

it('--dry-run SEES the field and writes nothing', async () => {
  await projects().insertOne({ ...TUNED });
  await runMigration('--dry-run');
  expect(output()).toMatch(/WOULD/);
  expect(await withOpacity()).toBe(1);
});

it('a real run unsets opacity and leaves the picture exactly as it was', async () => {
  await projects().insertMany([{ ...TUNED }, { ...CLEAN }, { ...NO_PICTURE }]);
  await runMigration();

  expect(await withOpacity()).toBe(0);
  expect(output()).toMatch(/Projects: 3 {3}Unset: 1 {3}Already clean: 2/);
  expect((await projects().findOne({ title: 'Tuned' })).backgroundImage).toEqual(PICTURE);
  expect((await projects().findOne({ title: 'Clean' })).backgroundImage).toEqual(CLEAN.backgroundImage);
  expect(await projects().findOne({ title: 'No picture' })).not.toHaveProperty('backgroundImage');
});

it('is idempotent', async () => {
  await projects().insertOne({ ...TUNED });
  await runMigration();
  logSpy.mockClear();
  await runMigration();
  expect(output()).toMatch(/Unset: 0 {3}Already clean: 1/);
});

it('an empty collection is fine', async () => {
  await runMigration();
  expect(output()).toMatch(/\(no projects\)/);
});

describe('hasOpacity', () => {
  it.each([
    [{ backgroundImage: { opacity: 0.75 } }, true],
    [{ backgroundImage: { opacity: null } }, true],   // present, even if null
    [{ backgroundImage: { src: '' } }, false],
    [{ backgroundImage: null }, false],
    [{}, false],
  ])('%j → %s', (doc, expected) => {
    expect(hasOpacity(doc)).toBe(expected);
  });
});
