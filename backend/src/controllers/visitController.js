const crypto = require('crypto');
const { body } = require('express-validator');
const { ipKeyGenerator } = require('express-rate-limit');
const VisitTotal = require('../models/VisitTotal');
const VisitorDay = require('../models/VisitorDay');
const VisitSalt  = require('../models/VisitSalt');
const LiveVisitor = require('../models/LiveVisitor');
const Blog = require('../models/Blog');
const { isAllowedOrigin } = require('../config/corsOptions');
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
const LIVE_MS = 5 * 60 * 1000;             // the privacy page's "about 5 minutes"
const UNKNOWN = '(unknown)';
const OTHER   = '(other)';
const DIRECT  = '(direct)';

// Paths and referrers are the two values a client chooses, so a script could
// invent new ones forever. Past this many in one day only rows that already
// exist go up, and the free database cannot be filled. A real day is a few dozen.
const MAX_CLIENT_KEYED_ROWS = 1000;

// PF-153 — a script changing its browser name looks like a new person each time,
// so one network can add only this many new visitors a day. A real office rarely
// passes it, and /privacy says what happens if one does.
const MAX_NEW_VISITORS_PER_NETWORK = 20;

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

/**
 * PF-153 — every browser sends `Origin` on this request; a plain script does not.
 * A foreign one is already refused by CORS, so this is for the missing header.
 * A filter, not proof: a script can write the header too.
 */
const ignoreOutsiders = (req, res, next) => {
  if (!isAllowedOrigin(req.get('origin'))) return res.status(204).end();
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

const SLUG = /^[a-z0-9-]{1,200}$/;

// PF-149 — the home page's sections, a fixed list: this is client text too.
const HOME_SECTIONS = ['hero', 'about', 'skills', 'projects', 'blog', 'contact'];

const visitRules = [
  body('type').isString().bail().isIn(['view', 'click', 'section', 'read']).withMessage('Unknown visit type'),
  body('path').if(body('type').equals('view'))
    .isString().bail().isLength({ max: 2048 }).withMessage('Path is too long'),
  body('referrer').optional()
    .isString().bail().isLength({ max: 2048 }).withMessage('Referrer is too long'),
  body('link').if(body('type').equals('click'))
    .isString().bail().isIn(['email', 'cv', 'github', 'live']).withMessage('Unknown link'),
  body('sections').if(body('type').equals('section'))
    .isArray({ min: 1, max: HOME_SECTIONS.length }).bail()
    .custom((list) => new Set(list).size === list.length).withMessage('Unknown section'),
  body('sections.*').if(body('type').equals('section'))
    .isString().bail().isIn(HOME_SECTIONS).withMessage('Unknown section'),
  body('slug').if(body('type').equals('read'))
    .isString().bail().matches(SLUG).withMessage('Unknown post'),
];

// ── Turning what the client sent into safe keys ─────────────────────────────

const LISTED_PATHS = new Set(['/', '/blog', '/projects', '/certificates', '/privacy', '/cv-unavailable']);
// 200: a title may be 150 characters (Blog.js), and its slug must not fall into OTHER.
const SLUG_PATH = /^\/(blog|projects|certificates)\/[a-z0-9-]{1,200}$/;

const isAdminPath = (path) => path === '/admin' || path.startsWith('/admin/');

/** A public route as written, or OTHER — never the client's own text. */
const pathKey = (raw) => {
  // One slash only, and no regex: a path of thousands of slashes is client text.
  const path = raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;
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

/**
 * PF-153 — a link to a renamed post is the post's page. The browser forwards and
 * does not count again (VisitTracker), so this view must land on the new address,
 * or the old one would grow a row of its own after moveTotals emptied it.
 */
const currentPath = async (path) => {
  if (!path.startsWith('/blog/')) return path;
  const slug = path.slice('/blog/'.length);
  const moved = await Blog.findOne({ oldSlugs: slug, published: true }).select('slug').lean();
  if (!moved || await Blog.exists({ slug, published: true })) return path;
  return `/blog/${moved.slug}`;
};

const addOne = (day, dim, key, upsert = true) => ({
  updateOne: { filter: { day, dim, key }, update: { $inc: { count: 1 } }, upsert },
});

/** True the FIRST time this code is seen; atomic, so a burst counts once. */
const isFirstToday = async (code, fields = {}) => {
  const result = await VisitorDay.updateOne(
    { _id: code },
    { $setOnInsert: { expiresAt: new Date(Date.now() + KEEP_CODES_MS), ...fields } },
    { upsert: true },
  );
  return result.upsertedCount === 1;
};

/** A new visitor, unless their network has already added its share today. */
const isNewVisitorToday = async (code, source) => {
  if (!await isFirstToday(code, { source })) return false;
  return await VisitorDay.countDocuments({ source }) <= MAX_NEW_VISITORS_PER_NETWORK;
};

/**
 * PF-153 — one person, one post, one read a day. `Blog.views` and the `read` row
 * move together, so the public box and the panel count the same thing. The post
 * is checked first: a draft's address or an invented one writes nothing at all.
 */
const recordRead = async (req, slug) => {
  // `$eq`: the rules already allow only a slug-shaped string, but the query must
  // stay a plain match even without them (an object here would be an operator).
  const post = await Blog.exists({ slug: { $eq: slug }, published: true });
  if (!post) return;
  if (!await isFirstToday(scramble(req.visitorCode, `read|${slug}`))) return;
  await Promise.all([
    // A read is not an edit: updatedAt must not move.
    Blog.updateOne({ _id: post._id }, { $inc: { views: 1 } }, { timestamps: false }),
    VisitTotal.bulkWrite([addOne(req.visitNow.day, 'read', `/blog/${slug}`)]),
  ]);
};

// ── The route ────────────────────────────────────────────────────────────────

/** POST /api/visits — public. Always a bare 204: nothing here is the visitor's business. */
const recordVisit = async (req, res, next) => {
  try {
    const { type, path, referrer, link, sections, slug } = req.body;
    const { day, hour } = req.visitNow;

    if (type === 'click') {
      await VisitTotal.bulkWrite([addOne(day, 'click', link)]);
      return res.status(204).end();
    }

    if (type === 'section') {
      await VisitTotal.bulkWrite(sections.map((section) => addOne(day, 'section', section)));
      return res.status(204).end();
    }

    if (type === 'read') {
      await recordRead(req, slug);
      return res.status(204).end();
    }

    if (isAdminPath(path)) return res.status(204).end();

    const room = await VisitTotal.countDocuments({ day, dim: { $in: ['path', 'referrer'] } })
      < MAX_CLIENT_KEYED_ROWS;

    const writes = [
      addOne(day, 'views', 'all'),
      addOne(day, 'hour', hour),
      addOne(day, 'path', await currentPath(pathKey(path)), room),
    ];

    if (await isNewVisitorToday(req.visitorCode, req.visitorSource)) {
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

    await Promise.all([
      VisitTotal.bulkWrite(writes, { ordered: false }),
      LiveVisitor.updateOne(
        { _id: req.visitorCode },
        { $set: { expiresAt: new Date(Date.now() + LIVE_MS) } },
        { upsert: true },
      ),
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

module.exports = { visitRules, ignoreBots, ignoreOutsiders, identifyVisitor, recordVisit, saltFor, zonedNow };
