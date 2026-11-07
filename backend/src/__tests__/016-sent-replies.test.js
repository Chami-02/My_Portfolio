// Migration 016 — PF-153's replies, kept inside each message, copied into SENT
// (PF-154). What matters besides the copy: a rerun adds nothing, a reply the new
// code already recorded is not doubled, and the old arrays are left alone.

const mongoose = require('mongoose');
const { run } = require('../migrations/016-sent-replies');
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

const contacts = () => mongoose.connection.collection('contacts');
const sent = () => mongoose.connection.collection('sentreplies');
const RECEIVED = new Date('2026-11-01T00:00:00Z');
const T1 = new Date('2026-11-02T00:00:00Z');
const T2 = new Date('2026-11-03T00:00:00Z');

const seed = () => contacts().insertMany([
  {
    name: 'Ada', email: 'ada@example.com', message: 'Are you free?', createdAt: RECEIVED,
    replies: [{ message: 'Yes.', sentAt: T1 }, { message: 'Still yes.', sentAt: T2 }],
  },
  { name: 'Grace', email: 'grace@example.com', message: 'Hello there!', createdAt: RECEIVED },
]);

it('--dry-run sees the replies and writes nothing', async () => {
  await seed();
  await runMigration('--dry-run');
  expect(logSpy.mock.calls.flat().join('\n')).toMatch(/WOULD COPY/);
  expect(await sent().countDocuments()).toBe(0);
});

it('copies every reply with everything the email held, and leaves the old arrays', async () => {
  await seed();
  await runMigration();
  const ada = await contacts().findOne({ name: 'Ada' });
  const rows = await sent().find().sort({ sentAt: 1 }).toArray();
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    contact: ada._id, toName: 'Ada', toEmail: 'ada@example.com',
    subject: 'Re: Your message to Parindra Gallage', message: 'Yes.',
    original: { message: 'Are you free?', receivedAt: RECEIVED }, sentAt: T1,
  });
  expect(rows[1].message).toBe('Still yes.');
  expect(ada.replies).toHaveLength(2);   // EXPAND only
});

it('a rerun adds nothing', async () => {
  await seed();
  await runMigration();
  await runMigration();
  expect(await sent().countDocuments()).toBe(2);
});

it('a reply already in SENT is not doubled', async () => {
  const { insertedIds } = await seed();
  await sent().insertOne({ contact: insertedIds[0], message: 'Yes.', sentAt: T1 });
  await runMigration();
  expect(await sent().countDocuments()).toBe(2);
  expect(await sent().countDocuments({ sentAt: T1 })).toBe(1);
});

it('a row with no createdAt takes its id\'s time', async () => {
  await contacts().insertOne({ name: 'Old', email: 'o@example.com', message: 'From long ago.', replies: [{ message: 'Hi.', sentAt: T1 }] });
  await runMigration();
  const [row] = await sent().find().toArray();
  expect(row.original.receivedAt).toBeInstanceOf(Date);
});
