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

const html = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../index.html'), 'utf8');

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
    expect(meta('name', 'twitter:card')).toBe('summary');
  });

  // Until the custom domain: an absolute vercel.app address would be stale
  // the day the domain lands. Remove this case when og:url/og:image are added.
  it('pins no absolute address yet', () => {
    expect(meta('property', 'og:url')).toBeNull();
    expect(meta('property', 'og:image')).toBeNull();
  });
});
