// backend/src/__tests__/013-project-pages.test.js
//
// Migration 013 (PF-144) — every existing project gets a slug and, if it has
// none, one "Description" section copied from `description`. Runs the REAL
// script against the test database. Every case PLANTS the old shape first
// through the raw collection (the model would invent a slug on save), so
// "already correct" is never trusted before the script has been shown to see
// a project that needs work.

const mongoose = require('mongoose');
const { run, planFor } = require('../migrations/013-project-pages');
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

// The pre-PF-144 shape: no slug, no sections.
const OLD = Object.freeze({ title: 'ClearDrive.lk', description: 'Vehicle clearance platform.', order: 1 });

it('--dry-run SEES the old shape and writes nothing', async () => {
  await projects().insertOne({ ...OLD });
  await runMigration('--dry-run');

  expect(output()).toMatch(/WOULD .*slug → cleardrivelk, sections → \[Description\]/);
  const doc = await projects().findOne({});
  expect(doc.slug).toBeUndefined();
  expect(doc.sections).toBeUndefined();
});

it('a real run adds the slug and the Description section, and keeps description', async () => {
  await projects().insertOne({ ...OLD });
  await runMigration();

  const doc = await projects().findOne({});
  expect(doc.slug).toBe('cleardrivelk');
  expect(doc.sections).toEqual([
    { heading: 'Description', body: ['Vehicle clearance platform.'], bullets: [] },
  ]);
  expect(doc.description).toBe(OLD.description);
  expect(output()).toMatch(/Updated: 1 {3}Already correct: 0/);
});

it('two projects with one title get x and x-2, and an existing slug is never taken', async () => {
  await projects().insertMany([
    { title: 'Portfolio', slug: 'portfolio', description: 'a', sections: [{ heading: 'H', body: ['b'], bullets: [] }] },
    { title: 'Portfolio', description: 'b', order: 2 },
    { title: 'Portfolio', description: 'c', order: 3 },
  ]);
  await runMigration();

  const slugs = (await projects().find({}).toArray()).map((d) => d.slug).sort();
  expect(slugs).toEqual(['portfolio', 'portfolio-2', 'portfolio-3']);
});

it('is idempotent', async () => {
  await projects().insertOne({ ...OLD });
  await runMigration();
  logSpy.mockClear();
  await runMigration();
  expect(output()).toMatch(/Updated: 0 {3}Already correct: 1/);
});

it('never overwrites sections a project already has', async () => {
  const sections = [{ heading: 'Key Features', body: [], bullets: ['Fast'] }];
  await projects().insertOne({ ...OLD, sections });
  await runMigration();

  const doc = await projects().findOne({});
  expect(doc.sections).toEqual(sections);
  expect(doc.slug).toBe('cleardrivelk');
});

describe('planFor', () => {
  it('a draft with no description gets a slug and NO empty section', () => {
    expect(planFor({ title: 'Half done' }, new Set())).toEqual({ slug: 'half-done' });
  });

  it('a correct project needs nothing', () => {
    const doc = { title: 'X', slug: 'x', description: 'd', sections: [{ heading: 'H' }] };
    expect(planFor(doc, new Set(['x']))).toBeNull();
  });

  it('a title with no letters falls back to "project"', () => {
    expect(planFor({ title: '★★★' }, new Set()).slug).toBe('project');
  });
});
