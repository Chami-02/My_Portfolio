import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../../../index.html'), 'utf8');

describe('FOUC guard (PF-71)', () => {

  it('contains an inline script reading pg-theme', () => {
    expect(html).toMatch(/localStorage\.getItem\(['"]pg-theme['"]\)/);
  });

  it('sets data-theme on documentElement', () => {
    expect(html).toMatch(/documentElement\.setAttribute\(\s*['"]data-theme['"]/);
  });

  // The script must run before first paint. defer or async would
  // schedule it after, which is exactly the flash this prevents.
  it('is neither deferred nor async', () => {
    const guard = html.slice(
      html.indexOf('pg-theme') - 400,
      html.indexOf('pg-theme')
    );
    expect(guard).not.toMatch(/<script[^>]*\bdefer\b/);
    expect(guard).not.toMatch(/<script[^>]*\basync\b/);
  });

  // Placement: scripts run in document order, so the guard must
  // appear before the stylesheet link or the CSS applies first.
  it('appears before any stylesheet link', () => {
    const guardAt = html.indexOf('pg-theme');
    const sheetAt = html.search(/<link[^>]*rel=["']stylesheet["']/);

    expect(guardAt).toBeGreaterThan(-1);
    if (sheetAt > -1) expect(guardAt).toBeLessThan(sheetAt);
  });

  // localStorage throws in Safari private mode. An uncaught throw
  // here aborts head parsing and the page renders unstyled.
  it('wraps localStorage access in try/catch', () => {
    const guardBlock = html.slice(
      html.indexOf('pg-theme') - 300,
      html.indexOf('pg-theme') + 500
    );
    expect(guardBlock).toMatch(/try\s*\{/);
    expect(guardBlock).toMatch(/catch\s*\(/);
  });

  it('falls back to dark for any value other than light', () => {
    expect(html).toMatch(/===\s*['"]light['"]\s*\?\s*['"]light['"]\s*:\s*['"]dark['"]/);
  });

});