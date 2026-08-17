// frontend/src/components/layout/__tests__/ThemeToggle.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../../providers/ThemeProvider';

/**
 * PF-72 built the structure; PF-79 transcribed the prototype's actual
 * visual treatment (lines 69-72 of "Portfolio Revolution.dc.html").
 *
 * The stylesheet is asserted as TEXT, not through getComputedStyle:
 * vite.config.js sets no `test.css`, so CSS Modules are stubbed and no
 * stylesheet is ever applied in jsdom. A getComputedStyle assertion
 * here would pass or fail for reasons unrelated to the file.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../ThemeToggle.module.css'), 'utf8');

describe('ThemeToggle (PF-72 structure, PF-79 visuals)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  it('captions itself with the mode it would switch TO', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // Default theme is dark, so the button offers LIGHT MODE.
    expect(screen.getByText('LIGHT MODE')).toBeInTheDocument();
  });

  it('keeps the aria-label in sentence case, not the shouted caption', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      'Switch to Light theme',
    );
  });

  it('renders the track wrapping the knob, per the prototype', () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const knob = container.querySelector('[data-theme-knob]');
    expect(knob).not.toBeNull();
    // The prototype nests the knob inside a 30x15 track and positions
    // it absolutely against that track. A bare knob has nothing to be
    // absolute against, so the slide would travel the wrong distance.
    expect(knob.parentElement.className).toMatch(/track/);
  });

  it('uses the prototype exact toggle geometry and steel palette', () => {
    expect(css).toContain('padding: 8px 13px 8px 10px');
    expect(css).toContain('font-size: 10.5px');
    expect(css).toContain('letter-spacing: .14em');
    expect(css).toContain('border: 1px solid var(--acc2)');
    expect(css).toContain('background: rgba(var(--srf), .5)');
  });

  it('uses the prototype exact track and knob values', () => {
    expect(css).toContain('width: 30px');
    expect(css).toContain('height: 15px');
    expect(css).toContain('top: 1.5px');
    expect(css).toContain('left: 1.5px');
    expect(css).toContain('box-shadow: 0 0 10px rgba(var(--acc2rgb), .9)');
  });

  it('slides the knob 13px, on the prototype overshoot curve', () => {
    // Prototype line 866: translateX(13px) when light, none when dark.
    // The curve overshoots (1.56) — rounding it to a plain ease loses
    // the little bounce that gives the toggle its feel.
    expect(css).toContain('transform: translateX(13px)');
    expect(css).toContain('transition: transform .4s cubic-bezier(.34, 1.56, .4, 1)');
  });

  it('drives the knob off html[data-theme], not a prop', () => {
    // Survives a cross-tab theme change, which a prop read at render
    // time would miss.
    expect(css).toMatch(/:global\(html\[data-theme='light'\]\)\s+\.knob/);
  });

  it('keeps a focus ring the prototype does not have', () => {
    // motion.css policy: focus indicators are ALWAYS kept. Matching a
    // design tool export by deleting one would be a real regression.
    expect(css).toContain('.toggle:focus-visible');
  });
});
