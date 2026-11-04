import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLogo } from '../useLogo';

/*
 * PF-134, PF-146 — every logo on the site reads useLogo(), so a new logo is
 * one file swap. The owner brought the photo logo back in PF-146.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../..');
const ROOT = resolve(SRC, '..');

function Probe() {
  const logo = useLogo();
  return <img alt="probe" src={logo} />;
}

const srcOf = () => screen.getByAltText('probe').getAttribute('src');

describe('useLogo (PF-146)', () => {
  it('serves the photo logo', () => {
    render(<Probe />);
    expect(srcOf()).toMatch(/logo\.webp/);
  });
});

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// Every place the logo renders — the six from the Sprint 15 plan, with the
// navbar's mobile overlay inside Navbar.jsx and BrandMark covering the
// sign-in, forgot-password and loading screens.
const LOGO_SITES = [
  'components/splash/Splash.jsx',
  'components/layout/Navbar.jsx',
  'components/layout/Footer.jsx',
  'components/admin/AdminLayout.jsx',
  'components/admin/AdminFooter.jsx',
  'components/common/BrandMark.jsx',
];

describe('the logo has one source (PF-134)', () => {
  it('no source file imports a logo asset except useLogo', () => {
    const offenders = walk(SRC)
      .filter((p) => /\.(jsx?|css)$/.test(p) && !p.includes('__tests__'))
      .filter((p) => !p.endsWith(join('hooks', 'useLogo.js')))
      .filter((p) => /assets\/logo[-.]/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(SRC, p));
    expect(offenders).toEqual([]);
  });

  it.each(LOGO_SITES)('%s renders the logo through useLogo()', (file) => {
    const code = readFileSync(resolve(SRC, file), 'utf8');
    expect(code).toMatch(/import \{ useLogo \} from '\.\.\/\.\.\/hooks\/useLogo';/);
    expect(code).toMatch(/const logo = useLogo\(\);/);
    expect(code).toMatch(/src=\{logo\}/);
  });

  it('the Orbit PG site files are gone', () => {
    expect(existsSync(resolve(SRC, 'assets/logo.webp'))).toBe(true);
    expect(existsSync(resolve(SRC, 'assets/logo-dark.svg'))).toBe(false);
    expect(existsSync(resolve(SRC, 'assets/logo-light.svg'))).toBe(false);
  });

  it('index.html links every icon file, and each one exists in public/', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    for (const file of ['favicon.ico', 'favicon-96.png', 'apple-touch-icon.png']) {
      expect(html).toContain(`href="/${file}"`);
      expect(existsSync(resolve(ROOT, 'public', file))).toBe(true);
    }
  });

  it('the PG tab icons are gone', () => {
    expect(readFileSync(resolve(ROOT, 'index.html'), 'utf8')).not.toContain('favicon-dark');
    expect(existsSync(resolve(ROOT, 'public/favicon-dark.svg'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'public/favicon-light.svg'))).toBe(false);
  });
});
