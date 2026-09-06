// frontend/src/utils/__tests__/nav.test.js
import { describe, it, expect } from 'vitest';
import { navModel, isBlogPath, sectionHref } from '../nav';

/**
 * ⚠️ THE BUG THIS COVERS. App.jsx mounts <Navbar /> on `path="*"`, and
 * every link used to be a bare hash — so on NotFoundPage and on /blog
 * all six resolved to nothing. PF-86 then pointed five Blog-teaser links
 * at /blog, which has no route, putting the dead chrome two clicks from
 * the home page.
 *
 * The "/" case is the regression guard that the HOME page did not
 * change: e2e's `a[href="#about"]` selectors depend on those staying
 * bare hashes.
 */
describe('navModel / isBlogPath (2026-08-22)', () => {
  it('leaves "/" hashes bare — the home page does not change', () => {
    const m = navModel('/');
    expect(m.links.map((l) => l.href)).toEqual([
      '#about', '#skills', '#projects', '#blog',
    ]);
    expect(m.pillHref).toBe('#contact');
    expect(m.brandHref).toBe('#hero');
  });

  it('makes portfolio links absolute off "/", carrying ?nosplash=1', () => {
    const m = navModel('/this-page-does-not-exist');
    expect(m.links.map((l) => l.href)).toEqual([
      '/?nosplash=1#about',
      '/?nosplash=1#skills',
      '/?nosplash=1#projects',
      '/?nosplash=1#blog',
    ]);
    expect(m.pillHref).toBe('/?nosplash=1#contact');
    expect(m.brandHref).toBe('/?nosplash=1');
  });

  /**
   * ⚠️ PF-103 (owner-requested 2026-09-05) REPLACED the transcription here.
   * Blog.dc.html:50-61 says PROJECTS · ABOUT · ← PORTFOLIO; this asserts the
   * deviation, so restoring the prototype's set turns the suite red rather
   * than passing as a fidelity fix.
   */
  it('gives /blog the portfolio sections plus a GO BACK pill', () => {
    const m = navModel('/blog');
    expect(m.variant).toBe('blog');
    // Left to right, and CONTACT is a plain link here — on "/" it is the pill.
    expect(m.links.map((l) => l.label)).toEqual(['ABOUT', 'SKILLS', 'PROJECTS', 'CONTACT']);
    // No BLOG link — you are on it.
    expect(m.links.map((l) => l.label)).not.toContain('BLOG');
    // Absolute, and carrying the prototype's own ?nosplash=1.
    expect(m.links.map((l) => l.href)).toEqual([
      '/?nosplash=1#about',
      '/?nosplash=1#skills',
      '/?nosplash=1#projects',
      '/?nosplash=1#contact',
    ]);
    expect(m.pillLabel).toBe('← GO BACK');
    expect(m.pillHref).toBe('/?nosplash=1');
  });

  it('gives a post path the same nav as the index', () => {
    // The links are built from `pathname`, so a second route is what proves
    // sectionHref's off-home branch is reached rather than a literal.
    expect(navModel('/blog/a-post').links).toEqual(navModel('/blog').links);
  });

  it('treats a post path as blog, and /blogroll as not', () => {
    // startsWith('/blog') alone would claim /blogroll and /blogging.
    expect(isBlogPath('/blog')).toBe(true);
    expect(isBlogPath('/blog/some-slug')).toBe(true);
    expect(isBlogPath('/blogroll')).toBe(false);
    expect(isBlogPath('/')).toBe(false);
  });

  /* ── sectionHref — PF-88 ─────────────────────────────────────────── */

  it('returns a bare hash for a section on the home page', () => {
    // e2e selects on a[href="#about"], and a bare in-page hash is what
    // lets the browser's own smooth scroll do the work rather than
    // ScrollToHash.
    expect(sectionHref('/', 'about')).toBe('#about');
    expect(sectionHref('/', 'hero')).toBe('#hero');
  });

  it.each(['/blog', '/blog/a-post', '/nope'])(
    'returns an absolute ?nosplash=1 link from %s',
    (path) => {
      expect(sectionHref(path, 'projects')).toBe('/?nosplash=1#projects');
    },
  );

  it('is the single source navModel builds its section links from', () => {
    // One route-aware helper, not two — the footer (PF-88) and the
    // header build hrefs the same way, so the ?nosplash=1 convention is
    // expressed once.
    const m = navModel('/nope');
    expect(m.links.map((l) => l.href)).toEqual(
      ['about', 'skills', 'projects', 'blog'].map((id) => sectionHref('/nope', id)),
    );
    expect(m.pillHref).toBe(sectionHref('/nope', 'contact'));
  });
});
