// backend/src/__tests__/011-blog-content-removal.test.js
//
// Migration 011 — the contract half of PF-59: `content` leaves every post
// (PF-137). The case that matters is the REFUSAL: a post whose only text is
// `content` must stop the whole run with nothing written — unsetting it would
// log `UNSET`, which is what a correct run also says.

const mongoose = require('mongoose');
const { run, classify } = require('../migrations/011-blog-content-removal');
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
const blogs = () => mongoose.connection.collection('blogs');
const withContent = () => blogs().countDocuments({ content: { $exists: true } });

const SECTIONS = [{ heading: 'H', body: ['Converted text.'], bullets: [] }];
const CONVERTED = { title: 'Converted', content: 'Old markdown.', sections: SECTIONS };
const CLEAN = { title: 'Clean', sections: SECTIONS };
const ONLY_COPY = { title: 'Never converted', content: 'The only copy of this text.', sections: [] };

it('--dry-run SEES the field and writes nothing', async () => {
  await blogs().insertOne({ ...CONVERTED });
  await runMigration('--dry-run');
  expect(output()).toMatch(/WOULD/);
  expect(await withContent()).toBe(1);
});

it('a real run unsets content and leaves everything else as it was', async () => {
  await blogs().insertMany([{ ...CONVERTED }, { ...CLEAN }]);
  await runMigration();

  expect(await withContent()).toBe(0);
  expect(output()).toMatch(/Unset: 1 {3}Already clean: 1 {3}Blocked: 0/);
  const converted = await blogs().findOne({ title: 'Converted' });
  expect(converted.sections).toEqual(SECTIONS);
});

it('is idempotent', async () => {
  await blogs().insertOne({ ...CONVERTED });
  await runMigration();
  logSpy.mockClear();
  await runMigration();
  expect(output()).toMatch(/Unset: 0 {3}Already clean: 1/);
});

it('REFUSES when content is a post\'s only text — and writes NOTHING, not even the safe rows', async () => {
  await blogs().insertMany([{ ...CONVERTED }, { ...ONLY_COPY }]);

  await expect(runMigration()).rejects.toThrow(/Refusing: 1 post/);

  expect(output()).toMatch(/BLOCKED .*Never converted/);
  expect(await withContent()).toBe(2);
  expect((await blogs().findOne({ title: 'Never converted' })).content).toBe(ONLY_COPY.content);
});

it('a dry run refuses too, so the pipeline stops before the real run', async () => {
  await blogs().insertOne({ ...ONLY_COPY });
  await expect(runMigration('--dry-run')).rejects.toThrow(/Refusing/);
});

describe('classify', () => {
  it.each([
    ['no field',                         { sections: [] },                         'ok'],
    ['content beside sections',          { content: 'x', sections: SECTIONS },     'unset'],
    ['blank content, no sections',       { content: '  ', sections: [] },          'unset'],
    ['null content, no sections field',  { content: null },                        'unset'],
    ['text in content, empty sections',  { content: 'x', sections: [] },           'blocked'],
    ['text in content, no sections field', { content: 'x' },                       'blocked'],
  ])('%s', (_name, doc, verdict) => {
    expect(classify(doc)).toBe(verdict);
  });
});
