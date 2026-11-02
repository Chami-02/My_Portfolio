// PF-135 — POST /api/backup, the Settings Backup card's download. Through the
// real route, `protect`, limiter, controller and models — nothing mocked.
const fs       = require('fs');
const path     = require('path');
const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User          = require('../models/User');
const About         = require('../models/About');
const Project       = require('../models/Project');
const Skill         = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const Blog          = require('../models/Blog');
const Vocabulary    = require('../models/Vocabulary');
const Contact       = require('../models/Contact');
const { issueSession } = require('../services/sessionService');
const SignInEvent   = require('../models/SignInEvent');
const { BACKED_UP, NEVER_BACKED_UP } = require('../services/backupFile');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const PASSWORD = 'Owner-Password-123';

// backupLimiter (10 / 15 min) is live under test — each case gets its own IP.
let ip = 0;
const nextIp = () => `10.135.${Math.floor(++ip / 250)}.${ip % 250}`;

let session;

const backup = (body, { token = session.accessToken, from = nextIp() } = {}) => {
  const req = request(app).post('/api/backup').set('X-Forwarded-For', from);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
};

const seedContent = () => Promise.all([
  About.create({ name: 'Owner', title: 'Developer' }),
  Project.create({
    title:       'Draft project',
    description: 'A valid test project description for the backup suite.',
    tech:        ['JavaScript'],
    githubUrl:   'https://github.com/test/backup',
    published:   false,
  }),
  Skill.create({ name: 'Git', category: 'devops', level: 'beginner', order: 1 }),
  SkillCategory.create({ key: 'devops', label: 'DevOps', order: 1 }),
  Blog.create({
    title:     'Draft post',
    excerpt:   'An excerpt for the backup suite.',
    sections:  [{ heading: 'Intro', body: ['Some text.'], bullets: [] }],
    published: false,
  }),
  Vocabulary.create({ type: 'tag', value: 'testing' }),
  Contact.create({
    name:    'Visitor',
    email:   'visitor@example.com',
    message: 'A message long enough to satisfy the schema minimum.',
  }),
]);

beforeAll(connectTestDB);
beforeEach(async () => {
  const user = await User.create({ email: 'owner@example.com', password: PASSWORD });
  session = await issueSession(user, { signInMethod: 'password', device: 'Chrome on macOS' });
});
afterEach(clearDB);
afterAll(disconnectTestDB);

describe('POST /api/backup — who may download', () => {
  it('refuses without a session', async () => {
    expect((await backup({ password: PASSWORD }, { token: null })).status).toBe(401);
  });

  it('a wrong password is 400, never 401 — a 401 would sign the client out — and is logged', async () => {
    const res = await backup({ password: 'not-the-password' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your password is wrong.');
    expect(res.body.data).toBeUndefined();
    expect(await SignInEvent.find({ kind: 'backup-download' }).select('outcome -_id').lean())
      .toEqual([{ outcome: 'failed' }]);
  });

  it.each([
    ['missing', {}],
    ['empty', { password: '' }],
    ['an array', { password: [PASSWORD] }],
  ])('a %s password is refused before the database is read', async (_name, body) => {
    const res = await backup(body);

    expect(res.status).toBe(400);
    expect(res.body.data).toBeUndefined();
  });

  it('the limiter stops the 11th try from one place', async () => {
    const from = nextIp();
    for (let i = 0; i < 10; i += 1) {
      expect((await backup({ password: 'wrong' }, { from })).status).toBe(400);
    }
    const res = await backup({ password: PASSWORD }, { from });

    expect(res.status).toBe(429);
    expect(res.body.data).toBeUndefined();
  });
});

describe('POST /api/backup — what is in the file', () => {
  // ⚠️ The zero case: every list present and empty, About null. A controller
  // that invented rows, or dropped an empty key, fails here.
  it('an empty site gives every key, empty', async () => {
    const res = await backup({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.problems).toEqual([]);
    expect(res.body.data).toMatchObject({
      format: 'portfolio-backup',
      version: 2,
      schema: { migrations: [] },
      about: null,
      counts: {
        projects: 0, skills: 0, skillCategories: 0, blog: 0, vocabulary: 0, messages: 0, education: 0, certificates: 0,
      },
      projects: [], skills: [], skillCategories: [], blog: [], vocabulary: [], messages: [], education: [], certificates: [],
    });
    expect(Number.isNaN(Date.parse(res.body.data.createdAt))).toBe(false);
  });

  it('holds every content collection — drafts and unread messages too', async () => {
    await seedContent();
    const { data } = (await backup({ password: PASSWORD })).body;

    expect(Object.keys(data).sort()).toEqual([
      'about', 'blog', 'certificates', 'counts', 'createdAt', 'education', 'format', 'messages', 'projects',
      'schema', 'skillCategories', 'skills', 'version', 'vocabulary',
    ]);
    expect(data.counts).toEqual({
      projects: 1, skills: 1, skillCategories: 1, blog: 1, vocabulary: 1, messages: 1, education: 0, certificates: 0,
    });
    expect(data.about).toMatchObject({ name: 'Owner', title: 'Developer' });
    expect(data.projects[0]).toMatchObject({ title: 'Draft project', published: false });
    expect(data.blog[0]).toMatchObject({ title: 'Draft post', published: false });
    expect(data.messages[0]).toMatchObject({ email: 'visitor@example.com', read: false });
    expect(data.skills[0].name).toBe('Git');
    expect(data.skillCategories[0].key).toBe('devops');
    expect(data.vocabulary[0].value).toBe('testing');
    // Kept so a future restore can match rows; Mongoose's version key is not.
    expect(data.projects[0]).toHaveProperty('_id');
    expect(data.projects[0]).toHaveProperty('createdAt');
    expect(JSON.stringify(data)).not.toMatch(/"__v"/);
  });

  it('never holds the account, its password, sessions or codes', async () => {
    await seedContent();
    const text = JSON.stringify((await backup({ password: PASSWORD })).body);

    expect(text).not.toContain('owner@example.com');
    expect(text).not.toMatch(/\$2[aby]\$/);                     // a bcrypt hash
    expect(text).not.toMatch(/tokenHash|refresh|codeHash|"family"/i);
    expect(text).not.toContain('Chrome on macOS');               // the session row
  });
});

describe('POST /api/backup — the file checks itself (restore guard 1)', () => {
  it('a good site: no problems, the download is logged', async () => {
    await seedContent();
    const res = await backup({ password: PASSWORD });

    expect(res.body.problems).toEqual([]);
    expect(await SignInEvent.find({ kind: 'backup-download' }).select('outcome -_id').lean())
      .toEqual([{ outcome: 'ok' }]);
  });

  it('a row today\'s rules refuse is named — and the file is still sent', async () => {
    await seedContent();
    // Legacy data, written around the validators as an old row would be.
    await Blog.collection.updateOne({}, { $set: { title: '' } });
    const res = await backup({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.blog).toHaveLength(1);
    expect(res.body.problems).toEqual([expect.stringMatching(/^Blog post 1: title — /)]);
  });

  it('names the migrations this database has run', async () => {
    const Migration = require('../models/Migration');
    await Migration.create([{ name: '002-b.js', checksum: 'x' }, { name: '001-a.js', checksum: 'y' }]);

    expect((await backup({ password: PASSWORD })).body.data.schema).toEqual({ migrations: ['001-a.js', '002-b.js'] });
  });
});

describe('the allow-list', () => {
  // A new model must be put on ONE list: a content collection left off would
  // silently go missing from every backup, a secret one put on would leak.
  it('names every model exactly once', () => {
    const files = fs.readdirSync(path.join(__dirname, '..', 'models')).filter((f) => f.endsWith('.js'));
    files.forEach((f) => require(path.join(__dirname, '..', 'models', f)));
    const models = mongoose.modelNames().sort();
    const listed = [...Object.keys(BACKED_UP), ...NEVER_BACKED_UP].sort();

    expect(listed).toEqual(models);
    expect(new Set(listed).size).toBe(listed.length);
  });
});
