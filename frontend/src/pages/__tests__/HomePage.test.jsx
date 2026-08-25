// frontend/src/pages/__tests__/HomePage.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every section is stubbed. This file is about HomePage's own shape —
// which sections it mounts and what it wraps them in — not about what
// any section renders. Those have their own tests.
vi.mock('../../components/sections/HeroSection', () => ({
  HeroSection: () => { throw new Error('hero exploded'); },
}));
// ⚠️ About's stub renders a REAL Reveal (PF-88). The replay tests below
// assert that every reveal resets to hidden, and a plain <div> stub
// would let that pass while asserting nothing — the failure mode the
// ticket calls "the part that looks like it works".
vi.mock('../../components/sections/AboutSection', async () => {
  const { Reveal } = await import('../../components/motion');
  return {
    AboutSection: () => <Reveal data-testid="about">about</Reveal>,
  };
});
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
    // MemoryRouter as of 2026-08-22: HomePage mounts <ScrollToHash />,
    // which calls useLocation(). Every section here is stubbed, so this
    // file needed no router before — in the real app HomePage is always
    // inside App.jsx's <BrowserRouter>, so this is the test catching up
    // with the component rather than a new coupling.
    expect(() => render(
      <MemoryRouter>
        <ThemeProvider><MotionProvider><HomePage /></MotionProvider></ThemeProvider>
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
        <ThemeProvider><MotionProvider><HomePage /></MotionProvider></ThemeProvider>
      </MemoryRouter>,
    )).not.toThrow();

    // Contact itself is gone — it is the section that threw — but every
    // other section is still standing, which is the whole point.
    expect(screen.queryByTestId('contact')).toBeNull();
    ['about', 'skills', 'projects', 'blog'].forEach((id) =>
      expect(screen.getByTestId(id)).toBeInTheDocument());
  });

  /* ── PF-88 — REPLAY INTRO ────────────────────────────────────────────
   *
   * `replayCount` is a prop because <Footer /> is a SIBLING of this page
   * in App.jsx, not a child; App.jsx owns the counter. Raising it here
   * is exactly what a click on the footer's button does.
   *
   * These tests run with ?nosplash so the page starts with no splash and
   * ready:true — the reveals are already IN, which is the only state in
   * which "replay resets them" can be observed at all.
   */
  describe('replay', () => {
    const withRouter = (ui) => (
      <MemoryRouter>
        <ThemeProvider><MotionProvider>{ui}</MotionProvider></ThemeProvider>
      </MemoryRouter>
    );

    beforeEach(() => {
      window.history.replaceState({}, '', '/?nosplash');
    });

    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('mounts a fresh splash when replayCount rises', () => {
      const { rerender } = render(withRouter(<HomePage replayCount={0} />));
      // ?nosplash — nothing on screen yet.
      expect(screen.queryByText(/Booting portfolio/i)).toBeNull();

      rerender(withRouter(<HomePage replayCount={1} />));
      expect(screen.getByText(/Booting portfolio/i)).toBeInTheDocument();
    });

    /**
     * ⚠️ THE TEST THAT MATTERS. Our Reveal sets `revealed` true once and
     * never unsets it, so closing the readiness gate alone leaves an
     * already-revealed page revealed: the splash plays over a fully
     * revealed page and lifts on a static one. No error, nothing red —
     * it simply does not do what the button says.
     *
     * Mutation-tested by removing `key={replayCount}` from the Fragment
     * in HomePage: the splash still mounts, every other test here still
     * passes, and this one fails.
     */
    it('resets an already-revealed section back to hidden', () => {
      const { rerender } = render(withRouter(<HomePage replayCount={0} />));
      expect(screen.getByTestId('about')).toHaveAttribute('data-reveal', 'in');

      rerender(withRouter(<HomePage replayCount={1} />));
      expect(screen.getByTestId('about')).toHaveAttribute('data-reveal', 'out');
    });

    /**
     * The star-flicker guard. StarfieldCanvas reads useSplashReady(), so
     * it has to live inside SplashProvider — which makes "key the
     * provider" a tempting and wrong way to reset readiness: it would
     * regenerate every star's position mid-replay, visibly, behind the
     * splash. Node identity is the assertion, not presence: a remounted
     * canvas is still a canvas.
     */
    it('does not remount the star field', () => {
      const { container, rerender } = render(withRouter(<HomePage replayCount={0} />));
      const before = container.querySelector('canvas');
      expect(before).not.toBeNull();

      rerender(withRouter(<HomePage replayCount={1} />));
      expect(container.querySelector('canvas')).toBe(before);
    });

    it('leaves the sections mounted across the replay', () => {
      const { rerender } = render(withRouter(<HomePage replayCount={0} />));
      rerender(withRouter(<HomePage replayCount={1} />));
      ['about', 'skills', 'projects', 'blog', 'contact'].forEach((id) =>
        expect(screen.getByTestId(id)).toBeInTheDocument());
    });
  });
});
