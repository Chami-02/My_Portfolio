// The link-preview tags in index.html (2026-10-14).
//
// ⚠️ A preview is read by LinkedIn / WhatsApp / Slack, never by a browser, so
// a stale og:title is invisible on the site itself — it only shows when the
// link is shared. They are pinned to the page's own <title> and description,
// so editing one without the other fails here instead of in someone's chat.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const meta = (attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? m[1] : null;
};
const title = html.match(/<title>([^<]*)<\/title>/)[1];

describe('link-preview tags', () => {
  it('og:title is the page title', () => {
    expect(meta('property', 'og:title')).toBe(title);
  });

  it('og:description is the meta description', () => {
    const description = meta('name', 'description');
    expect(description).toBeTruthy();
    expect(meta('property', 'og:description')).toBe(description);
  });

  it('declares the basics', () => {
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:site_name')).toBe('Parindra Gallage');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  // PF-146 — these must be absolute, and on the real address.
  it('points at the live address', () => {
    expect(meta('property', 'og:url')).toBe('https://parindragallage.com/');
    expect(meta('property', 'og:image')).toBe('https://parindragallage.com/og-image.png');
  });

  // A PNG states its size in its first bytes: width at 16, height at 20.
  it('the preview image exists at the size the tags promise', () => {
    const png = fs.readFileSync(path.join(root, 'public/og-image.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(String(png.readUInt32BE(16))).toBe(meta('property', 'og:image:width'));
    expect(String(png.readUInt32BE(20))).toBe(meta('property', 'og:image:height'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  // PF-146 — what search engines read first.
  it('robots.txt keeps crawlers out of the admin and names the sitemap', () => {
    const robots = fs.readFileSync(path.join(root, 'public/robots.txt'), 'utf8');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Disallow: \/admin$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/parindragallage\.com\/sitemap\.xml$/m);
  });
});

// PF-149. The name Google shows above a result (Search Central, "site names").
// A typo here costs nothing visible: Google just keeps showing the bare address.
describe('the site name for search results', () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const site = blocks.length === 1 ? JSON.parse(blocks[0][1]) : null;

  it('is one block of valid JSON', () => {
    expect(blocks).toHaveLength(1);
    expect(site['@context']).toBe('https://schema.org');
    expect(site['@type']).toBe('WebSite');
  });

  it('is the owner\'s name, the same one link previews use', () => {
    expect(site.name).toBe('Parindra Gallage');
    expect(site.name).toBe(meta('property', 'og:site_name'));
  });

  it('points at the home page, and keeps the domain as the last fallback', () => {
    expect(site.url).toBe(meta('property', 'og:url'));
    expect(site.alternateName.at(-1)).toBe('parindragallage.com');
  });
});

describe('the icon Google shows beside a result', () => {
  it('the home page names a square icon bigger than 48px, in a place Google can fetch', () => {
    expect(html).toContain('<link rel="icon" type="image/png" href="/favicon-96.png" sizes="96x96" />');
    const robots = fs.readFileSync(path.join(root, 'public/robots.txt'), 'utf8');
    expect(robots.match(/^Disallow: .*$/gm)).toEqual(['Disallow: /admin']);
  });
});
