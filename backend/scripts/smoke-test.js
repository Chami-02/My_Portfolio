#!/usr/bin/env node
// backend/scripts/smoke-test.js
//
// The check that runs immediately AFTER a deploy, against the real deployed
// site, to answer one question: is it actually serving?
//
//   node scripts/smoke-test.js https://api.example.com [expected-db] [site-url]
//
// ── WHAT A SMOKE TEST IS ────────────────────────────────────────────────────
// The name comes from hardware: power the board up and see whether smoke comes
// out. It is not a test suite. It is a handful of assertions that a deploy
// which built fine and passed every unit test is nevertheless not broken in
// the ways only a real environment can break it — wrong environment variable,
// unreachable database, missing secret, bad rewrite rule.
//
// ⚠️ THE ONE ASSERTION THAT MATTERS, AND WHY IT IS NOT THE STATUS CODE.
// `/api/health` is registered BEFORE the `connectDB()` middleware in app.js and
// swallows connection errors on purpose, so it answers `200 OK` with
// `database: null` while the database is completely unreachable. This project
// has had exactly that production outage: every status-code monitor stayed
// green for its whole duration.
//
// So the assertion is on the `database` FIELD being a non-null string. A smoke
// test that checked `res.status === 200` would have passed throughout the
// outage it exists to catch.
//
// ⚠️ THE SITE CHECKS (optional 3rd argument, PF-126 follow-up). The frontend
// bakes the API address into its JavaScript at BUILD time. The pipeline's first deploy
// shipped a bundle whose API address was the literal `[SENSITIVE]` (an
// unpullable Vercel variable), so the site called itself and showed nothing —
// while every check above stayed green, because the backend was fine. Given a
// site URL, this script loads the page, finds its entry script and asserts the
// script names THIS API.
//
// ⚠️ "Its script" means EVERY script the page loads up front, not just the
// entry. Since PF-127 (route splitting) Rollup moves shared code — the API
// client included — into a chunk the entry imports and index.html preloads
// (`<link rel="modulepreload" href="/assets/ambient-….js">`). Reading only the
// entry failed the first PF-127 deploy while the site was healthy.

const BASE = (process.argv[2] || '').replace(/\/+$/, '');
const EXPECTED_DB = process.argv[3] || null;   // optional, e.g. portfolio_prod
const SITE = (process.argv[4] || '').replace(/\/+$/, '');   // optional, the frontend

if (!BASE) {
  console.error('Usage: node scripts/smoke-test.js <base-url> [expected-db-name] [site-url]');
  process.exit(1);
}

const TIMEOUT_MS = 15000;

const request = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON — reported below */ }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
};

const get = (path) => request(`${BASE}${path}`);

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('GET /api/health answers at all', async () => {
  const { status } = await get('/api/health');
  if (status !== 200) throw new Error(`expected 200, got ${status}`);
});

check('…and its `database` field names a real database', async () => {
  // ⚠️ THE LOAD-BEARING ONE. See the header.
  const { json } = await get('/api/health');
  if (!json) throw new Error('response was not JSON');

  const db = json.database;
  if (typeof db !== 'string' || db.length === 0) {
    throw new Error(
      `database is ${JSON.stringify(db)} — the API is up but has NO database. ` +
      'This is the state that returns 200 and serves nothing.'
    );
  }
  if (EXPECTED_DB && db !== EXPECTED_DB) {
    throw new Error(`connected to "${db}", expected "${EXPECTED_DB}"`);
  }
  return db;
});

check('GET /api/about returns the profile', async () => {
  // One real read through the full stack: route → controller → model → Mongo.
  // Health only proves a connection exists; this proves a query works.
  const { status, json } = await get('/api/about');
  if (status !== 200) throw new Error(`expected 200, got ${status}`);
  if (!json?.data?.email) throw new Error('no profile data in the response');
  return json.data.email;
});

check('GET /api/blog returns the post list', async () => {
  const { status, json } = await get('/api/blog');
  if (status !== 200) throw new Error(`expected 200, got ${status}`);
  const posts = json?.data ?? json?.posts;
  if (!Array.isArray(posts)) throw new Error('post list was not an array');
  return `${posts.length} posts`;
});

if (SITE) {
  let pageScripts = null;

  check('GET <site>/ serves the app', async () => {
    const { status, text } = await request(`${SITE}/`);
    if (status !== 200) throw new Error(`expected 200, got ${status}`);
    // Vite writes one module entry: <script type="module" crossorigin src="/assets/index-….js">
    const src = text.match(/<script\b[^>]*\bsrc="([^"]*\/assets\/[^"]+\.js)"/)?.[1];
    if (!src) throw new Error('no /assets/*.js entry script in the page');
    // …plus the shared chunks it preloads (see the PF-127 note above).
    const preloads = [...text.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]*\/assets\/[^"]+\.js)"/g)]
      .map((m) => m[1]);
    pageScripts = [src, ...preloads].map((s) => new URL(s, `${SITE}/`).href);
    return [src, ...preloads].join(' + ');
  });

  check('…and its script calls THIS API', async () => {
    if (!pageScripts) throw new Error('skipped — the page itself did not load');
    let mentions = false;
    for (const url of pageScripts) {
      const { status, text } = await request(url);
      if (status !== 200) throw new Error(`${new URL(url).pathname} answered ${status}`);
      if (text.includes('[SENSITIVE]')) {
        throw new Error('the bundle contains a [SENSITIVE] placeholder — a Vercel Sensitive variable was built in unreadable');
      }
      if (text.includes(BASE)) mentions = true;
    }
    if (!mentions) {
      throw new Error(`the bundle never mentions ${BASE} — the site would call itself instead of the API`);
    }
    return BASE;
  });
}

(async () => {
  console.log('');
  console.log(`Smoke testing: ${BASE}${SITE ? ` + ${SITE}` : ''}`);
  console.log('─'.repeat(64));

  let failed = 0;

  for (const { name, fn } of checks) {
    try {
      const detail = await fn();
      console.log(`  ✅ ${name}${detail ? `  → ${detail}` : ''}`);
    } catch (err) {
      console.error(`  ✖  ${name}`);
      console.error(`      ${err.message}`);
      failed += 1;
    }
  }

  console.log('─'.repeat(64));

  if (failed) {
    console.error(`\n${failed} smoke check(s) failed — the deploy is NOT healthy.\n`);
    process.exit(1);
  }

  console.log('\nAll smoke checks passed.\n');
})();
