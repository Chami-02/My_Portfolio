// frontend/src/utils/nav.js
//
// The header's link model — 2026-08-22.
//
// ⚠️ Its own module, and React-free, for the SAME reason contexts are
// (see CLAUDE.md's React conventions): `react-refresh/only-export-
// components` makes a file that exports both a component and a plain
// function force a full page reload on every edit instead of a hot
// swap, and CI runs ESLint with --max-warnings=0. Living here also
// makes it directly unit-testable, matching utils/theme.js,
// utils/motion.js, utils/splash.js and utils/parallax.js.

/**
 * ⚠️ `?nosplash=1` is the PROTOTYPE'S OWN mechanism, not an invention.
 *
 * Blog.dc.html points all five of its cross-screen links at
 * `Portfolio Revolution.dc.html?nosplash=1…` (lines 45, 51, 52, 53, 60),
 * and utils/splash.js's shouldShowSplash() already reads the param —
 * `.has('nosplash')`, so the `=1` is cosmetic agreement with the design
 * rather than a parsed value.
 *
 * Without it, navigating home from /blog replays the ~5.65s splash OVER
 * the anchor jump, while HomePage's `initialReady={false}` holds every
 * reveal for the duration.
 *
 * Deliberately NOT a module-scoped "already shown this session" flag:
 * StrictMode's simulated remount would set it on the first mount and
 * suppress the splash on the second, so the splash would never appear in
 * development at all. Same dev-only footgun class as the
 * setReady(true)-on-unmount safety net SplashProvider documents.
 */
const HOME = '/?nosplash=1';

/**
 * A link to one of the home page's sections, correct from any route.
 *
 * The single route-aware primitive — `navModel()` (the header) and
 * `Footer` (PF-88) both build their hrefs from it, so the `?nosplash=1`
 * convention and the on-home passthrough are expressed once.
 *
 * ⚠️ On "/" the bare hash is returned UNCHANGED. e2e selects on
 * `a[href="#about"]`, and a plain in-page hash is what makes the
 * browser's own smooth scroll (global.css/tokens.css) do the work
 * instead of ScrollToHash.
 */
export function sectionHref(pathname, id) {
  return pathname === '/' ? `#${id}` : `${HOME}#${id}`;
}

/** The portfolio's own sections, in the prototype's header order. */
const SECTIONS = [
  { id: 'about', label: 'ABOUT' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'blog', label: 'BLOG' },
];

/**
 * Which chrome does this path get?
 *
 * `/blog` and `/blog/:slug` render the Blog prototype's own nav; every
 * other public path renders the portfolio's. Admin is not reached at all
 * — App.jsx routes `/admin/*` to `null` for this component, and
 * Admin.dc.html specifies an entirely different header (sticky, z-40,
 * 40px logo, no theme toggle, no ADMIN link) that Phase 1's AdminLayout
 * still owns.
 */
export function isBlogPath(pathname) {
  return pathname === '/blog' || pathname.startsWith('/blog/');
}

/**
 * Build the header's links for a path.
 *
 * ⚠️ THE BUG THIS FIXES. Every link used to be a bare hash, while
 * App.jsx mounts this component on `path="*"` — so on NotFoundPage and
 * on /blog all six resolved to nothing. PF-86 then pointed five Blog
 * teaser links at /blog, which has no route, putting the dead chrome two
 * clicks from the home page.
 *
 * On "/" the hashes are returned UNCHANGED, so the home page's behaviour
 * — and e2e's `a[href="#about"]` selectors — are untouched.
 */
export function navModel(pathname) {
  const onHome = pathname === '/';

  // The Blog prototype's own nav content, transcribed from
  // Blog.dc.html lines 50-61: PROJECTS · ABOUT · ← PORTFOLIO · divider ·
  // toggle · ADMIN. No BLOG link — you are on it — and no CONTACT; the
  // glowpulse pill goes home instead. This is the one part of the
  // 2026-08-22 navbar rework that is transcription rather than
  // deviation.
  if (isBlogPath(pathname)) {
    return {
      variant: 'blog',
      brandHref: HOME,
      links: [
        { href: `${HOME}#projects`, label: 'PROJECTS' },
        { href: `${HOME}#about`, label: 'ABOUT' },
      ],
      pillHref: HOME,
      pillLabel: '\u2190 PORTFOLIO',
    };
  }

  return {
    variant: 'portfolio',
    brandHref: onHome ? '#hero' : HOME,
    links: SECTIONS.map(({ id, label }) => ({
      href: sectionHref(pathname, id),
      label,
    })),
    pillHref: sectionHref(pathname, 'contact'),
    pillLabel: 'CONTACT',
  };
}
