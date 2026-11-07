// Migration 015 — every post's reads start again from 0 (PF-153). What matters
// besides the reset itself: a rerun after real reads have arrived wipes nothing.

const mongoose = require('mongoose');
const { run } = require('../migrations/015-blog-reads-reset');
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

const blogs = () => mongoose.connection.collection('blogs');
const totals = () => mongoose.connection.collection('visittotals');
const viewsList = async () => (await blogs().find().sort({ title: 1 }).toArray()).map((p) => p.views);
const STAMP = new Date('2026-01-01T00:00:00Z');

it('--dry-run sees the reads and writes nothing', async () => {
  await blogs().insertOne({ title: 'A', views: 7 });
  await runMigration('--dry-run');
  expect(logSpy.mock.calls.flat().join('\n')).toMatch(/WOULD/);
  expect(await viewsList()).toEqual([7]);
});

it('resets every post to 0 and leaves updatedAt alone', async () => {
  await blogs().insertMany([
    { title: 'A', views: 7, updatedAt: STAMP },
    { title: 'B', views: 4, updatedAt: STAMP },
    { title: 'C', views: 0, updatedAt: STAMP },
  ]);
  await runMigration();
  expect(await viewsList()).toEqual([0, 0, 0]);
  expect((await blogs().findOne({ title: 'A' })).updatedAt).toEqual(STAMP);
});

it('wipes nothing once a real read has been counted', async () => {
  await blogs().insertOne({ title: 'A', views: 3 });
  await totals().insertOne({ day: '2026-11-08', dim: 'read', key: '/blog/a', count: 3 });
  await runMigration();
  expect(await viewsList()).toEqual([3]);
});

it('other totals do not count as a real read', async () => {
  await blogs().insertOne({ title: 'A', views: 3 });
  await totals().insertOne({ day: '2026-11-08', dim: 'path', key: '/blog/a', count: 3 });
  await runMigration();
  expect(await viewsList()).toEqual([0]);
});
