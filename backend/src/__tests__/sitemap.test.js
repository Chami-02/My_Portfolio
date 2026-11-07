// PF-146 — the page list for search engines (controllers/sitemapController.js).
const request = require('supertest');
const app     = require('../app');
const Blog    = require('../models/Blog');
const Project = require('../models/Project');
const Certificate = require('../models/Certificate');
const { PUBLIC_TAG } = require('../middleware/cache');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const SITE = 'https://example.test';
let savedUrl;

beforeAll(async () => {
  await connectTestDB();
  savedUrl = process.env.FRONTEND_URL;
});
beforeEach(() => { process.env.FRONTEND_URL = `${SITE}/`; });
afterEach(clearDB);
afterAll(async () => {
  process.env.FRONTEND_URL = savedUrl;
  await disconnectTestDB();
});

// Raw inserts: the slug and published state must be exactly what the test
// says, with no model hook filling them in.
const addPost    = (slug, published) => Blog.collection.insertOne({ slug, published, title: slug });
const addProject = (fields) => Project.collection.insertOne({ title: 'x', ...fields });

const locs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

describe('GET /api/sitemap.xml', () => {
  it('is XML in the sitemap format, listing the fixed public pages', async () => {
    const res = await request(app).get('/api/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/xml');
    expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(locs(res.text)).toEqual([
      `${SITE}/`, `${SITE}/blog`, `${SITE}/projects`, `${SITE}/certificates`, `${SITE}/privacy`,
    ]);
  });

  it('lists published posts and projects, including a project with no published field', async () => {
    await addPost('live-post', true);
    await addProject({ slug: 'live-project', published: true });
    await addProject({ slug: 'older-project' });
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(locs(text)).toEqual(expect.arrayContaining([
      `${SITE}/blog/live-post`,
      `${SITE}/projects/live-project`,
      `${SITE}/projects/older-project`,
    ]));
    expect(locs(text)).toHaveLength(8);
  });

  // PF-153
  it('gives a date only where it is true: posts, not the fixed pages', async () => {
    await Blog.collection.insertOne({ slug: 'dated', published: true, updatedAt: new Date('2026-10-05T23:00:00Z') });
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(text).toContain(`<url><loc>${SITE}/blog/dated</loc><lastmod>2026-10-05</lastmod></url>`);
    expect(text).toContain(`<url><loc>${SITE}/blog</loc></url>`);
  });

  it('lists published certificates, and never a draft', async () => {
    await Certificate.collection.insertMany([
      { slug: 'live-cert', published: true },
      { slug: 'secret-cert', published: false },
    ]);
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(locs(text)).toContain(`${SITE}/certificates/live-cert`);
    expect(text).not.toContain('secret');
  });

  it('never lists a draft', async () => {
    await addPost('secret-post', false);
    await addProject({ slug: 'secret-project', published: false });
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(text).not.toContain('secret');
    expect(locs(text)).toHaveLength(5);
  });

  it('skips a project that has no page to link to', async () => {
    await addProject({ title: 'no slug' });
    await addProject({ slug: '' });
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(locs(text)).toHaveLength(5);
  });

  it('escapes a slug, so one odd record cannot break the whole file', async () => {
    await addPost('a&b<c', true);
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(locs(text)).toContain(`${SITE}/blog/a%26b%3Cc`);
    expect(text).not.toContain('a&b');
  });

  it('never lists admin pages', async () => {
    const { text } = await request(app).get('/api/sitemap.xml');
    expect(text).not.toContain('/admin');
  });

  it('is cached like every public read, so a SAVE clears it', async () => {
    const res = await request(app).get('/api/sitemap.xml');
    expect(res.headers['vercel-cache-tag']).toBe(PUBLIC_TAG);
    expect(res.headers['vercel-cdn-cache-control']).toMatch(/s-maxage/);
  });

  it('refuses without a site address, and that refusal is not cached', async () => {
    process.env.FRONTEND_URL = '';
    const res = await request(app).get('/api/sitemap.xml');
    expect(res.status).toBe(503);
    expect(res.headers['vercel-cache-tag']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
