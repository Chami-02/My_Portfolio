const crypto = require('crypto');
const { body } = require('express-validator');
const { ipKeyGenerator } = require('express-rate-limit');
const VisitTotal = require('../models/VisitTotal');
const VisitorDay = require('../models/VisitorDay');
const VisitSalt  = require('../models/VisitSalt');
const { requestPlace } = require('../utils/requestLocation');
const { isBot, browserName, deviceType } = require('../utils/deviceLabel');

/**
 * PF-145 — the visitor counter. Daily totals only (models/VisitTotal.js).
 *
 * ⚠️ What must never reach the database: the IP address, the User-Agent, the
 * full referrer URL. `visits.test.js` searches every collection for them.
 * `.claude/locked-decisions.md` and the /privacy page carry the same promise —
 * a new dimension here means rereading that page.
 */

const KEEP_CODES_MS = 48 * 60 * 60 * 1000; // the privacy page's "within 2 days"
const UNKNOWN = '(unknown)';
const OTHER   = '(other)';
const DIRECT  = '(direct)';

// Paths and referrers are the two values a client chooses, so a script could
// invent new ones forever. Past this many in one day only rows that already
// exist go up, and the free database cannot be filled. A real day is a few dozen.
const MAX_CLIENT_KEYED_ROWS = 1000;

// A fixed zone, not UTC: Sri Lanka is +5:30, so an hour counted in UTC could
// never be moved onto the owner's clock afterwards. Decided when it is written.
const ZONE = 'Asia/Colombo';
const ZONE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

/** `{ day: '2026-11-04', hour: '09' }` on the owner's clock. */
const zonedNow = (date = new Date()) => {
  const p = Object.fromEntries(ZONE_PARTS.formatToParts(date).map(({ type, value }) => [type, value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: p.hour };
};

// One round trip per instance per day; every instance gets the same salt
// because the upsert is atomic and only ever sets it on insert.
let cachedSalt = { day: null, salt: null };

const saltFor = async (day) => {
  if (cachedSalt.day === day) return cachedSalt.salt;
  const row = await VisitSalt.findOneAndUpdate(
    { _id: day },
    {
      $setOnInsert: {
        salt:      crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + KEEP_CODES_MS),
      },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  cachedSalt = { day, salt: row.salt };
  return row.salt;
};

const scramble = (salt, value) =>
  crypto.createHmac('sha256', salt).update(value).digest('hex');

// ── Middleware ───────────────────────────────────────────────────────────────

/** A bot gets the same answer as anyone, so it learns nothing, and writes nothing. */
const ignoreBots = (req, res, next) => {
  if (isBot(req.get('user-agent'))) return res.status(204).end();
  next();
};

const identifyVisitor = async (req, _res, next) => {
  try {
    const now  = zonedNow();
    const salt = await saltFor(now.day);
    // ipKeyGenerator: a whole IPv6 block is one source, as in the other
    // limiters — one household can hold millions of addresses.
    const source = ipKeyGenerator(req.ip);
    req.visitNow      = now;
    req.visitorSource = scramble(salt, source);
    req.visitorCode   = scramble(salt, `${source}|${req.get('user-agent')}`);
    next();
  } catch (err) {
    next(err);
  }
};

const visitRules = [
  body('type').isString().bail().isIn(['view', 'click']).withMessage('Unknown visit type'),
  body('path').if(body('type').equals('view'))
    .isString().bail().isLength({ max: 2048 }).withMessage('Path is too long'),
  body('referrer').optional()
    .isString().bail().isLength({ max: 2048 }).withMessage('Referrer is too long'),
  body('link').if(body('type').equals('click'))
    .isString().bail().isIn(['email', 'cv', 'github', 'live']).withMessage('Unknown link'),
];

// ── Turning what the client sent into safe keys ─────────────────────────────

const LISTED_PATHS = new Set(['/', '/blog', '/projects', '/certificates', '/privacy', '/cv-unavailable']);
const SLUG_PATH = /^\/(blog|projects|certificates)\/[a-z0-9-]{1,100}$/;

const isAdminPath = (path) => path === '/admin' || path.startsWith('/admin/');

/** A public route as written, or OTHER — never the client's own text. */
const pathKey = (raw) => {
  const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  return LISTED_PATHS.has(path) || SLUG_PATH.test(path) ? path : OTHER;
};

/** Hostname only: a full URL can hold search terms, tokens or names. */
const referrerKey = (raw) => {
  if (!raw) return DIRECT;
  try {
    const { protocol, hostname } = new URL(raw);
    if (protocol !== 'https:' && protocol !== 'http:') return OTHER;
    return hostname.replace(/^www\./, '').slice(0, 100) || OTHER;
  } catch {
    return OTHER;
  }
};

const addOne = (day, dim, key, upsert = true) => ({
  updateOne: { filter: { day, dim, key }, update: { $inc: { count: 1 } }, upsert },
});

/** True the FIRST time this code is seen; atomic, so a burst counts once. */
const isFirstVisitToday = async (code) => {
  const result = await VisitorDay.updateOne(
    { _id: code },
    { $setOnInsert: { expiresAt: new Date(Date.now() + KEEP_CODES_MS) } },
    { upsert: true },
  );
  return result.upsertedCount === 1;
};

// ── The route ────────────────────────────────────────────────────────────────

/** POST /api/visits — public. Always a bare 204: nothing here is the visitor's business. */
const recordVisit = async (req, res, next) => {
  try {
    const { type, path, referrer, link } = req.body;
    const { day, hour } = req.visitNow;

    if (type === 'click') {
      await VisitTotal.bulkWrite([addOne(day, 'click', link)]);
      return res.status(204).end();
    }

    if (isAdminPath(path)) return res.status(204).end();

    const room = await VisitTotal.countDocuments({ day, dim: { $in: ['path', 'referrer'] } })
      < MAX_CLIENT_KEYED_ROWS;

    const writes = [
      addOne(day, 'views', 'all'),
      addOne(day, 'hour', hour),
      addOne(day, 'path', pathKey(path), room),
    ];

    if (await isFirstVisitToday(req.visitorCode)) {
      const place = requestPlace(req);
      const ua = req.get('user-agent');
      writes.push(
        addOne(day, 'visitors', 'all'),
        addOne(day, 'country', place?.country ?? UNKNOWN),
        addOne(day, 'city', place?.city ?? UNKNOWN),
        addOne(day, 'device', deviceType(ua)),
        addOne(day, 'browser', browserName(ua)),
        addOne(day, 'referrer', referrerKey(referrer), room),
      );
    }

    await VisitTotal.bulkWrite(writes, { ordered: false });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

module.exports = { visitRules, ignoreBots, identifyVisitor, recordVisit, saltFor, zonedNow };
