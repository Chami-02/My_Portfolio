/**
 * PF-128 — who may keep a copy of an API answer, and for how long.
 *
 * Three pieces, one rule each:
 *
 *   noStore       every response, by default: nobody keeps a copy. Tokens,
 *                 admin data, health checks and errors are never cached.
 *   publicCache   the public GET routes only: Vercel's CDN keeps the answer,
 *                 the browser does not. One copy fits every visitor, because
 *                 no public controller reads the caller's token.
 *   purgeOnWrite  a successful SIGNED-IN write deletes every cached copy, so
 *                 a SAVE in the admin panel shows on the site straight away
 *                 (owner, 2026-10-19).
 *
 * ⚠️ The admin panels read the SAME public URLs (About, Skills, sections,
 * vocabulary), and every admin request carries an `Authorization` header
 * (ProtectedRoute waits for /auth/me before a panel mounts). Two locks keep a
 * cached copy away from them:
 *   - Vercel's CDN never serves or stores a request with `Authorization`;
 *   - the HTTP standard (RFC 9111 §3.5) lets ANY shared cache reuse such an
 *     answer only if `Cache-Control` says `public`, `must-revalidate` or
 *     `s-maxage` — so the header every cache sees says none of them. The CDN
 *     policy lives in `Vercel-CDN-Cache-Control`, which only Vercel reads.
 */
const { waitUntil, dangerouslyDeleteByTag } = require('@vercel/functions');

const PUBLIC_TAG = 'public-data';

// Read by Vercel's CDN only — Vercel strips it before the browser sees it.
// The hour is a safety net for a purge that failed; freshness comes from
// purgeOnWrite, not from the clock.
const CDN_POLICY = 'public, s-maxage=3600, stale-while-revalidate=86400';

// What browsers and any other cache see: stale at once, so the browser asks
// again every time. Deliberately no `public` / `must-revalidate` (see above).
const BROWSER_POLICY = 'max-age=0';

const CDN_HEADERS = ['Vercel-CDN-Cache-Control', 'Vercel-Cache-Tag'];

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

const publicCache = (_req, res, next) => {
  res.set({
    'Cache-Control':            BROWSER_POLICY,
    'Vercel-CDN-Cache-Control': CDN_POLICY,
    'Vercel-Cache-Tag':         PUBLIC_TAG,
  });
  next();
};

/** Undo publicCache — an error answer must never be cached (errorHandler). */
const forgetPublicCache = (res) => {
  CDN_HEADERS.forEach((h) => res.removeHeader(h));
  res.set('Cache-Control', 'no-store');
};

const purge = () =>
  dangerouslyDeleteByTag(PUBLIC_TAG).catch((err) => {
    // Never fails the save: the copy then expires on its own (CDN_POLICY).
    console.error('CDN purge failed — public data may be stale for up to an hour:', err.message);
  });

/**
 * Hooks `res.end` rather than the `finish` event: `end` runs inside the
 * request, where Vercel's request context (which `waitUntil` and the purge
 * need) is still there, and by then `protect` has set `req.user` and the
 * status is final.
 *
 * "Delete", not "invalidate": an invalidated copy is served ONE more time
 * while it refreshes, so the first visitor after a SAVE would see the old
 * site. Visitor writes (blog views, contact form) never purge — they carry
 * no `req.user`. Off Vercel the purge is a no-op.
 */
const purgeOnWrite = (req, res, next) => {
  if (READS.has(req.method)) return next();

  const end = res.end;
  res.end = function endAndPurge(...args) {
    res.end = end;
    if (req.user && res.statusCode < 400) waitUntil(purge());
    return end.apply(this, args);
  };
  next();
};

module.exports = { noStore, publicCache, forgetPublicCache, purgeOnWrite, PUBLIC_TAG };
