// frontend/src/pages/__tests__/HomePage.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every section is stubbed. This file is about HomePage's own shape —
// which sections it mounts and what it wraps them in — not about what
// any section renders. Those have their own tests.
vi.mock('../../components/sections/HeroSection', () => ({
  HeroSection: () => { throw new Error('hero exploded'); },
}));
vi.mock('../../components/sections/AboutSection', () => ({
  AboutSection: () => <div data-testid="about" />,
}));
vi.mock('../../components/sections/SkillsSection', () => ({
  SkillsSection: () => <div data-testid="skills" />,
}));
vi.mock('../../components/sections/ProjectsSection', () => ({
  ProjectsSection: () => <div data-testid="projects" />,
}));
vi.mock('../../components/sections/BlogSection', () => ({
  BlogSection: () => <div data-testid="blog" />,
}));
// Conditionally explosive, unlike the others: PF-87 wraps Contact in an
// ErrorBoundary and the guard for that needs a throw it can turn on for
// one test without breaking every other assertion in the file.
const contactThrows = vi.hoisted(() => ({ value: false }));
vi.mock('../../components/sections/ContactSection', () => ({
  ContactSection: () => {
    if (contactThrows.value) throw new Error('contact exploded');
    return <div data-testid="contact" />;
  },
}));

import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '../HomePage';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';

describe('HomePage', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })));
    // ErrorBoundary logs the caught error; keep the run readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    contactThrows.value = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * PF-80. Hero was bare until this ticket, and there is no
   * ErrorBoundary anywhere above it — not in App.jsx, not around <App />
   * in main.jsx — so a throw here unmounted the whole root and left an
   * empty page: no navbar, no footer, no sections. Verified by probe
   * before the wrap was added, and this test is the guard: unwrap Hero
   * in HomePage.jsx and it fails, because the throw escapes render.
   */
  it('keeps the rest of the page alive when Hero throws', () => {
    // MemoryRouter as of 2026-08-22, QueryClientProvider as of PF-94:
    // HomePage mounts <ScrollToHash />, which calls useLocation() and
    // now useIsFetching() too. Every section here is stubbed, so this
    // file needed neither before — in the real app HomePage is always
    // inside App.jsx's <BrowserRouter> and main.jsx's
    // <QueryClientProvider>, so this is the test catching up with the
    // component rather than a new coupling. Without the provider the
    // render throws "No QueryClient set", which reads like a data-layer
    // bug and is not one.
    expect(() => render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ThemeProvider><MotionProvider><HomePage /></MotionProvider></ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )).not.toThrow();

    ['about', 'skills', 'projects', 'blog', 'contact'].forEach((id) =>
      expect(screen.getByTestId(id)).toBeInTheDocument());
  });

  /**
   * PF-87. Contact was the LAST bare section — Hero got its boundary in
   * PF-80 and the middle four in PF-80/82 — so until this ticket a throw
   * here had the same whole-root consequence Hero's did: App.jsx uses
   * React Router's legacy component API, which has no errorElement, and
   * there is no boundary around <App /> in main.jsx either. Unwrap
   * <ContactSection /> in HomePage.jsx and this fails, because the throw
   * escapes render() entirely rather than being caught one level down.
   */
  it('keeps the rest of the page alive when Contact throws', () => {
    contactThrows.value = true;

    expect(() => render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ThemeProvider><MotionProvider><HomePage /></MotionProvider></ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )).not.toThrow();

    // Contact itself is gone — it is the section that threw — but every
    // other section is still standing, which is the whole point.
    expect(screen.queryByTestId('contact')).toBeNull();
    ['about', 'skills', 'projects', 'blog'].forEach((id) =>
      expect(screen.getByTestId(id)).toBeInTheDocument());
  });

  // ══════════════════════════════════════════════════════════════════
  /**
   * ── PF-106: `?nosplash` is taken back out of the address bar ────────
   *
   * WHY THIS MATTERS AND IS NOT TIDYING. Every nav link on /blog points at
   * `/?nosplash=1`, so returning home leaves the param in the URL. The
   * rule the owner asked for is "refresh on the main page replays the
   * intro", and `shouldShowSplash()` reads that param on every load — so
   * without the strip, refresh would replay on a hand-typed `/` and
   * silently NOT replay on the URL the site's own navigation produces.
   * One button, two behaviours, decided by how the visitor got there.
   *
   * ⚠️ Asserted on `window.location`, not on the MemoryRouter: the strip
   * is a `history.replaceState` against the real document location,
   * because that is what a refresh re-reads. A router-level assertion
   * would pass while the address bar kept the param.
   */
  describe('the ?nosplash strip (PF-106)', () => {
    const at = (url) => window.history.replaceState({}, '', url);
    const draw = () => render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ThemeProvider><MotionProvider><HomePage /></MotionProvider></ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    afterEach(() => { window.history.replaceState({}, '', '/'); });

    it('removes the param, leaving a clean path a refresh can replay from', () => {
      at('/?nosplash=1');
      draw();
      expect(window.location.search).toBe('');
      expect(window.location.pathname).toBe('/');
    });

    it('KEEPS the hash, which ScrollToHash is still waiting on', () => {
      // A nav click from /blog arrives as `/?nosplash=1#projects`. Dropping
      // the hash with the query would strand the visitor at the top of the
      // page — a silent failure, since nothing errors.
      at('/?nosplash=1#projects');
      draw();
      expect(window.location.search).toBe('');
      expect(window.location.hash).toBe('#projects');
    });

    it('leaves other params alone', () => {
      // Only the one key is dropped. A blanket `search = ''` would eat
      // campaign params and anything a future feature puts there.
      at('/?nosplash=1&utm_source=x');
      draw();
      expect(window.location.search).toBe('?utm_source=x');
    });

    it('does nothing when there is no param to remove', () => {
      // The control: a strip that always rewrote the URL would pass every
      // assertion above while pushing a history entry on every home visit.
      at('/#about');
      const before = window.history.length;
      draw();
      expect(window.location.pathname + window.location.hash).toBe('/#about');
      expect(window.history.length).toBe(before);
    });

    it('does not add a history entry — replaceState, not pushState', () => {
      // A pushed entry would put a Back step between the visitor and
      // /blog that they never asked for.
      at('/?nosplash=1');
      const before = window.history.length;
      draw();
      expect(window.history.length).toBe(before);
    });
  });
});
