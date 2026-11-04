const mongoose = require('mongoose');
const request  = require('supertest');
const app      = require('../app');
const VisitTotal = require('../models/VisitTotal');
const VisitorDay = require('../models/VisitorDay');
const VisitSalt  = require('../models/VisitSalt');
const { saltFor, zonedNow } = require('../controllers/visitController');
const { skipGlobalLimiter } = require('../middleware/rateLimiter');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const IP = '203.0.113.77';

const send = (payload, { ip = IP, ua = CHROME_MAC, headers = {} } = {}) => {
  const req = request(app).post('/api/visits').set('X-Forwarded-For', ip);
  if (ua) req.set('User-Agent', ua); else req.unset('User-Agent');
  Object.entries(headers).forEach(([k, v]) => req.set(k, v));
  return req.send(payload);
};

const view = (path = '/', opts) => send({ type: 'view', path }, opts);

const total = async (dim, key) =>
  (await VisitTotal.findOne({ dim, key }).lean())?.count ?? 0;

describe('POST /api/visits — what is counted', () => {
  it('answers 204 with no body and no CDN copy', async () => {
    const res = await view();
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('counts every view but each visitor once a day', async () => {
    await view('/');
    await view('/blog');
    await view('/blog');

    expect(await total('views', 'all')).toBe(3);
    expect(await total('visitors', 'all')).toBe(1);
    expect(await total('path', '/')).toBe(1);
    expect(await total('path', '/blog')).toBe(2);
    expect(await total('device', 'desktop')).toBe(1);
    expect(await total('browser', 'Chrome')).toBe(1);
  });

  it('counts two different visitors separately', async () => {
    await view('/', { ip: '203.0.113.1' });
    await view('/', { ip: '203.0.113.2' });
    await view('/', { ip: '203.0.113.1', ua: SAFARI_IPHONE });

    expect(await total('visitors', 'all')).toBe(3);
    expect(await total('device', 'phone')).toBe(1);
    expect(await total('browser', 'Safari')).toBe(1);
  });

  it('a burst of first requests still counts one visitor, and every view', async () => {
    await Promise.all(Array.from({ length: 8 }, () => view('/')));
    expect(await total('visitors', 'all')).toBe(1);
    expect(await total('views', 'all')).toBe(8);
    expect(await VisitorDay.countDocuments()).toBe(1);
  });

  it('files the hour under the Sri Lanka clock', async () => {
    await view();
    const { hour } = zonedNow();
    expect(await total('hour', hour)).toBe(1);
    // 18:40 UTC is 00:10 the NEXT day at +5:30 — a whole-hour offset could not do this.
    expect(zonedNow(new Date('2026-11-04T18:40:00Z'))).toEqual({ day: '2026-11-05', hour: '00' });
  });

  it('counts a click without counting a visitor or a view', async () => {
    const res = await send({ type: 'click', link: 'github' });
    expect(res.status).toBe(204);
    expect(await total('click', 'github')).toBe(1);
    expect(await total('views', 'all')).toBe(0);
    expect(await total('visitors', 'all')).toBe(0);
  });
});

describe('POST /api/visits — where they came from', () => {
  afterEach(() => { delete process.env.VERCEL; });

  it('keeps only the referrer hostname, once per visitor', async () => {
    const payload = { type: 'view', path: '/', referrer: 'https://www.linkedin.com/in/someone?q=secret' };
    await send(payload);
    await send(payload);
    expect(await total('referrer', 'linkedin.com')).toBe(1);
  });

  it('a blank referrer is direct; junk or a non-web scheme is other', async () => {
    await view('/', { ip: '203.0.113.1' });
    await send({ type: 'view', path: '/', referrer: 'not a url' }, { ip: '203.0.113.2' });
    await send({ type: 'view', path: '/', referrer: 'javascript:alert(1)' }, { ip: '203.0.113.3' });
    expect(await total('referrer', '(direct)')).toBe(1);
    expect(await total('referrer', '(other)')).toBe(2);
  });

  it('a city with a dot is one flat row (a dotted $inc path would scatter it)', async () => {
    process.env.VERCEL = '1';
    await view('/', {
      headers: { 'x-vercel-ip-country': 'US', 'x-vercel-ip-city': 'St.%20Louis' },
    });
    expect(await total('country', 'US')).toBe(1);
    expect(await total('city', 'St. Louis, US')).toBe(1);
  });

  it('off Vercel a sent location header is ignored', async () => {
    await view('/', { headers: { 'x-vercel-ip-country': 'US', 'x-vercel-ip-city': 'Fake' } });
    expect(await total('country', 'US')).toBe(0);
    expect(await total('country', '(unknown)')).toBe(1);
    expect(await total('city', '(unknown)')).toBe(1);
  });

  it('on Vercel a missing city is unknown; the country still counts', async () => {
    process.env.VERCEL = '1';
    await view('/', { headers: { 'x-vercel-ip-country': 'LK' } });
    expect(await total('country', 'LK')).toBe(1);
    expect(await total('city', '(unknown)')).toBe(1);
  });
});

describe('POST /api/visits — what a client cannot do', () => {
  it.each(['/admin', '/admin/', '/admin/login', '/admin/messages'])('ignores %s', async (path) => {
    expect((await view(path)).status).toBe(204);
    expect(await VisitTotal.countDocuments()).toBe(0);
  });

  it.each(['/administrator', '/wp-login.php', '/blog/Has Spaces', '/blog/a/b', '/%00', 'x'])(
    'files the made-up path %s under (other)',
    async (path) => {
      await view(path);
      expect(await total('path', '(other)')).toBe(1);
      expect(await VisitTotal.countDocuments({ dim: 'path', key: path })).toBe(0);
    },
  );

  it.each(['/', '/blog', '/projects', '/certificates', '/privacy', '/cv-unavailable', '/blog/a-post-1', '/projects/clear-drive', '/certificates/aws'])(
    'keeps the real route %s',
    async (path) => {
      await view(path);
      expect(await total('path', path)).toBe(1);
    },
  );

  it('treats a trailing slash as the same page', async () => {
    await view('/blog/');
    expect(await total('path', '/blog')).toBe(1);
  });

  it('a path of many slashes is (other), and answers at once', async () => {
    await view('/blog//');
    await view(`/${'/'.repeat(2000)}`);
    expect(await total('path', '(other)')).toBe(2);
    expect(await total('path', '/blog')).toBe(0);
  });

  it.each([
    ['an unknown type',      { type: 'evil', path: '/' }],
    ['an array type',        { type: ['view'], path: '/' }],
    ['no type',              { path: '/' }],
    ['an array path',        { type: 'view', path: ['/'] }],
    ['an object path',       { type: 'view', path: { a: 1 } }],
    ['no path on a view',    { type: 'view' }],
    ['an array referrer',    { type: 'view', path: '/', referrer: ['https://a.com'] }],
    ['an unknown link',      { type: 'click', link: 'twitter' }],
    ['an array link',        { type: 'click', link: ['email'] }],
    ['no link on a click',   { type: 'click' }],
    ['a huge path',          { type: 'view', path: `/${'x'.repeat(3000)}` }],
    ['a huge referrer',      { type: 'view', path: '/', referrer: `https://a.com/${'x'.repeat(3000)}` }],
  ])('refuses %s with a 400 and writes nothing', async (_name, payload) => {
    const res = await send(payload);
    expect(res.status).toBe(400);
    expect(await VisitTotal.countDocuments()).toBe(0);
    expect(await VisitorDay.countDocuments()).toBe(0);
  });

  it.each([
    ['Googlebot',  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['Bingbot',    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['headless',   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/130.0.0.0 Safari/537.36'],
    ['curl',       'curl/8.7.1'],
    ['no header',  null],
  ])('%s gets a 204 and writes nothing at all', async (_name, ua) => {
    const res = await view('/', { ua });
    expect(res.status).toBe(204);
    expect(await VisitTotal.countDocuments()).toBe(0);
    expect(await VisitorDay.countDocuments()).toBe(0);
    expect(await VisitSalt.countDocuments()).toBe(0);
  });

  it('past the daily row cap, invented paths add no rows but real rows still count', async () => {
    const { day } = zonedNow();
    await view('/blog', { ip: '203.0.113.9' }); // an existing row, before the cap
    await VisitTotal.insertMany(Array.from({ length: 1000 }, (_, i) => (
      { day, dim: 'path', key: `/blog/seeded-${i}`, count: 1 }
    )));
    const before = await VisitTotal.countDocuments({ dim: 'path' });

    await view('/blog/brand-new-slug');
    await send({ type: 'view', path: '/blog', referrer: 'https://brand-new.example' });

    expect(await VisitTotal.countDocuments({ dim: 'path' })).toBe(before);
    expect(await total('referrer', 'brand-new.example')).toBe(0);
    expect(await total('path', '/blog')).toBe(2);
    expect(await total('views', 'all')).toBe(3);
  });
});

describe('POST /api/visits — nothing personal is saved', () => {
  const REFERRER = 'https://www.example.org/private-page?name=jane-doe';

  const allStoredText = async () => {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const dumps = await Promise.all(collections.map(async ({ name }) =>
      JSON.stringify(await mongoose.connection.db.collection(name).find().toArray())));
    return dumps.join('\n');
  };

  it('no collection holds the IP, the User-Agent or the full referrer URL', async () => {
    process.env.VERCEL = '1';
    try {
      await send({ type: 'view', path: '/', referrer: REFERRER }, {
        headers: { 'x-vercel-ip-country': 'LK', 'x-vercel-ip-city': 'Galle' },
      });
      await send({ type: 'click', link: 'email' });
    } finally {
      delete process.env.VERCEL;
    }

    const stored = await allStoredText();

    // Control: the scan really reads the data, or passing means nothing.
    ['example.org', 'Galle, LK', 'Chrome', 'visit:'].forEach((expected) => {
      expect(stored).toContain(expected);
    });

    [IP, CHROME_MAC, 'Macintosh', 'private-page', 'jane-doe'].forEach((personal) => {
      expect(stored).not.toContain(personal);
    });
  });

  it('a visitor row holds only the code and its expiry', async () => {
    await view();
    const row = await VisitorDay.findOne().lean();
    expect(Object.keys(row).sort()).toEqual(['_id', 'expiresAt']);
    expect(row._id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('codes and salts are deleted within two days', async () => {
    await view();
    const limit = Date.now() + 48 * 60 * 60 * 1000 + 1000;
    expect((await VisitorDay.findOne().lean()).expiresAt.getTime()).toBeLessThanOrEqual(limit);
    // A fresh day: this instance has today's salt cached, and clearDB emptied the row.
    await saltFor('2031-03-01');
    expect((await VisitSalt.findById('2031-03-01').lean()).expiresAt.getTime()).toBeLessThanOrEqual(limit);

    await Promise.all([VisitorDay.init(), VisitSalt.init()]);
    for (const Model of [VisitorDay, VisitSalt]) {
      const indexes = await Model.collection.indexes();
      const ttl = indexes.find((i) => i.key.expiresAt === 1);
      expect(ttl?.expireAfterSeconds).toBe(0);
    }
  });

  it('the same day keeps its salt; another day gets a different one', async () => {
    const a = await saltFor('2031-01-01');
    await saltFor('2031-01-02');
    // Past the instance's one-day cache, so this one comes from the row.
    expect(await saltFor('2031-01-01')).toBe(a);
    expect(await saltFor('2031-01-02')).not.toBe(a);
  });

  it('a burst on a new day agrees on one salt', async () => {
    const salts = await Promise.all(Array.from({ length: 8 }, () => saltFor('2031-04-01')));
    expect(new Set(salts).size).toBe(1);
    expect(await VisitSalt.countDocuments({ _id: '2031-04-01' })).toBe(1);
  });

  it('another instance reads the salt already stored for the day', async () => {
    await VisitSalt.create({ _id: '2031-02-01', salt: 'stored-by-another-instance', expiresAt: new Date(Date.now() + 1000) });
    expect(await saltFor('2031-02-01')).toBe('stored-by-another-instance');
  });
});

describe('POST /api/visits — limits', () => {
  it('stops one source after 120 in the window, whatever User-Agent it claims', async () => {
    for (let i = 0; i < 120; i += 1) {
      const ok = await view('/', { ua: `${CHROME_MAC} v${i}` });
      expect(ok.status).toBe(204);
    }
    const res = await view('/', { ua: `${CHROME_MAC} v-last` });
    expect(res.status).toBe(429);
    expect(await total('views', 'all')).toBe(120);

    // A different address is a different bucket.
    expect((await view('/', { ip: '203.0.113.200' })).status).toBe(204);
  });

  it('the global limiter skips only this route, and only for POST', () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(skipGlobalLimiter({ method: 'POST', path: '/api/visits' })).toBe(true);
      expect(skipGlobalLimiter({ method: 'GET', path: '/api/visits' })).toBe(false);
      expect(skipGlobalLimiter({ method: 'POST', path: '/api/contact' })).toBe(false);
      expect(skipGlobalLimiter({ method: 'POST', path: '/api/visits/other' })).toBe(false);
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });
});
