// backend/src/__tests__/about.avatar.test.js
//
// PF-111 — the About portrait slot. Model-level only, no mocks: these pin the
// schema contract that the route tests then exercise over HTTP.
//
// Deliberately the same shape as about.resume.test.js, because the field is
// deliberately the same shape. If one of these two files grows an assertion the
// other lacks, that is a question about the pair, not about one of them.

const mongoose = require('mongoose');
const About = require('../models/About');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const FILLED = {
  url:        'https://res.cloudinary.com/demo/image/upload/v1/portfolio/profile/me.png',
  publicId:   'portfolio/profile/me',
  fileName:   'Parindra.png',
  format:     'png',
  bytes:      248_000,
  width:      1200,
  height:     1600,
  uploadedAt: new Date('2026-09-23T10:00:00Z'),
};

describe('About.avatar (PF-111)', () => {

  it('defaults to an empty slot, not null', async () => {
    const about = await About.create({});

    expect(about.avatar.url).toBe('');
    expect(about.avatar.publicId).toBe('');
    expect(about.avatar.fileName).toBe('');
    expect(about.avatar.format).toBe('');
    expect(about.avatar.bytes).toBe(0);
    expect(about.avatar.width).toBe(0);
    expect(about.avatar.height).toBe(0);
    expect(about.avatar.uploadedAt).toBeNull();
  });

  it('round-trips every field', async () => {
    await About.create({ avatar: FILLED });
    const found = await About.findOne();

    expect(found.avatar.url).toBe(FILLED.url);
    expect(found.avatar.publicId).toBe(FILLED.publicId);
    expect(found.avatar.fileName).toBe(FILLED.fileName);
    expect(found.avatar.format).toBe('png');
    expect(found.avatar.bytes).toBe(248_000);
    expect(found.avatar.width).toBe(1200);
    expect(found.avatar.height).toBe(1600);
    expect(found.avatar.uploadedAt).toEqual(FILLED.uploadedAt);
  });

  it('retains publicId — without it the old file can never be deleted', async () => {
    // The entire reason this field is an object rather than a String. Cloudinary
    // deletes by public_id and by nothing else; a stored URL cannot be turned
    // back into one, so a lost publicId is a permanently unreachable file.
    await About.create({ avatar: FILLED });
    const found = await About.findOne();

    expect(found.avatar.publicId).toBe('portfolio/profile/me');
    expect(found.avatar.publicId).not.toBe('');
  });

  it('rejects a data: URI', async () => {
    // Same rule as resume.url and Project.backgroundImage.src: data: URIs bloat
    // the database and can carry a stored-XSS payload via SVG.
    const about = new About({ avatar: { url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } });
    const err = about.validateSync();

    expect(err).toBeDefined();
    expect(err.errors['avatar.url']).toBeDefined();
  });

  it('accepts an empty url — that is the "no portrait" state, not an error', async () => {
    const about = new About({ avatar: { url: '' } });
    expect(about.validateSync()).toBeUndefined();
  });

  it('casts a numeric string for bytes', async () => {
    const about = await About.create({ avatar: { ...FILLED, bytes: '248000' } });
    expect(about.avatar.bytes).toBe(248_000);
    expect(typeof about.avatar.bytes).toBe('number');
  });

  it('no longer has the flat avatarUrl field', async () => {
    // PF-111 renamed it. Kept as an explicit assertion rather than left implicit
    // so that re-adding it — the obvious "fix" for a stale frontend read — fails
    // here instead of quietly giving a portrait two places to live.
    const about = await About.create({ avatarUrl: 'https://example.com/old.png' });
    expect(about.avatarUrl).toBeUndefined();
    expect(about.toJSON().avatarUrl).toBeUndefined();
  });
});

describe('About.hasAvatar virtual (PF-111)', () => {

  it('is false on a fresh document and true once a url is set', async () => {
    const empty = await About.create({});
    expect(empty.hasAvatar).toBe(false);

    empty.avatar = FILLED;
    await empty.save();
    expect(empty.hasAvatar).toBe(true);
  });

  it('is FALSE for a publicId with no url — the half-failed replacement', async () => {
    // ⚠️ This is the state a crash between upload and save would leave behind.
    // It must not read as "there is a portrait", or the public site renders a
    // broken image instead of falling back to the bundled one.
    const about = await About.create({ avatar: { publicId: 'portfolio/profile/orphan' } });
    expect(about.hasAvatar).toBe(false);
  });

  it('is present in toJSON, or it never reaches the client', async () => {
    const about = await About.create({ avatar: FILLED });
    expect(about.toJSON().hasAvatar).toBe(true);
  });
});

describe('Project.imageUrl and Blog.coverImage are gone (PF-111)', () => {

  it('Project no longer declares imageUrl', () => {
    const Project = require('../models/Project');
    expect(Project.schema.path('imageUrl')).toBeUndefined();
  });

  it('Blog no longer declares coverImage', () => {
    const Blog = require('../models/Blog');
    expect(Blog.schema.path('coverImage')).toBeUndefined();
  });

  it('a value sent for either is dropped rather than stored', async () => {
    // Mongoose strict mode drops unknown paths silently. Asserted so the
    // deletion is known to be a real deletion, not a schema-only one that
    // leaves data arriving from an old client sitting in the collection.
    const Project = require('../models/Project');
    const p = await Project.create({
      title: 'x', description: 'd', githubUrl: 'https://github.com/a/b',
      tech: ['React'], imageUrl: 'https://example.com/old.png',
    });

    const raw = await mongoose.connection
      .collection('projects').findOne({ _id: p._id });

    expect(raw.imageUrl).toBeUndefined();
  });
});
