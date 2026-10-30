import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { useTheme } from '../useTheme';
import { useLogo } from '../useLogo';

/*
 * PF-134 — one logo, two skies. The theme picks the file, and every logo on
 * the site reads it through useLogo(), so a new logo is two file swaps.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../..');
const ROOT = resolve(SRC, '..');

function Probe() {
  const logo = useLogo();
  const { toggle } = useTheme();
  return <img alt="probe" src={logo} onClick={toggle} />;
}

const srcOf = () => screen.getByAltText('probe').getAttribute('src');

describe('useLogo (PF-134)', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  it('serves the night-sky logo on the dark theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(srcOf()).toMatch(/logo-dark\.svg/);
  });

  it('serves the paper-sky logo on the light theme FROM THE FIRST RENDER (no flash)', () => {
    // The head script sets data-theme before React; the first src must
    // already be the light file, not dark-then-light.
    document.documentElement.setAttribute('data-theme', 'light');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(srcOf()).toMatch(/logo-light\.svg/);
  });

  it('follows the theme toggle', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByAltText('probe').click(); });
    expect(srcOf()).toMatch(/logo-light\.svg/);
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

  it('the photo logo is gone', () => {
    expect(existsSync(resolve(SRC, 'assets/logo.webp'))).toBe(false);
  });

  it('index.html links every favicon file, and each one exists in public/', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    // the SVG link starts on the dark file — the default theme
    for (const file of ['favicon.ico', 'favicon-dark.svg', 'apple-touch-icon.png']) {
      expect(html).toContain(`href="/${file}"`);
      expect(existsSync(resolve(ROOT, 'public', file))).toBe(true);
    }
  });

  // applyTheme() builds `/favicon-${theme}.svg` — every theme needs its file.
  it.each([['dark', '#14213D'], ['light', '#FBF8F3']])(
    'public/favicon-%s.svg exists and is that sky', (theme, sky) => {
      const svg = readFileSync(resolve(ROOT, `public/favicon-${theme}.svg`), 'utf8');
      expect(svg).toContain(sky);
      expect(svg).not.toMatch(/<script/i);
    },
  );
});
