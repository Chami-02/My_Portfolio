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
vi.mock('../../components/sections/ContactSection', () => ({
  ContactSection: () => <div data-testid="contact" />,
}));

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
    expect(() => render(
      <ThemeProvider><MotionProvider><HomePage /></MotionProvider></ThemeProvider>,
    )).not.toThrow();

    ['about', 'skills', 'projects', 'blog', 'contact'].forEach((id) =>
      expect(screen.getByTestId(id)).toBeInTheDocument());
  });
});
