const { query } = require('express-validator');
const VisitTotal  = require('../models/VisitTotal');
const LiveVisitor = require('../models/LiveVisitor');
const Contact     = require('../models/Contact');
const SignInEvent = require('../models/SignInEvent');
const Blog        = require('../models/Blog');
const Project     = require('../models/Project');
const Certificate = require('../models/Certificate');
const { zonedNow } = require('./visitController');

/**
 * PF-149 — the private Analytics panel. Reads what PF-145's counter stored and
 * adds nothing to it. Signed-in only (dashboardRoutes), never cached (noStore).
 *
 * ⚠️ Every day here is a Sri Lanka date, the counter's own `day`, handled as
 * calendar text. PF-150's public box must not reuse these answers: cities,
 * sources and sign-ins stay private.
 */

const RANGES = ['7', '30', '90', 'year'];

// Sri Lanka has one offset all year. Turns a Sri Lanka day into real instants
// for the collections that store a date instead of a `day`.
const OFFSET = '+05:30';

const rangeRules = [
  query('range').isString().bail().isIn(RANGES).withMessage('Please choose a date range from the list.'),
];

// ── Calendar arithmetic ─────────────────────────────────────────────────────

const addDays = (day, count) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};

const daysFrom = (from, to) => {
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
};

/** The same date a year earlier; 29 Feb has no twin, so it becomes 28 Feb. */
const sameDayLastYear = (day) => {
  const year = Number(day.slice(0, 4)) - 1;
  const candidate = `${year}${day.slice(4)}`;
  return addDays(candidate, 0).slice(5) === day.slice(5) ? candidate : `${year}-02-28`;
};

/**
 * The chosen period and the fair one to compare it with, both ending as far
 * into their period as today is. Today counts as a day of the period.
 */
const periodOf = (range, today) => {
  if (range === 'year') {
    const year = Number(today.slice(0, 4));
    return {
      from: `${year}-01-01`,
      to: today,
      previousFrom: `${year - 1}-01-01`,
      previousTo: sameDayLastYear(today),
    };
  }
  const length = Number(range);
  const from = addDays(today, 1 - length);
  return {
    from,
    to: today,
    previousFrom: addDays(from, -length),
    previousTo: addDays(from, -1),
  };
};

const startOf = (day) => new Date(`${day}T00:00:00${OFFSET}`);
const betweenDays = (from, to) => ({ $gte: startOf(from), $lt: startOf(addDays(to, 1)) });

// ── Reading the totals ──────────────────────────────────────────────────────

/** `{ dim: [{ key, count }] }` for a stretch of days. */
const totalsByDim = async (from, to) => {
  const rows = await VisitTotal.aggregate([
    { $match: { day: { $gte: from, $lte: to } } },
    { $group: { _id: { dim: '$dim', key: '$key' }, count: { $sum: '$count' } } },
  ]);
  return rows.reduce((byDim, { _id, count }) => {
    (byDim[_id.dim] ??= []).push({ key: _id.key, count });
    return byDim;
  }, {});
};

const countOf = (rows = [], key) => rows.find((row) => row.key === key)?.count ?? 0;

const headlines = (dims, messages) => ({
  visitors: countOf(dims.visitors, 'all'),
  views:    countOf(dims.views, 'all'),
  messages,
  email:    countOf(dims.click, 'email'),
  cv:       countOf(dims.click, 'cv'),
  github:   countOf(dims.click, 'github'),
  live:     countOf(dims.click, 'live'),
});

/** The day the counter first wrote anything, or null. */
const countingSince = async () => {
  const first = await VisitTotal.findOne().sort({ day: 1 }).select('day').lean();
  return first?.day ?? null;
};

// ── Turning paths into titles ───────────────────────────────────────────────

const TITLED = [
  { prefix: '/blog/',         Model: Blog },
  { prefix: '/projects/',     Model: Project },
  { prefix: '/certificates/', Model: Certificate },
];

/**
 * The page's real title, or none when it was renamed or deleted: then the panel
 * shows its address, because the visits really happened.
 */
const withTitles = async (paths) => {
  const titled = await Promise.all(TITLED.map(async ({ prefix, Model }) => {
    const slugs = paths
      .filter((row) => row.key.startsWith(prefix))
      .map((row) => row.key.slice(prefix.length));
    if (slugs.length === 0) return [];
    const docs = await Model.find({ slug: { $in: slugs } }).select('slug title').lean();
    return docs.map((doc) => [`${prefix}${doc.slug}`, doc.title]);
  }));
  const titles = new Map(titled.flat());
  return paths.map((row) => ({ ...row, title: titles.get(row.key) ?? null }));
};

const mostViewed = (pages, prefix) => pages
  .filter((row) => row.key.startsWith(prefix))
  .sort((x, y) => y.count - x.count || x.key.localeCompare(y.key))
  .map((row) => ({ ...row, title: row.title ?? row.key }));

// ── Messages and sign-ins ───────────────────────────────────────────────────

/** "New York, NY, United States" → "United States". */
const countryOfLocation = (location) =>
  (location ? location.split(',').pop().trim() : '') || '(unknown)';

const groupCounts = (keys) => [...keys.reduce(
  (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1),
  new Map(),
)].map(([key, count]) => ({ key, count }));

const signInSummary = async (from, to) => {
  const rows = await SignInEvent
    .find({ kind: 'sign-in', createdAt: betweenDays(from, to) })
    .select('outcome method')
    .lean();
  const good = rows.filter((row) => row.outcome === 'ok');
  return {
    ok:     good.length,
    failed: rows.length - good.length,
    byMethod: Object.fromEntries(groupCounts(good.map((row) => row.method).filter(Boolean))
      .map(({ key, count }) => [key, count])),
  };
};

// ── Routes ──────────────────────────────────────────────────────────────────

/** GET /api/dashboard/audience?range=7|30|90|year */
const getAnalytics = async (req, res, next) => {
  try {
    const { day: today } = zonedNow();
    const { from, to, previousFrom, previousTo } = periodOf(req.query.range, today);

    const [dims, previousDims, clickRows, messages, previousMessages, signIns, since] = await Promise.all([
      totalsByDim(from, to),
      totalsByDim(previousFrom, previousTo),
      VisitTotal.find({ dim: 'click', day: { $gte: from, $lte: to } }).select('day count').lean(),
      Contact.find({ createdAt: betweenDays(from, to) }).select('createdAt location').lean(),
      Contact.countDocuments({ createdAt: betweenDays(previousFrom, previousTo) }),
      signInSummary(from, to),
      countingSince(),
    ]);

    const pages = await withTitles(dims.path ?? []);

    const clicksByDay = new Map();
    clickRows.forEach(({ day, count }) => clicksByDay.set(day, (clicksByDay.get(day) ?? 0) + count));
    const messagesByDay = new Map(groupCounts(messages.map((m) => zonedNow(m.createdAt).day))
      .map(({ key, count }) => [key, count]));

    res.json({
      status: 'success',
      data: {
        range: req.query.range,
        from,
        to,
        countingSince: since,
        // A period the counter only saw part of would make any change look huge.
        comparable: since !== null && since <= previousFrom,
        totals:   headlines(dims, messages.length),
        previous: headlines(previousDims, previousMessages),
        breakdowns: {
          country:  dims.country  ?? [],
          city:     dims.city     ?? [],
          referrer: dims.referrer ?? [],
          device:   dims.device   ?? [],
          browser:  dims.browser  ?? [],
          hour:     dims.hour     ?? [],
          section:  dims.section  ?? [],
        },
        pages,
        mostViewed: {
          projects: mostViewed(pages, '/projects/'),
          posts:    mostViewed(pages, '/blog/'),
        },
        messagesByCountry: groupCounts(messages.map((m) => countryOfLocation(m.location))),
        daily: daysFrom(from, to).map((day) => ({
          day,
          messages: messagesByDay.get(day) ?? 0,
          clicks:   clicksByDay.get(day) ?? 0,
        })),
        signIns,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/audience/growth — every day since counting began, empty
 * days as 0. The browser groups them into weeks, months and years.
 */
const getGrowth = async (_req, res, next) => {
  try {
    const { day: today } = zonedNow();
    const since = await countingSince();
    if (!since) return res.json({ status: 'success', data: { countingSince: null, days: [] } });

    const rows = await VisitTotal
      .find({ dim: { $in: ['visitors', 'views'] }, key: 'all', day: { $gte: since } })
      .select('day dim count')
      .lean();
    const counts = new Map(rows.map((row) => [`${row.day}|${row.dim}`, row.count]));

    res.json({
      status: 'success',
      data: {
        countingSince: since,
        days: daysFrom(since, today).map((day) => ({
          day,
          visitors: counts.get(`${day}|visitors`) ?? 0,
          views:    counts.get(`${day}|views`) ?? 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/audience/live. An answer at all is the health check: the
 * reads below go through the database, so a failure reaches the panel as an
 * error, which it shows as PAUSED and NOT ANSWERING.
 */
const getLive = async (_req, res, next) => {
  try {
    const now = new Date();
    const { day, hour } = zonedNow(now);
    const [onSiteNow, rows] = await Promise.all([
      LiveVisitor.countDocuments({ expiresAt: { $gt: now } }),
      VisitTotal.find({ day, dim: { $in: ['visitors', 'views', 'hour'] } }).select('dim key count').lean(),
    ]);
    const find = (dim, key) => rows.find((row) => row.dim === dim && row.key === key)?.count ?? 0;

    res.json({
      status: 'success',
      data: {
        onSiteNow,
        visitorsToday: find('visitors', 'all'),
        viewsToday:    find('views', 'all'),
        viewsThisHour: find('hour', hour),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Referrers are text a stranger chose. A cell starting with one of these runs as
 * a formula when opened in Excel (OWASP "CSV Injection"), so it gets a leading
 * apostrophe, and every cell is quoted.
 */
const csvCell = (value) => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** The byte-order mark makes Excel read "São Paulo" as UTF-8. */
const BOM = '﻿';

/** Rows of `{ key }` → one `{ day, dim, key, count }` per day and key. */
const dailyCounts = (rows, dim, keyOf) => {
  const counts = new Map();
  rows.forEach((row) => {
    const id = `${zonedNow(row.createdAt).day}|${keyOf(row)}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return [...counts].map(([id, count]) => {
    const [day, ...key] = id.split('|');
    return { day, dim, key: key.join('|'), count };
  });
};

/**
 * GET /api/dashboard/audience/export — every number the panel is built from, the
 * owner's own copy (the Settings backup leaves the totals out on purpose,
 * backupFile.js). Counts only: never a message's words, a name or an address.
 * Sign-ins go back 90 days, like the card. Live numbers are a moment, not data.
 * About 2 KB a day, so Vercel's 4.5 MB answer limit is some years away.
 */
const exportCsv = async (_req, res, next) => {
  try {
    const [totals, messages, signIns] = await Promise.all([
      VisitTotal.find().select('day dim key count').lean(),
      Contact.find().select('createdAt location').lean(),
      SignInEvent.find({ kind: 'sign-in' }).select('createdAt outcome method').lean(),
    ]);
    const rows = [
      ...totals,
      ...dailyCounts(messages, 'messages', (m) => countryOfLocation(m.location)),
      ...dailyCounts(signIns, 'sign-in', (s) => `${s.method ?? 'unknown'} ${s.outcome}`),
    ].sort((x, y) => x.day.localeCompare(y.day) || x.dim.localeCompare(y.dim) || x.key.localeCompare(y.key));
    const lines = rows.map((row) => [row.day, row.dim, row.key, row.count].map(csvCell).join(','));
    res.set({
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="site-numbers.csv"',
    });
    res.send(`${BOM}day,dim,key,count\r\n${lines.join('\r\n')}\r\n`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  rangeRules, getAnalytics, getGrowth, getLive, exportCsv,
  periodOf, sameDayLastYear, csvCell, countryOfLocation,
};
