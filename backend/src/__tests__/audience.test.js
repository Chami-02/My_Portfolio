// backend/src/__tests__/audience.test.js
//
// PF-149 — the private Analytics panel's answers, against rows with known counts
// (owner: "100% accurate"). Every number is distinct, so a mix-up fails.
const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app = require('../app');
const VisitTotal  = require('../models/VisitTotal');
const LiveVisitor = require('../models/LiveVisitor');
const Contact     = require('../models/Contact');
const SignInEvent = require('../models/SignInEvent');
const Blog        = require('../models/Blog');
const User        = require('../models/User');
const { zonedNow } = require('../controllers/visitController');
const {
  periodOf, sameDayLastYear, csvCell, countryOfLocation,
} = require('../controllers/audienceController');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const authHeader = async () => {
  const user = await User.create({ email: 'admin@test.com', password: 'TestPass@1234!' });
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};

const addDays = (day, count) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};

const today = () => zonedNow().day;
const row = (day, dim, key, count) => ({ day, dim, key, count });

const get = (path, headers) => request(app).get(`/api/dashboard/audience${path}`).set(headers);

describe('periodOf', () => {
  it('counts today as a day of the period', () => {
    expect(periodOf('7', '2026-11-10')).toEqual({
      from: '2026-11-04', to: '2026-11-10', previousFrom: '2026-10-28', previousTo: '2026-11-03',
    });
  });

  it('crosses a month and a new year', () => {
    expect(periodOf('30', '2027-01-15')).toEqual({
      from: '2026-12-17', to: '2027-01-15', previousFrom: '2026-11-17', previousTo: '2026-12-16',
    });
  });

  it('compares this year with the same dates last year', () => {
    expect(periodOf('year', '2027-03-05')).toEqual({
      from: '2027-01-01', to: '2027-03-05', previousFrom: '2026-01-01', previousTo: '2026-03-05',
    });
  });

  it('a leap day compares with 28 February', () => {
    expect(sameDayLastYear('2028-02-29')).toBe('2027-02-28');
    expect(sameDayLastYear('2028-03-01')).toBe('2027-03-01');
  });
});

describe('GET /api/dashboard/audience — the door', () => {
  it.each(['?range=30', '/growth', '/live', '/export'])('%s refuses a signed-out request', async (path) => {
    const res = await request(app).get(`/api/dashboard/audience${path}`);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/visitors/);
  });

  it.each(['?range=30', '/growth', '/live', '/export'])('%s is never cached', async (path) => {
    const res = await get(path, await authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['vercel-cdn-cache-control']).toBeUndefined();
  });

  it.each(['', '?range=8', '?range=all', '?range=30&range=7', '?range[$gt]=1'])('refuses %s', async (query) => {
    const res = await get(query, await authHeader());
    expect(res.status).toBe(400);
  });

  it.each(['7', '30', '90', 'year'])('accepts range %s', async (range) => {
    const res = await get(`?range=${range}`, await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe(range);
  });
});

describe('GET /api/dashboard/audience — the numbers', () => {
  it('adds up exactly what was stored, and nothing outside the period', async () => {
    const t = today();
    await VisitTotal.insertMany([
      // Inside the 7 days: the first and the last day of it.
      row(t, 'visitors', 'all', 3), row(addDays(t, -6), 'visitors', 'all', 4),
      row(t, 'views', 'all', 11), row(addDays(t, -6), 'views', 'all', 13),
      row(t, 'click', 'email', 2), row(t, 'click', 'cv', 5), row(t, 'click', 'github', 7), row(t, 'click', 'live', 9),
      row(t, 'country', 'LK', 6), row(addDays(t, -1), 'country', 'LK', 1), row(t, 'country', 'GB', 8),
      row(t, 'section', 'hero', 15), row(addDays(t, -1), 'section', 'hero', 1), row(t, 'hour', '09', 21),
      // One day before the period: the previous period's edge.
      row(addDays(t, -7), 'visitors', 'all', 100), row(addDays(t, -7), 'country', 'LK', 500),
      // The previous period's first day, and one day older than it.
      row(addDays(t, -13), 'visitors', 'all', 20), row(addDays(t, -14), 'visitors', 'all', 1000),
    ]);

    const { body: { data } } = await get('?range=7', await authHeader());

    expect(data.totals).toEqual({ visitors: 7, views: 24, messages: 0, email: 2, cv: 5, github: 7, live: 9 });
    expect(data.previous.visitors).toBe(120);
    expect(data.breakdowns.country).toEqual(expect.arrayContaining([{ key: 'LK', count: 7 }, { key: 'GB', count: 8 }]));
    expect(data.breakdowns.country).toHaveLength(2);
    expect(data.breakdowns.section).toEqual([{ key: 'hero', count: 16 }]);
    expect(data.breakdowns.hour).toEqual([{ key: '09', count: 21 }]);
  });

  it('fills every day of the period, the quiet ones with 0', async () => {
    const t = today();
    await VisitTotal.insertMany([row(t, 'click', 'cv', 2), row(t, 'click', 'email', 3)]);
    const { body: { data } } = await get('?range=7', await authHeader());
    expect(data.daily).toHaveLength(7);
    expect(data.daily[0].day).toBe(addDays(t, -6));
    expect(data.daily[6]).toEqual({ day: t, messages: 0, clicks: 5 });
    expect(data.daily[0].clicks).toBe(0);
  });

  it('answers an empty database with zeros and empty lists, not a failure', async () => {
    const { body: { data } } = await get('?range=30', await authHeader());
    expect(data.countingSince).toBeNull();
    expect(data.comparable).toBe(false);
    expect(data.totals.visitors).toBe(0);
    expect(data.breakdowns.country).toEqual([]);
  });

  it('is comparable only once the counter saw the whole previous period', async () => {
    const headers = await authHeader();
    const t = today();
    await VisitTotal.create(row(addDays(t, -13), 'views', 'all', 1));
    expect((await get('?range=7', headers)).body.data.comparable).toBe(true);
    await VisitTotal.deleteMany();
    await VisitTotal.create(row(addDays(t, -12), 'views', 'all', 1));
    expect((await get('?range=7', headers)).body.data.comparable).toBe(false);
  });
});

describe('GET /api/dashboard/audience — titles', () => {
  it('joins pages to real titles, and shows the address of one that is gone', async () => {
    const t = today();
    await Blog.create({
      title: 'A real post', excerpt: 'An excerpt.', published: true,
      sections: [{ heading: 'Intro', body: ['Text.'], bullets: [] }],
    });
    const post = await Blog.findOne().lean();
    await VisitTotal.insertMany([
      row(t, 'read', `/blog/${post.slug}`, 6),
      row(t, 'read', '/blog/deleted-post', 9),
      // Page openings are not reads (PF-153): they must not reach the posts list.
      row(t, 'path', `/blog/${post.slug}`, 500),
      row(t, 'path', '/', 40),
    ]);

    const { body: { data } } = await get('?range=7', await authHeader());

    expect(data.mostViewed.posts).toEqual([
      { key: '/blog/deleted-post', count: 9, title: '/blog/deleted-post' },
      { key: `/blog/${post.slug}`, count: 6, title: 'A real post' },
    ]);
    expect(data.mostViewed.projects).toEqual([]);
    expect(data.pages.find((p) => p.key === '/').title).toBeNull();
  });
});

describe('GET /api/dashboard/audience — most viewed has no ceiling', () => {
  it('returns every post, biggest first, for the list to scroll', async () => {
    const t = today();
    await VisitTotal.insertMany(Array.from({ length: 14 }, (_, i) => row(t, 'read', `/blog/post-${i}`, i + 1)));
    const { body: { data } } = await get('?range=7', await authHeader());
    expect(data.mostViewed.posts).toHaveLength(14);
    expect(data.mostViewed.posts[0].count).toBe(14);
  });
});

describe('GET /api/dashboard/audience — messages', () => {
  const message = async (createdAt, location = null) => {
    const { insertedId } = await Contact.collection.insertOne({
      name: 'A', email: 'a@b.co', subject: 'Hi', message: 'Hello', location, createdAt, updatedAt: createdAt,
    });
    return insertedId;
  };

  it('counts by country, with no location as Unknown', async () => {
    await message(new Date(), 'Galle, Sri Lanka');
    await message(new Date(), 'New York, NY, United States');
    await message(new Date(), 'Sri Lanka');
    await message(new Date(), null);
    const { body: { data } } = await get('?range=7', await authHeader());
    expect(data.totals.messages).toBe(4);
    expect(data.messagesByCountry).toEqual(expect.arrayContaining([
      { key: 'Sri Lanka', count: 2 }, { key: 'United States', count: 1 }, { key: '(unknown)', count: 1 },
    ]));
  });

  it('files a message under its Sri Lanka day, not its UTC day', async () => {
    // 19:00 UTC yesterday is 00:30 today in Sri Lanka. Mutating the offset moves it.
    const t = today();
    const lateUtc = new Date(`${addDays(t, -1)}T19:00:00Z`);
    const previousDayEdge = new Date(`${addDays(t, -7)}T18:29:00Z`); // 23:59 the day before the period starts
    await message(lateUtc);
    await message(previousDayEdge);
    const { body: { data } } = await get('?range=7', await authHeader());
    expect(data.daily.find((d) => d.day === t).messages).toBe(1);
    expect(data.totals.messages).toBe(1);
    expect(data.previous.messages).toBe(1);
  });

  it('starts the period at midnight in Sri Lanka, not midnight UTC', async () => {
    // 00:30 on the period's first day in Sri Lanka, still the day before in UTC.
    const firstDay = addDays(today(), -6);
    await message(new Date(`${addDays(firstDay, -1)}T19:00:00Z`));
    const { body: { data } } = await get('?range=7', await authHeader());
    expect(data.totals.messages).toBe(1);
    expect(data.daily[0]).toEqual({ day: firstDay, messages: 1, clicks: 0 });
    expect(data.previous.messages).toBe(0);
  });

  it.each([
    ['Galle, Sri Lanka', 'Sri Lanka'], ['New York, NY, United States', 'United States'],
    ['Sri Lanka', 'Sri Lanka'], [null, '(unknown)'], ['', '(unknown)'],
  ])('%s is from %s', (location, country) => {
    expect(countryOfLocation(location)).toBe(country);
  });
});

describe('GET /api/dashboard/audience — sign-ins', () => {
  it('counts successes by method, failures apart, and only sign-ins', async () => {
    await SignInEvent.create([
      { kind: 'sign-in', outcome: 'ok', method: 'password' },
      { kind: 'sign-in', outcome: 'ok', method: 'passkey' },
      { kind: 'sign-in', outcome: 'ok', method: 'passkey' },
      { kind: 'sign-in', outcome: 'failed', method: 'password' },
      { kind: 'password-change', outcome: 'ok' },
    ]);
    const { body: { data } } = await get('?range=7', await authHeader());
    expect(data.signIns).toEqual({ ok: 3, failed: 1, byMethod: { password: 1, passkey: 2 } });
  });
});

describe('GET /api/dashboard/audience/growth', () => {
  it('returns every day since counting began, the quiet ones as 0', async () => {
    const t = today();
    await VisitTotal.insertMany([
      row(addDays(t, -2), 'visitors', 'all', 3), row(addDays(t, -2), 'views', 'all', 8),
      row(t, 'visitors', 'all', 5), row(t, 'views', 'all', 13),
      row(t, 'path', '/', 99),
    ]);
    const { body: { data } } = await get('/growth', await authHeader());
    expect(data.countingSince).toBe(addDays(t, -2));
    expect(data.days).toEqual([
      { day: addDays(t, -2), visitors: 3, views: 8 },
      { day: addDays(t, -1), visitors: 0, views: 0 },
      { day: t, visitors: 5, views: 13 },
    ]);
  });

  it('answers nothing counted yet with an empty list', async () => {
    const { body: { data } } = await get('/growth', await authHeader());
    expect(data).toEqual({ countingSince: null, days: [] });
  });
});

describe('GET /api/dashboard/audience/live', () => {
  const live = (id, offsetMs) => ({ _id: id, expiresAt: new Date(Date.now() + offsetMs) });

  it('counts only codes that have not expired, even if the sweep is late', async () => {
    await LiveVisitor.insertMany([live('a', 60_000), live('b', 240_000), live('gone', -1000)]);
    const { body: { data } } = await get('/live', await authHeader());
    expect(data.onSiteNow).toBe(2);
  });

  it('reads today and this hour, not yesterday or another hour', async () => {
    const { day, hour } = zonedNow();
    const otherHour = hour === '00' ? '01' : '00';
    await VisitTotal.insertMany([
      row(day, 'visitors', 'all', 4), row(day, 'views', 'all', 6),
      row(day, 'hour', hour, 3), row(day, 'hour', otherHour, 50),
      row(addDays(day, -1), 'visitors', 'all', 70), row(addDays(day, -1), 'hour', hour, 80),
    ]);
    const { body: { data } } = await get('/live', await authHeader());
    expect(data).toEqual({ onSiteNow: 0, visitorsToday: 4, viewsToday: 6, viewsThisHour: 3 });
  });
});

describe('GET /api/dashboard/audience/export', () => {
  it('sends every total ever counted, as a CSV download', async () => {
    await VisitTotal.insertMany([
      // Newest first on purpose: the file is sorted by day whatever the stored order.
      row('2026-11-05', 'city', 'São Paulo, BR', 2), row('2020-01-01', 'visitors', 'all', 3),
    ]);
    const res = await get('/export', await authHeader());
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toContain('site-numbers.csv');
    const lines = res.text.replace('﻿', '').trim().split('\r\n');
    expect(lines).toEqual([
      'day,dim,key,count',
      '"2020-01-01","visitors","all","3"',
      '"2026-11-05","city","São Paulo, BR","2"',
    ]);
  });

  it('adds messages and sign-ins as counts, and never a word of who wrote what', async () => {
    const when = new Date('2026-11-05T06:00:00Z');
    await Contact.collection.insertOne({
      name: 'Jane Secret', email: 'jane@secret.test', subject: 'Private subject', message: 'Private words',
      location: 'Galle, Sri Lanka', createdAt: when, updatedAt: when,
    });
    await SignInEvent.create([
      { kind: 'sign-in', outcome: 'ok', method: 'passkey', address: 'owner@secret.test' },
      { kind: 'password-change', outcome: 'ok' },
    ]);
    const res = await get('/export', await authHeader());
    expect(res.text).toContain('"2026-11-05","messages","Sri Lanka","1"');
    expect(res.text).toContain(`"${today()}","sign-in","passkey ok","1"`);
    expect(res.text.match(/"sign-in"/g)).toHaveLength(1); // the password change is not one
    ['Jane Secret', 'jane@secret.test', 'Private', 'owner@secret.test'].forEach((text) => {
      expect(res.text).not.toContain(text);
    });
  });

  it('agrees with the panel: the same totals, for messages and sign-ins too', async () => {
    const headers = await authHeader();
    const t = today();
    await VisitTotal.insertMany([row(t, 'visitors', 'all', 41), row(t, 'click', 'cv', 7)]);
    await Contact.collection.insertMany([1, 2, 3].map((n) => ({
      name: `A${n}`, email: 'a@b.co', subject: 'Hi', message: 'Hello', location: null, createdAt: new Date(), updatedAt: new Date(),
    })));
    await SignInEvent.create([{ kind: 'sign-in', outcome: 'ok', method: 'google' }, { kind: 'sign-in', outcome: 'failed', method: 'password' }]);

    const { body: { data } } = await get('?range=7', headers);
    const csv = (await get('/export', headers)).text;
    expect(csv).toContain(`"visitors","all","${data.totals.visitors}"`);
    expect(csv).toContain(`"click","cv","${data.totals.cv}"`);
    expect(csv).toContain(`"messages","(unknown)","${data.totals.messages}"`);
    expect(csv).toContain(`"sign-in","google ok","${data.signIns.byMethod.google}"`);
    expect(csv).toContain(`"sign-in","password failed","${data.signIns.failed}"`);
  });

  it('neutralises a referrer a stranger chose to run as a formula', async () => {
    await VisitTotal.create(row('2026-11-05', 'referrer', '=HYPERLINK("http://x.test")', 1));
    const res = await get('/export', await authHeader());
    expect(res.text).toContain('"\'=HYPERLINK(""http://x.test"")"');
  });

  it.each([
    ['=1+1', '"\'=1+1"'], ['+1', '"\'+1"'], ['-1', '"\'-1"'], ['@x', '"\'@x"'], ['\tx', '"\'\tx"'],
    ['linkedin.com', '"linkedin.com"'], ['a"b', '"a""b"'], [12, '"12"'],
  ])('%s becomes %s', (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });
});
