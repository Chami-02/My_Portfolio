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
    expect(vercel.headers.map((h) => h.source)).toEqual(['/(.*)']);
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
