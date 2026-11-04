// PF-146 (owner, 2026-11-04) — the site's name is PARINDRA GALLAGE. The old
// PARINDRA.DEV looked like a web address the owner does not hold, so a visitor
// typing it would not find this site. It lived in JSX and in the security
// emails; split markup (`PARINDRA<span>.</span>DEV`) hid it from a plain search.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const OLD_NAME = /parindra\s*(<[^>]*>)?\s*\.\s*(<\/[^>]*>)?\s*dev/i;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

describe('the site name', () => {
  const files = ['frontend/src', 'backend/src']
    .flatMap((dir) => walk(path.join(repo, dir)))
    .filter((file) => /\.(jsx?|css|html)$/.test(file) && file !== fileURLToPath(import.meta.url))
    .concat(path.join(repo, 'frontend/index.html'));

  it('reads the real source folders', () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.some((f) => f.endsWith('services/alertEmail.js'))).toBe(true);
    expect(files.some((f) => f.endsWith('layout/Navbar.jsx'))).toBe(true);
  });

  it('never says PARINDRA.DEV, however the markup splits it', () => {
    const offenders = files.filter((file) => OLD_NAME.test(fs.readFileSync(file, 'utf8')));
    expect(offenders.map((f) => path.relative(repo, f))).toEqual([]);
  });

  it('the pattern catches the forms the old name took', () => {
    for (const old of ['PARINDRA.DEV', 'parindra.dev', 'PARINDRA<span className={styles.brandDot}>.</span>DEV']) {
      expect(old).toMatch(OLD_NAME);
    }
    expect('parindragallage.com').not.toMatch(OLD_NAME);
  });
});
