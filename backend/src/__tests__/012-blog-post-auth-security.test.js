// backend/src/__tests__/012-blog-post-auth-security.test.js
//
// Migration 012 — the authentication & security post arrives as a DRAFT
// (owner, PF-137). What matters: it never overwrites a post at its URL, the
// row it writes is exactly what the model would have written, and the owner
// can PUBLISH it from the panel as stored.

const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const { run, POST, TAGS } = require('../migrations/012-blog-post-auth-security');
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
const tags = () => mongoose.connection.collection('vocabularies');

it('--dry-run writes nothing', async () => {
  await runMigration('--dry-run');
  expect(output()).toMatch(/WOULD/);
  expect(await blogs().countDocuments()).toBe(0);
  expect(await tags().countDocuments()).toBe(0);
});

it('adds the post as a DRAFT, invisible on the public list', async () => {
  await runMigration();
  const row = await blogs().findOne({ slug: POST.slug });
  expect(row.published).toBe(false);
  expect(row.publishedAt).toBeNull();
  expect(row.sections).toHaveLength(POST.sections.length);
  expect(await Blog.countDocuments({ published: true })).toBe(0);
});

it('writes the slug and reading time exactly as the model derives them', async () => {
  await runMigration();
  const stored = await blogs().findOne({ slug: POST.slug });

  // A NEW document derives both from scratch — the migration's literals must match.
  const fresh = new Blog({ title: POST.title, sections: POST.sections });
  await fresh.validate();
  expect(stored.slug).toBe(fresh.slug);
  expect(stored.readingTimeMinutes).toBe(fresh.readingTimeMinutes);
  expect(stored.readingTimeMinutes).toBeGreaterThan(1);
});

it('the stored post can be PUBLISHED from the panel as it is', async () => {
  await runMigration();
  const post = await Blog.findOne({ slug: POST.slug });
  post.published = true;
  await expect(post.save()).resolves.toBeTruthy();
  expect(post.publishedAt).toBeInstanceOf(Date);
  expect(post.slug).toBe(POST.slug);           // publishing does not move its URL
});

it('fits every limit the panel enforces', () => {
  expect(POST.title.length).toBeLessThanOrEqual(150);
  expect(POST.excerpt.length).toBeLessThanOrEqual(300);
  for (const s of POST.sections) {
    expect(s.heading.length).toBeLessThanOrEqual(200);
    expect(s.body.length + s.bullets.length).toBeGreaterThan(0);
  }
});

it('adds its tags to the vocabulary so the chip picker offers them', async () => {
  await tags().insertOne({ type: 'tag', value: 'Security', order: 0 });
  await runMigration();
  const values = (await tags().find({ type: 'tag' }).toArray()).map((t) => t.value).sort();
  expect(values).toEqual([...TAGS].sort());
});

it('NEVER overwrites a post already at its URL — the owner\'s edits survive', async () => {
  await runMigration();
  await blogs().updateOne({ slug: POST.slug }, { $set: { title: 'Edited in the panel', published: true } });

  logSpy.mockClear();
  await runMigration();

  const rows = await blogs().find({ slug: POST.slug }).toArray();
  expect(rows).toHaveLength(1);
  expect(rows[0].title).toBe('Edited in the panel');
  expect(rows[0].published).toBe(true);
  expect(output()).toMatch(/already exists/);
});
