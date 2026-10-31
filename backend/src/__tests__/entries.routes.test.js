// PF-143 — /api/certificates and /api/education: the draft rule, the field
// allow-list, slugs, ordering and the picture route. Through the real app;
// only Cloudinary is mocked.
jest.mock('../services/storage', () => ({
  isConfigured: jest.fn(() => true),
  upload:       jest.fn(),
  destroy:      jest.fn(),
}));

const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app         = require('../app');
const Certificate = require('../models/Certificate');
const Education   = require('../models/Education');
const User        = require('../models/User');
const storage     = require('../services/storage');
const { pictureFrom } = require('../controllers/entryController');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
});
afterAll(disconnectTestDB);

const authHeader = async () => {
  let user = await User.findOne({ email: 'admin@test.com' });
  if (!user) user = await User.create({ email: 'admin@test.com', password: 'TestPass@1234!' });
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const PDF = Buffer.from('%PDF-1.4\n%fake\n', 'latin1');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'latin1');

const cloudinaryAnswer = (id, format = 'png') => ({
  url:      `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/portfolio/certificates/${id}.${format}`,
  publicId: `portfolio/certificates/${id}`,
  bytes:    100,
  format,
  width:    1200,
  height:   900,
});

const PUBLISHED_CERT = { title: 'Cloud Foundations', issuer: 'Oracle', issued: '2025-06', published: true };

describe('who may write', () => {
  it.each([
    ['post',   '/api/certificates'],
    ['put',    '/api/certificates/reorder'],
    ['put',    '/api/certificates/507f1f77bcf86cd799439011'],
    ['delete', '/api/certificates/507f1f77bcf86cd799439011'],
    ['put',    '/api/certificates/507f1f77bcf86cd799439011/image'],
    ['delete', '/api/certificates/507f1f77bcf86cd799439011/image'],
    ['get',    '/api/certificates/admin/all'],
    ['post',   '/api/education'],
    ['put',    '/api/education/507f1f77bcf86cd799439011'],
    ['delete', '/api/education/507f1f77bcf86cd799439011'],
    ['put',    '/api/education/507f1f77bcf86cd799439011/logo'],
    ['delete', '/api/education/507f1f77bcf86cd799439011/logo'],
    ['get',    '/api/education/admin/all'],
  ])('%s %s without a session is 401', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });
});

describe('the public list', () => {
  it('shows only PUBLISHED entries, in the owner\'s order, CDN-cacheable', async () => {
    await Certificate.create([
      { ...PUBLISHED_CERT, title: 'Second', order: 2 },
      { title: 'A draft', order: 0 },
      { ...PUBLISHED_CERT, title: 'First', order: 1 },
    ]);

    const res = await request(app).get('/api/certificates');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.title)).toEqual(['First', 'Second']);
    expect(res.headers['vercel-cache-tag']).toBe('public-data');
  });

  it('the admin list shows drafts too', async () => {
    await Certificate.create([{ title: 'A draft' }, PUBLISHED_CERT]);
    const res = await request(app).get('/api/certificates/admin/all').set(await authHeader());
    expect(res.body.data).toHaveLength(2);
  });
});

describe('a new entry is a draft (owner rule)', () => {
  it('a title alone saves, unpublished, at the END of the list', async () => {
    await Certificate.create({ ...PUBLISHED_CERT, order: 4 });
    const res = await request(app).post('/api/certificates').set(await authHeader()).send({ title: 'GitHub Foundations' });
    expect(res.status).toBe(201);
    expect(res.body.data.published).toBe(false);
    expect(res.body.data.order).toBe(5);
  });

  it('publishing needs an issuer and an issue date', async () => {
    const res = await request(app).post('/api/certificates').set(await authHeader())
      .send({ title: 'X', published: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Issuer is required/);
    expect(res.body.message).toMatch(/Issue date is required/);
  });

  it('an education entry needs school, start AND end on every save — drafts too (owner, 2026-10-31)', async () => {
    const auth = await authHeader();
    const res = await request(app).post('/api/education').set(auth).send({ school: 'Westminster' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Start date is required/);
    expect(res.body.message).toMatch(/End date is required/);
    expect((await request(app).post('/api/education').set(auth).send({ school: 'W', start: '2019', end: '2021' })).status).toBe(201);
  });

  it('a school website is optional, and https only', async () => {
    const auth = await authHeader();
    const base = { school: 'W', start: '2019', end: '2021' };
    const ok = await request(app).post('/api/education').set(auth).send({ ...base, website: 'https://www.westminster.ac.uk' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.website).toBe('https://www.westminster.ac.uk');
    const bad = await request(app).post('/api/education').set(auth).send({ ...base, website: 'http://example.com' });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/School website/);
  });

  it('the degree is optional, even to publish (owner, 2026-10-31)', async () => {
    const res = await request(app).post('/api/education').set(await authHeader())
      .send({ school: 'W', start: '2019', end: '2021', published: true });
    expect(res.status).toBe(201);
  });
});

describe('only the named fields, each as its own type', () => {
  it('an array where text belongs is refused, nothing written (the zero case)', async () => {
    const res = await request(app).post('/api/certificates').set(await authHeader()).send({ title: ['a', 'b'] });
    expect(res.status).toBe(400);
    expect(await Certificate.countDocuments()).toBe(0);
  });

  it('the picture and the slug cannot be written through a save', async () => {
    const auth = await authHeader();
    const c = await Certificate.create(PUBLISHED_CERT);
    const res = await request(app).put(`/api/certificates/${c._id}`).set(auth).send({
      image: { url: 'https://evil.example/x.png', publicId: 'someone-else/file' },
      'image.publicId': 'someone-else/file',
      slug: 'hijacked',
      $rename: { title: 'gone' },
    });
    expect(res.status).toBe(200);
    const after = await Certificate.findById(c._id).lean();
    expect(after.image.publicId).toBe('');
    expect(after.slug).toBe('cloud-foundations-oracle');
    expect(after.title).toBe('Cloud Foundations');
  });

  it('a verify link must be https', async () => {
    const res = await request(app).post('/api/certificates').set(await authHeader())
      .send({ title: 'X', verifyUrl: 'http://example.com/v' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/https/);
  });

  it('an education entry keeps no skills and no proof link (owner, 2026-10-31)', async () => {
    const res = await request(app).post('/api/education').set(await authHeader())
      .send({ school: 'S', start: '2019', end: '2021', skills: ['Java'], proofUrl: 'https://example.com/p' });
    expect(res.status).toBe(201);
    const stored = (await Education.findById(res.body.data._id)).toObject();
    expect(stored).not.toHaveProperty('skills');
    expect(stored).not.toHaveProperty('proofUrl');
  });
});

describe('dates', () => {
  it.each([
    ['2025-06', '2026',    201],
    ['2025-06', '2025',    201],   // same year, coarser end: fine
    ['2025-06', '2025-05', 400],
    ['2025',    '2024-12', 400],
    ['2025-13', '2026',    400],   // no month 13
    ['25',      '2026',    400],
    ['2008-05-04', '2021',    201],   // an optional day (owner, 2026-10-31)
    ['2008-05-04', '2008-05', 201],   // same month, coarser end: fine
    ['2008-05-04', '2008-05-03', 400],
    ['2008-04-31', '2021',    400],   // no 31 APR
    ['2024-02-29', '2025',    201],   // a leap day
    ['2025-02-29', '2026',    400],
    ['2008-05-4',  '2021',    400],   // two-digit day only
  ])('start %s, end %s → %i', async (start, end, status) => {
    const res = await request(app).post('/api/education').set(await authHeader()).send({ school: 'S', start, end });
    expect(res.status).toBe(status);
  });
});

describe('where a new entry goes', () => {
  it('a new education entry takes its place BY DATE, newest on top (owner, 2026-10-31)', async () => {
    const auth = await authHeader();
    const add = (school, start, end) => request(app).post('/api/education').set(auth).send({ school, start, end });
    await add('Uni', '2022-09', '2027-06');
    await add('Primary', '2003', '2008');
    await add('High school', '2008-05-04', '2021');   // between the two
    await add('Masters', '2027', '2028');              // newest: the top
    await add('Same end, later start', '2009', '2021');
    const list = (await request(app).get('/api/education/admin/all').set(auth)).body.data;
    expect(list.map((e) => e.school)).toEqual(['Masters', 'Uni', 'Same end, later start', 'High school', 'Primary']);
    expect(list.map((e) => e.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('the order stays editable: a dragged order is kept, and only a NEW entry is placed by date', async () => {
    const auth = await authHeader();
    const a = await Education.create({ school: 'Old', start: '2003', end: '2008', order: 0 });   // dragged on top
    const b = await Education.create({ school: 'New', start: '2022', end: '2027', order: 1 });
    await request(app).post('/api/education').set(auth).send({ school: 'Middle', start: '2009', end: '2021' });
    const list = (await request(app).get('/api/education/admin/all').set(auth)).body.data;
    // Placed above the first entry it is newer than ("Old"), the rest untouched.
    expect(list.map((e) => e.school)).toEqual(['Middle', 'Old', 'New']);
    expect(String(list[1]._id)).toBe(String(a._id));
    expect(String(list[2]._id)).toBe(String(b._id));
  });

  it('a new certificate still goes to the end', async () => {
    const auth = await authHeader();
    await request(app).post('/api/certificates').set(auth).send({ title: 'First' });
    await request(app).post('/api/certificates').set(auth).send({ title: 'Second' });
    const list = (await request(app).get('/api/certificates/admin/all').set(auth)).body.data;
    expect(list.map((c) => c.title)).toEqual(['First', 'Second']);
  });
});

describe('the shareable address (slug)', () => {
  it('is made from title + issuer, and kept unique', async () => {
    const a = await Certificate.create(PUBLISHED_CERT);
    const b = await Certificate.create(PUBLISHED_CERT);
    expect(a.slug).toBe('cloud-foundations-oracle');
    expect(b.slug).toBe('cloud-foundations-oracle-2');
  });

  it('follows a rename while a DRAFT, and never changes once published', async () => {
    const auth = await authHeader();
    const draft = await Certificate.create({ title: 'GitHub Foundations' });
    expect(draft.slug).toBe('github-foundations');

    await request(app).put(`/api/certificates/${draft._id}`).set(auth).send({ issuer: 'GitHub' });
    expect((await Certificate.findById(draft._id)).slug).toBe('github-foundations-github');

    // A rename whose new slug is the one it ALREADY has keeps it — no "-2"
    // from colliding with itself.
    await request(app).put(`/api/certificates/${draft._id}`).set(auth).send({ title: 'github foundations' });
    expect((await Certificate.findById(draft._id)).slug).toBe('github-foundations-github');

    const live = await Certificate.create(PUBLISHED_CERT);
    await request(app).put(`/api/certificates/${live._id}`).set(auth).send({ title: 'Renamed' });
    expect((await Certificate.findById(live._id)).slug).toBe('cloud-foundations-oracle');
  });
});

describe('PUT /reorder', () => {
  it('writes the new order', async () => {
    const [a, b, c] = await Certificate.create([{ title: 'A', order: 0 }, { title: 'B', order: 1 }, { title: 'C', order: 2 }]);
    const res = await request(app).put('/api/certificates/reorder').set(await authHeader())
      .send({ ids: [c._id, a._id, b._id].map(String) });
    expect(res.status).toBe(200);
    expect(res.body.data.map((x) => x.title)).toEqual(['C', 'A', 'B']);
  });

  it.each([
    ['one missing', (ids) => ids.slice(1)],
    ['one twice',   (ids) => [ids[0], ids[0], ids[1]]],
    ['an unknown extra', (ids) => [...ids, '507f1f77bcf86cd799439011']],
  ])('refuses a list with %s, and changes nothing', async (_name, edit) => {
    const docs = await Certificate.create([{ title: 'A', order: 0 }, { title: 'B', order: 1 }, { title: 'C', order: 2 }]);
    const res = await request(app).put('/api/certificates/reorder').set(await authHeader())
      .send({ ids: edit(docs.map((d) => String(d._id))) });
    expect(res.status).toBe(400);
    expect((await Certificate.find().sort({ order: 1 })).map((x) => x.title)).toEqual(['A', 'B', 'C']);
  });
});

describe('the picture', () => {
  it('stores an image, and replacing it deletes the old file', async () => {
    const auth = await authHeader();
    const c = await Certificate.create(PUBLISHED_CERT);
    storage.upload.mockResolvedValueOnce(cloudinaryAnswer('one')).mockResolvedValueOnce(cloudinaryAnswer('two'));
    storage.destroy.mockResolvedValue({ result: 'ok' });

    await request(app).put(`/api/certificates/${c._id}/image`).set(auth).attach('file', PNG, 'c.png');
    const res = await request(app).put(`/api/certificates/${c._id}/image`).set(auth).attach('file', PNG, 'c.png');

    expect(res.status).toBe(200);
    expect(res.body.data.entry.image.publicId).toBe('portfolio/certificates/two');
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/certificates/one', 'image');
    expect(storage.upload).toHaveBeenCalledWith(expect.any(Buffer), { resourceType: 'image', folder: 'portfolio/certificates' });
  });

  it('a PDF is shown as its first page, as an image link', async () => {
    const c = await Certificate.create(PUBLISHED_CERT);
    storage.upload.mockResolvedValue(cloudinaryAnswer('cert', 'pdf'));
    const res = await request(app).put(`/api/certificates/${c._id}/image`).set(await authHeader()).attach('file', PDF, 'c.pdf');
    expect(res.status).toBe(200);
    expect(res.body.data.entry.image.url)
      .toBe('https://res.cloudinary.com/demo/image/upload/pg_1,f_auto,q_auto/v1/portfolio/certificates/cert.jpg');
    expect(res.body.data.entry.image.format).toBe('pdf');
  });

  it('the bytes decide: an SVG named .png is refused before any upload', async () => {
    const c = await Certificate.create(PUBLISHED_CERT);
    const res = await request(app).put(`/api/certificates/${c._id}/image`).set(await authHeader())
      .attach('file', SVG, { filename: 'c.png', contentType: 'image/png' });
    expect(res.status).toBe(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('an education LOGO uses its own route and folder', async () => {
    const e = await Education.create({ school: 'S', start: '2019', end: '2021' });
    storage.upload.mockResolvedValue(cloudinaryAnswer('logo'));
    const res = await request(app).put(`/api/education/${e._id}/logo`).set(await authHeader()).attach('file', PNG, 'l.png');
    expect(res.status).toBe(200);
    expect(storage.upload).toHaveBeenCalledWith(expect.any(Buffer), { resourceType: 'image', folder: 'portfolio/education' });
    expect((await Education.findById(e._id)).logo.url).toMatch(/^https:/);
  });

  it('a logo is a picture only — a PDF is refused before any upload (certificates still take one)', async () => {
    const e = await Education.create({ school: 'S', start: '2019', end: '2021' });
    const res = await request(app).put(`/api/education/${e._id}/logo`).set(await authHeader()).attach('file', PDF, 'l.pdf');
    expect(res.status).toBe(415);
    expect(res.body.message).not.toMatch(/PDF/);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('deleting an education entry deletes its logo too', async () => {
    const e = await Education.create({ school: 'S', start: '2019', end: '2021', logo: { url: 'https://res.cloudinary.com/l.png', publicId: 'portfolio/education/l' } });
    storage.destroy.mockResolvedValue({ result: 'ok' });
    expect((await request(app).delete(`/api/education/${e._id}`).set(await authHeader())).status).toBe(204);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/education/l', 'image');
  });

  it('REMOVE clears the row, then deletes the file', async () => {
    const c = await Certificate.create({ ...PUBLISHED_CERT, image: { url: 'https://res.cloudinary.com/x.png', publicId: 'portfolio/certificates/x' } });
    storage.destroy.mockResolvedValue({ result: 'ok' });
    const res = await request(app).delete(`/api/certificates/${c._id}/image`).set(await authHeader());
    expect(res.status).toBe(200);
    expect((await Certificate.findById(c._id)).image.url).toBe('');
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/certificates/x', 'image');
  });

  it('deleting the entry deletes its file too', async () => {
    const c = await Certificate.create({ ...PUBLISHED_CERT, image: { url: 'https://res.cloudinary.com/x.png', publicId: 'portfolio/certificates/x' } });
    storage.destroy.mockResolvedValue({ result: 'ok' });
    const res = await request(app).delete(`/api/certificates/${c._id}`).set(await authHeader());
    expect(res.status).toBe(204);
    expect(await Certificate.countDocuments()).toBe(0);
    expect(storage.destroy).toHaveBeenCalledWith('portfolio/certificates/x', 'image');
  });

  it('an unknown id is 404, a malformed one 400', async () => {
    const auth = await authHeader();
    expect((await request(app).put('/api/certificates/507f1f77bcf86cd799439011').set(auth).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).put('/api/certificates/nope').set(auth).send({ title: 'x' })).status).toBe(400);
  });
});

describe('pictureFrom', () => {
  it('leaves an image link alone', () => {
    const answer = cloudinaryAnswer('a');
    expect(pictureFrom(answer).url).toBe(answer.url);
  });
});
