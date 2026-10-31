// PF-135 — restoring a backup: the check, the restore, the safety copies.
// Through the real routes, multer, controller, service, models and a REAL
// transaction (the in-memory server is a one-node replica set since PF-135).
// Only nodemailer's network call is mocked.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const request    = require('supertest');
const mongoose   = require('mongoose');
const nodemailer = require('nodemailer');
const app        = require('../app');
const User          = require('../models/User');
const About         = require('../models/About');
const Project       = require('../models/Project');
const Skill         = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const Blog          = require('../models/Blog');
const Vocabulary    = require('../models/Vocabulary');
const Contact       = require('../models/Contact');
const Education     = require('../models/Education');
const Certificate   = require('../models/Certificate');
const Migration     = require('../models/Migration');
const SignInEvent   = require('../models/SignInEvent');
const BackupSnapshot = require('../models/BackupSnapshot');
const { issueSession } = require('../services/sessionService');
const { VERSION, UPGRADES, SAFETY_COPIES, MAX_ROWS } = require('../services/backupFile');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const PASSWORD = 'Owner-Password-123';
const ORIGINAL = { ...process.env };
const FOLDER = 'portfolio';
const CLOUD  = 'demo-cloud';
const media  = (name) => ({ id: `${FOLDER}/${name}`, url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/${FOLDER}/${name}.webp` });

// backupLimiter (10 / 15 min) is live under test — every request its own IP.
let ip = 0;
const nextIp = () => `10.136.${Math.floor(++ip / 250)}.${ip % 250}`;

let user, session;
const auth = (req) => req.set('Authorization', `Bearer ${session.accessToken}`).set('X-Forwarded-For', nextIp());

const download = async () => {
  const res = await auth(request(app).post('/api/backup')).send({ password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data;
};
const asFile = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
const check = (file, name = 'backup.json') =>
  auth(request(app).post('/api/backup/restore/check')).attach('file', asFile(file), name);
const restore = (file, password = PASSWORD, name = 'backup.json') =>
  auth(request(app).post('/api/backup/restore')).field('password', password).attach('file', asFile(file), name);

/** Every content collection, as stored — the "nothing changed" comparison. */
const state = async () => {
  const all = async (Model) => (await Model.find().sort({ _id: 1 }).lean()).map((d) => JSON.parse(JSON.stringify(d)));
  return {
    about: await all(About), projects: await all(Project), skills: await all(Skill),
    skillCategories: await all(SkillCategory), blog: await all(Blog), vocabulary: await all(Vocabulary),
    messages: await all(Contact), education: await all(Education), certificates: await all(Certificate),
  };
};
/** A downloaded file minus the moment it was made. */
const content = ({ createdAt: _ignored, ...rest }) => rest;

const seedContent = async () => {
  const resume = media('resume');
  const bg     = media('project-bg');
  await About.create({
    name: 'Owner', title: 'Developer',
    resume: { url: resume.url, publicId: resume.id, fileName: 'cv.pdf', format: 'pdf', bytes: 10 },
  });
  await SkillCategory.create([{ key: 'devops', label: 'DevOps', order: 1 }, { key: 'soft', label: 'Soft Skills', order: 2 }]);
  await Skill.create([
    { name: 'Git', category: 'devops', level: 'beginner', order: 1 },
    { name: 'Teamwork', category: 'soft', level: 'advanced', order: 2 },
  ]);
  await Project.create([
    {
      title: 'Live project', description: 'A valid test project description for the restore suite.',
      tech: ['JavaScript'], githubUrl: 'https://github.com/test/one', order: 1,
      backgroundImage: { src: bg.url, publicId: bg.id, opacity: 0.5 },
    },
    {
      title: 'Draft project', description: 'Another valid test project description for this suite.',
      tech: ['Node.js'], githubUrl: 'https://github.com/test/two', published: false, order: 2,
    },
  ]);
  await Blog.create([
    {
      title: 'Original title', excerpt: 'An excerpt.', published: true,
      publishedAt: new Date('2026-01-02T03:04:05.000Z'),
      sections: [{ heading: 'Intro', body: ['Some text.'], bullets: [] }],
    },
    { title: 'Draft post', excerpt: 'A draft.', sections: [{ heading: 'H', body: ['x'], bullets: [] }], published: false },
  ]);
  // Renamed after publishing: the stored URL no longer follows the title.
  await Blog.collection.updateOne({ slug: 'original-title' }, { $set: { title: 'Renamed later' } });
  await Vocabulary.create([{ type: 'tag', value: 'testing' }, { type: 'tech', value: 'Docker' }]);
  await Contact.create([
    { name: 'Ada', email: 'ada@example.com', message: 'A message long enough to satisfy the schema.', read: true, starred: true },
    { name: 'Bob', email: 'bob@example.com', message: 'Another message long enough for the schema.' },
  ]);
  // PF-143 — a published certificate with a PDF-page picture, renamed after
  // publishing (its shared address must survive), and two education entries.
  const cert = media('certificates/oracle');
  await Certificate.create([
    {
      title: 'Cloud Foundations', issuer: 'Oracle', issued: '2025-06', published: true, order: 0,
      verifyUrl: 'https://example.com/verify/1',
      image: { url: cert.url.replace('/upload/', '/upload/pg_1,f_auto,q_auto/'), publicId: cert.id, format: 'pdf' },
    },
    { title: 'Draft certificate', order: 1 },
  ]);
  await Certificate.collection.updateOne({ slug: 'cloud-foundations-oracle' }, { $set: { title: 'Renamed cert' } });
  await Education.create([
    { school: 'Westminster', degree: 'BSc', start: '2022-09', end: '2026', published: true, order: 0 },
    { school: 'Draft school', start: '2019', end: '2021', order: 1 },
  ]);
};

let sendMail;
beforeAll(connectTestDB);
beforeEach(async () => {
  process.env.CLOUDINARY_FOLDER = FOLDER;
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
  sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
  user    = await User.create({ email: 'owner@example.com', password: PASSWORD });
  session = await issueSession(user, { signInMethod: 'password', device: 'Chrome on macOS' });
});
afterEach(async () => {
  process.env = { ...ORIGINAL };
  jest.restoreAllMocks();
  await clearDB();
});
afterAll(disconnectTestDB);

describe('the round trip', () => {
  it('download → restore → download gives the same file: ids, dates, drafts, slugs, media', async () => {
    await seedContent();
    const before = await download();

    const res = await restore(before);
    expect(res.status).toBe(200);
    const after = await download();

    expect(content(after)).toEqual(content(before));
    expect(after.blog.find((p) => p.title === 'Renamed later').slug).toBe('original-title');
    expect(after.blog.find((p) => p.title === 'Renamed later').publishedAt).toBe('2026-01-02T03:04:05.000Z');
    // PF-143 — both new lists travel, and a certificate keeps its address.
    expect(after.counts).toMatchObject({ education: 2, certificates: 2 });
    expect(after.certificates.find((c) => c.title === 'Renamed cert').slug).toBe('cloud-foundations-oracle');
  });

  it('brings the site back to the backup — rows added since go, rows deleted since return', async () => {
    await seedContent();
    const file = await download();
    const wanted = await state();

    await Project.deleteOne({ title: 'Live project' });
    await Project.create({ title: 'Added later', description: 'A valid test project description, added later.', tech: ['Go'], githubUrl: 'https://github.com/test/x' });
    await Skill.deleteMany({});
    await SkillCategory.updateOne({ key: 'devops' }, { label: 'Changed' });
    await About.updateOne({}, { title: 'Changed' });

    expect((await restore(file)).status).toBe(200);
    const now = await state();
    expect({ ...now, messages: null }).toEqual({ ...wanted, messages: null });
  });
});

describe('messages are merged, never lost (owner, 2026-10-30)', () => {
  it('newer messages stay, deleted ones return, current read/star is untouched', async () => {
    await seedContent();
    const file = await download();

    await Contact.deleteOne({ name: 'Bob' });
    await Contact.updateOne({ name: 'Ada' }, { read: false, starred: false });
    await Contact.create({ name: 'Cleo', email: 'cleo@example.com', message: 'Arrived after the backup was made.' });

    const res = await restore(file);
    expect(res.status).toBe(200);
    expect(res.body.data.messagesAdded).toBe(1);

    const messages = await Contact.find().sort({ name: 1 }).lean();
    expect(messages.map((m) => m.name)).toEqual(['Ada', 'Bob', 'Cleo']);
    expect(messages[0]).toMatchObject({ read: false, starred: false });
  });
});

describe('safety copies — the undo', () => {
  it('each restore keeps a copy of what it replaced; restoring that copy undoes it', async () => {
    await seedContent();
    const original = await state();
    const file = await download();
    await Project.deleteMany({});
    const changed = await state();

    await restore(file);
    const list = await auth(request(app).get('/api/backup/safety'));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].counts).toMatchObject({ projects: 0, blog: 2 });
    expect(JSON.stringify(list.body)).not.toContain('Renamed later');   // no content in the list

    const copy = await auth(request(app).post(`/api/backup/safety/${list.body.data[0].id}`)).send({ password: PASSWORD });
    expect(copy.status).toBe(200);
    expect((await restore(copy.body.data)).status).toBe(200);
    expect(await state()).toEqual(changed);
    expect(original.projects).toHaveLength(2);
  });

  it(`keeps the newest ${SAFETY_COPIES}`, async () => {
    await seedContent();
    const file = await download();
    for (let i = 0; i < SAFETY_COPIES + 1; i += 1) expect((await restore(file)).status).toBe(200);
    const ids = (await BackupSnapshot.find().sort({ createdAt: 1, _id: 1 }).lean()).map((s) => String(s._id));
    const listed = (await auth(request(app).get('/api/backup/safety'))).body.data.map((s) => String(s.id));

    expect(ids).toHaveLength(SAFETY_COPIES);
    expect(listed).toEqual([...ids].reverse());
  });

  it('a safety copy needs the password, and a missing one is 404', async () => {
    await seedContent();
    await restore(await download());
    const [{ id }] = (await auth(request(app).get('/api/backup/safety'))).body.data;

    expect((await auth(request(app).post(`/api/backup/safety/${id}`)).send({ password: 'wrong' })).status).toBe(400);
    expect((await auth(request(app).post(`/api/backup/safety/${new mongoose.Types.ObjectId()}`)).send({ password: PASSWORD })).status).toBe(404);
    expect((await auth(request(app).post('/api/backup/safety/not-an-id')).send({ password: PASSWORD })).status).toBe(404);
  });
});

describe('POST /api/backup/restore/check — the preview changes nothing', () => {
  it('answers the summary and writes nothing', async () => {
    await seedContent();
    const file = await download();
    await Project.deleteMany({});
    const before = await state();

    const res = await check(file);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      createdAt: file.createdAt, version: 2, hasAbout: true,
      counts: {
        projects: 2, skills: 2, skillCategories: 2, blog: 2, vocabulary: 2, messages: 2, education: 2, certificates: 2,
      },
    });
    expect(await state()).toEqual(before);
    expect(await BackupSnapshot.countDocuments()).toBe(0);
  });
});

describe('a file that cannot be restored is refused — and NOTHING changes', () => {
  let good;
  beforeEach(async () => {
    await seedContent();
    good = await download();
  });
  const edited = (change) => { const f = JSON.parse(JSON.stringify(good)); change(f); return f; };

  const cases = [
    ['not JSON at all', () => '{ this is not json', /could not be read as a backup/],
    ['another kind of file', () => ({ hello: 'world' }), /not a portfolio backup file/],
    ['a $ operator key', () => edited((f) => { f.projects[0].tech = { $where: 'x' }; }), /key the site never writes \(“projects\[0\]\.tech\.\$where”\)/],
    ['a __proto__ key', () => JSON.stringify(good).replace('"about":{', '"about":{"__proto__":{"admin":true},'), /key the site never writes \(“about\.__proto__”\)/],
    ['a newer version', () => edited((f) => { f.version = VERSION + 1; }), /made by a newer version/],
    ['no version', () => edited((f) => { delete f.version; }), /no valid version/],
    ['a newer database', () => edited((f) => { f.schema.migrations = ['999-future.js']; }), /database update this site has not had yet \(999-future\.js\)/],
    ['counts that do not match', () => edited((f) => { f.projects.pop(); }), /“projects” list should have 2 rows but has 1/],
    ['a missing list', () => edited((f) => { delete f.skills; }), /“skills” list is missing/],
    ['too many rows', () => edited((f) => { f.vocabulary = Array(MAX_ROWS + 1).fill({}); f.counts.vocabulary = MAX_ROWS + 1; }), /more than 5000 rows/],
    ['a bad id', () => edited((f) => { f.skills[0]._id = 'nope'; }), /^Skill 1 \(“Git”\): _id — not a valid id$/],
    ['the same id twice', () => edited((f) => { f.blog[1]._id = f.blog[0]._id; }), /Blog post 2 \(“Draft post”\): _id — appears twice/],
    ['a row its model refuses', () => edited((f) => { f.blog[0].title = ''; }), /^Blog post 1: title — /],
    ['a wrong type', () => edited((f) => { f.messages[0].read = 'maybe'; }), /^Message 1 \(“Ada”\): read — /],
    ['two posts at one URL', () => edited((f) => { f.blog[1].slug = f.blog[0].slug; }), /Blog post 2 \(“Draft post”\): the same as Blog post 1/],
    // PF-143 — refused as a PROBLEM, before the transaction's unique index could.
    ['two certificates at one address', () => edited((f) => { f.certificates[1].slug = f.certificates[0].slug; }), /Certificate 2 \(“Draft certificate”\): the same as Certificate 1/],
    ['a skill in a missing section', () => edited((f) => { f.skillCategories.shift(); f.counts.skillCategories = 1; }), /Skill 1 \(“Git”\): category — the section “devops” is not in the file/],
    // Each media case breaks ONE rule while the link still names the file id,
    // so only that rule can refuse it (the first version of these cases was
    // also caught by the id-in-link rule — mutation testing showed it).
    ['media on another host', () => edited((f) => { f.projects[0].backgroundImage.src = `https://evil.example/image/upload/v1/${FOLDER}/project-bg.webp`; }), /Project 1 \(“Live project”\): backgroundImage — the file link is not one this site uploaded/],
    ['media in another Cloudinary account', () => edited((f) => { f.projects[0].backgroundImage.src = `https://res.cloudinary.com/someone-else/image/upload/v1/${FOLDER}/project-bg.webp`; }), /Project 1 \(“Live project”\): backgroundImage — the file link/],
    ['media over plain http', () => edited((f) => { f.projects[0].backgroundImage.src = `http://res.cloudinary.com/${CLOUD}/image/upload/v1/${FOLDER}/project-bg.webp`; }), /Project 1 \(“Live project”\): backgroundImage — the file link/],
    ['a file outside our folder', () => edited((f) => { f.about.resume.publicId = 'other/resume'; f.about.resume.url = `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/other/resume`; }), /About: resume — the file link is not one this site uploaded/],
    ['a link that names another file', () => edited((f) => { f.about.resume.url = `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/${FOLDER}/someone-else`; }), /About: resume — the file link/],
    ['a link with no file id', () => edited((f) => { f.about.resume.publicId = ''; }), /About: resume — the file link/],
  ];

  it.each(cases)('%s → 422 with the reason, on check AND restore', async (_name, make, reason) => {
    const before = await state();
    const checked = await check(make());
    const restored = await restore(make());

    for (const res of [checked, restored]) {
      expect(res.status).toBe(422);
      expect(res.body.message).toBe('This backup cannot be restored. Nothing was changed.');
      expect(res.body.problems.some((p) => reason.test(p))).toBe(true);
    }
    expect(await state()).toEqual(before);
    expect(await BackupSnapshot.countDocuments()).toBe(0);
  });

  it('lists at most 20 problems, then counts the rest', async () => {
    const f = edited((x) => { x.messages = Array.from({ length: 25 }, () => ({ _id: new mongoose.Types.ObjectId().toString() })); x.counts.messages = 25; });
    const { problems } = (await check(f)).body;

    expect(problems).toHaveLength(21);
    expect(problems[20]).toMatch(/^…and \d+ more$/);
  });

  it('a field the site does not have is dropped, never written', async () => {
    const f = edited((x) => { x.projects[0].isAdmin = true; x.about.extra = 'x'; });
    expect((await restore(f)).status).toBe(200);
    const raw = await Project.collection.findOne({ title: 'Live project' });

    expect(raw).not.toHaveProperty('isAdmin');
    expect(await About.collection.findOne({})).not.toHaveProperty('extra');
  });

  // PF-137: a backup taken while posts still carried `content` restores
  // cleanly, and the removed field does not come back with it.
  it('an old file whose posts carry the removed content field restores without it', async () => {
    const f = edited((x) => { x.blog[0].content = 'Legacy markdown body.'; });
    expect((await restore(f)).status).toBe(200);

    expect(await Blog.collection.countDocuments({ content: { $exists: true } })).toBe(0);
    expect(await Blog.collection.countDocuments()).toBe(2);
  });
});

describe('who may restore', () => {
  it('every route refuses without a session', async () => {
    const calls = [
      request(app).post('/api/backup/restore/check'),
      request(app).post('/api/backup/restore'),
      request(app).get('/api/backup/safety'),
      request(app).post(`/api/backup/safety/${new mongoose.Types.ObjectId()}`),
    ];
    for (const call of calls) expect((await call).status).toBe(401);
  });

  it('a wrong password is 400 (never 401), logged, and changes nothing', async () => {
    await seedContent();
    const file = await download();
    await Project.deleteMany({});
    const before = await state();

    const res = await restore(file, 'not-the-password');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your password is wrong.');
    expect(await state()).toEqual(before);
    expect(await SignInEvent.find({ kind: 'backup-restore' }).select('outcome -_id').lean()).toEqual([{ outcome: 'failed' }]);
  });

  it('no password, or no file, is refused before anything is read', async () => {
    await seedContent();
    const file = await download();
    const noPassword = await auth(request(app).post('/api/backup/restore')).attach('file', asFile(file), 'backup.json');
    const noFile = await auth(request(app).post('/api/backup/restore')).field('password', PASSWORD);

    expect(noPassword.status).toBe(400);
    expect(noFile.status).toBe(400);
    expect(noFile.body.message).toBe('Choose a backup file to restore.');
  });

  it('an image is refused by the upload filter (415), a file over 4 MB by its size (413)', async () => {
    const png = await auth(request(app).post('/api/backup/restore/check'))
      .attach('file', Buffer.from('x'), { filename: 'photo.png', contentType: 'image/png' });
    const huge = await check('x'.repeat(4 * 1024 * 1024 + 1));

    expect(png.status).toBe(415);
    expect(huge.status).toBe(413);
  });

  it('the limiter stops the 11th try from one place', async () => {
    const from = nextIp();
    const tries = [];
    for (let i = 0; i < 11; i += 1) {
      tries.push((await request(app).post('/api/backup/restore')
        .set('Authorization', `Bearer ${session.accessToken}`).set('X-Forwarded-For', from)
        .field('password', 'wrong').attach('file', asFile('{}'), 'b.json')).status);
    }
    expect(tries.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(tries[10]).toBe(429);
  });
});

describe('all or nothing', () => {
  it('a failure after the old content was deleted rolls EVERYTHING back — the safety copy too', async () => {
    await seedContent();
    const file = await download();
    await Project.deleteMany({});
    const before = await state();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Blog.collection, 'insertMany').mockRejectedValueOnce(new Error('disk full'));

    const res = await restore(file);
    expect(res.status).toBe(500);
    expect(await state()).toEqual(before);
    expect(await BackupSnapshot.countDocuments()).toBe(0);
  });

  it('a database without transactions answers 503 and changes nothing', async () => {
    await seedContent();
    const file = await download();
    const before = await state();
    jest.spyOn(mongoose, 'startSession').mockResolvedValueOnce({
      withTransaction: () => Promise.reject(new Error('Transaction numbers are only allowed on a replica set member or mongos')),
      endSession: async () => {},
    });

    const res = await restore(file);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Nothing was changed/);
    expect(await state()).toEqual(before);
  });
});

describe('after a restore', () => {
  it('it is logged, and the owner is emailed when mail is on', async () => {
    process.env.GMAIL_USER = 'owner@example.com';
    process.env.GMAIL_APP_PASSWORD = 'abcdabcdabcdabcd';
    await seedContent();
    expect((await restore(await download())).status).toBe(200);

    expect(await SignInEvent.find({ kind: 'backup-restore' }).select('outcome -_id').lean()).toEqual([{ outcome: 'ok' }]);
    for (let i = 0; i < 50 && sendMail.mock.calls.length === 0; i += 1) await new Promise((r) => setTimeout(r, 20));
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Your site was restored from a backup');
    expect(mail.text).toMatch(/2 brought back|0 brought back/);
  });

  it('with mail off nothing is sent and the restore still succeeds', async () => {
    await seedContent();
    expect((await restore(await download())).status).toBe(200);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});

describe('the format', () => {
  // Guard 2 of the restore standard: a ticket that changes the file adds an
  // upgrade step for older files AND bumps the version — never one alone.
  it('VERSION is one more than the number of upgrade steps', () => {
    expect(VERSION).toBe(UPGRADES.length + 1);
  });

  // PF-143 — version 1 had no Education or Certificates. A v1 file is the
  // site as it was then, so restoring it leaves both lists EMPTY.
  it('a version 1 file (before Education + Certificates) restores with both lists empty', async () => {
    await seedContent();
    const { education: _e, certificates: _c, ...v1 } = await download();
    v1.version = 1;
    v1.counts = Object.fromEntries(Object.entries(v1.counts).filter(([k]) => !['education', 'certificates'].includes(k)));

    const res = await restore(v1);
    expect(res.status).toBe(200);
    expect(await Education.countDocuments()).toBe(0);
    expect(await Certificate.countDocuments()).toBe(0);
    expect(await Project.countDocuments()).toBe(2);
  });

  it('a file from an OLDER database (fewer migrations) is accepted', async () => {
    await seedContent();
    const file = await download();
    await Migration.create({ name: '011-later.js', checksum: 'x' });

    expect((await check(file)).status).toBe(200);
  });
});
