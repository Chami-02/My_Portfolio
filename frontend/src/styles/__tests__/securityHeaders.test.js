// PF-120 — the headers Vercel serves the SPA with (frontend/vercel.json).
//
// Before PF-120 the deployed site sent none of these (measured: Vercel's own
// HSTS only). The refresh token lives in localStorage (a locked decision), so
// the Content-Security-Policy is the main backstop against XSS reading it, and
// `frame-ancestors 'none'` stops the admin panel being framed.
//
// ⚠️ WHY THIS TEST EXISTS: every way a CSP breaks is SILENT, and only in
// production. vercel.json applies to the deployed site alone — not `npm run
// dev`, not `vite preview`, not this suite's jsdom. So:
//   - edit the inline FOUC script in index.html and its hash stops matching:
//     the browser refuses to run it, and the theme flash returns on prod only;
//   - move the API (the custom domain) and `connect-src` blocks every fetch:
//     the whole site renders its error states on prod only.
// Both are pinned here, from the files they depend on.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const vercel  = JSON.parse(read('vercel.json'));
const headers = Object.fromEntries(
  vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value])
);
const directives = Object.fromEntries(
  headers['Content-Security-Policy'].split(';').map((d) => d.trim().split(/\s+/))
    .map(([name, ...sources]) => [name, sources])
);

// Every INLINE script in index.html — a <script> with no src attribute.
const inlineScripts = [...read('index.html').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]);
const sha256 = (text) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

describe('vercel.json security headers (PF-120)', () => {
  it('applies to every path', () => {
    // PF-127 added a second block (asset caching, below); the security block
    // itself must still be the catch-all.
    expect(vercel.headers.map((h) => h.source)).toEqual(['/(.*)', '/assets/(.*)']);
  });

  it('allows each inline script in index.html by its exact hash — and nothing inline besides', () => {
    expect(inlineScripts.length).toBeGreaterThan(0);   // control: the FOUC guard is found
    for (const script of inlineScripts) {
      expect(directives['script-src']).toContain(sha256(script));
    }
    const hashes = directives['script-src'].filter((s) => s.startsWith("'sha256-"));
    expect(hashes).toHaveLength(inlineScripts.length);   // no stale hash left behind
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
  });

  it('lets the browser reach the production API named in .env.production', () => {
    const api = read('.env.production').match(/^VITE_API_URL=(.+)$/m)[1].trim();
    expect(directives['connect-src']).toContain(new URL(api).origin);
  });

  it('refuses to be framed, by both mechanisms', () => {
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('keeps the other hardening headers', () => {
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});

// The Docker image (frontend/nginx.conf) serves the same site, so it sends the
// same policy. Only connect-src differs: Docker's API is localhost:5050.
describe('nginx.conf mirrors the vercel.json headers (Docker)', () => {
  const nginx = read('nginx.conf');
  const nginxHeaders = Object.fromEntries(
    [...nginx.matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)].map((m) => [m[1], m[2]])
  );
  const withoutConnect = (csp) => csp.split(';').map((d) => d.trim())
    .filter((d) => !d.startsWith('connect-src')).join('; ');

  it.each(['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'])(
    '%s is identical', (key) => {
      expect(nginxHeaders[key]).toBe(headers[key]);
    },
  );

  it('the CSP is identical apart from connect-src', () => {
    const csp = nginxHeaders['Content-Security-Policy'];
    expect(csp).toBeTruthy();
    expect(withoutConnect(csp)).toBe(withoutConnect(headers['Content-Security-Policy']));
    expect(csp).toMatch(/connect-src 'self' http:\/\/localhost:5050(;|$)/);
  });

  // ⚠️ nginx drops every inherited add_header from a location that declares
  // its own — the old asset block's Cache-Control stripped all of the above
  // from every JS/CSS/image response.
  it('no location block declares its own add_header', () => {
    const locations = [...nginx.matchAll(/location[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(locations.length).toBeGreaterThan(0);
    locations.forEach((body) => expect(body).not.toMatch(/^\s*add_header/m));
  });
});

// PF-127 — Vite names every file in /assets by its content hash, so a changed
// file is a NEW URL and the old one can be cached forever. Without this block
// Vercel sends `max-age=0, must-revalidate` (measured live 2026-10-19) and
// every visit re-asks the server about every file.
//
// ⚠️ The rewrite exclusion is the silent half. The SPA rewrite used to catch
// EVERY path, so a request for a chunk that a newer deploy deleted came back
// as index.html with a 200 (measured live 2026-10-19) — and, with this cache
// header, it would be stored under the chunk's URL for a year. A missing
// asset must 404 instead. (nginx already 404s: its asset location has no
// try_files.)
describe('vercel.json caches hashed assets (PF-127)', () => {
  // A Vercel `source` is a path-to-regexp pattern; these two use only plain
  // regex syntax, so anchoring them is an exact translation.
  const matches = (source, url) => new RegExp(`^${source}$`).test(url);
  const assetBlock = vercel.headers.find((h) => h.source === '/assets/(.*)');

  it('sends a one-year immutable Cache-Control on /assets/*', () => {
    expect(assetBlock.headers).toEqual([
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ]);
    expect(matches(assetBlock.source, '/assets/index-BRPZDQFy.js')).toBe(true);
  });

  it('caches nothing outside /assets — index.html must always be re-fetched', () => {
    const cacheBlocks = vercel.headers.filter((h) => h.headers.some((x) => x.key === 'Cache-Control'));
    expect(cacheBlocks).toEqual([assetBlock]);
    expect(matches(assetBlock.source, '/')).toBe(false);
    expect(matches(assetBlock.source, '/index.html')).toBe(false);
  });

  it('never rewrites a missing asset to index.html, but still rewrites every route', () => {
    expect(vercel.rewrites).toHaveLength(1);
    const { source, destination } = vercel.rewrites[0];
    expect(destination).toBe('/index.html');
    expect(matches(source, '/assets/index-OLDHASH.js')).toBe(false);
    for (const route of ['/', '/blog', '/blog/some-post', '/admin', '/admin/login', '/nope']) {
      expect(matches(source, route)).toBe(true);
    }
  });
});
