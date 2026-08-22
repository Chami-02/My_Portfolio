// frontend/src/components/layout/__tests__/ThemeToggle.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../../providers/ThemeProvider';

/**
 * PF-72 built the structure, PF-79 transcribed the prototype's switch,
 * and the 2026-08-22 owner-requested navbar rework replaced that switch
 * with a 44x44 sun/moon icon button.
 *
 * The stylesheet is asserted as TEXT, not through getComputedStyle:
 * vite.config.js sets no `test.css`, so CSS Modules are stubbed and no
 * stylesheet is ever applied in jsdom. A getComputedStyle assertion
 * here would pass or fail for reasons unrelated to the file.
 *
 * ⚠️ Comments are stripped before every text assertion. This module
 * documents the removed switch values in prose — "30x15", "13px",
 * ".track" and ".knob" all appear in the header comment — so a raw
 * `not.toContain` would match the note explaining the removal and
 * report PASS while asserting nothing. Confirmed by mutation.
 */
const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, '../ThemeToggle.module.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

const draw = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

const iconOf = (container) => container.querySelector('[data-theme-icon]');

describe('ThemeToggle (icon button, 2026-08-22)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  // ══ the icon shows the DESTINATION ════════════════════════════════

  it('shows a SUN in dark theme — the destination, not the current state', () => {
    // Default theme is dark, so clicking goes to light: a sun.
    const { container } = draw();
    expect(iconOf(container)).toHaveAttribute('data-theme-icon', 'sun');
  });

  it('shows a MOON in light theme', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { container } = draw();
    expect(iconOf(container)).toHaveAttribute('data-theme-icon', 'moon');
  });

  it('swaps the icon when the theme is toggled', () => {
    const { container } = draw();
    expect(iconOf(container)).toHaveAttribute('data-theme-icon', 'sun');
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(iconOf(container)).toHaveAttribute('data-theme-icon', 'moon');
  });

  it('renders exactly one icon — never both at once', () => {
    const { container } = draw();
    expect(container.querySelectorAll('[data-theme-icon]')).toHaveLength(1);
  });

  // ══ accessible name ═══════════════════════════════════════════════

  it('names the ACTION, in sentence case, agreeing with the icon', () => {
    draw();
    // Sun (→ light) + "Switch to Light theme" point the same direction.
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      'Switch to Light theme',
    );
  });

  it('carries NO aria-pressed', () => {
    // A button whose accessible name is already the action plus a
    // pressed state announces two directions at once. Name-changes-on-
    // activate and aria-pressed are alternative patterns for the same
    // thing; the name is the one kept.
    draw();
    expect(screen.getByTestId('theme-toggle')).not.toHaveAttribute('aria-pressed');
  });

  it('hides the svg from assistive tech so the button keeps one name', () => {
    const { container } = draw();
    expect(iconOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no visible caption', () => {
    // themeModeLabel() was deleted with the switch. A stray "LIGHT MODE"
    // reappearing would mean the caption crept back and the 44x44 square
    // is no longer square.
    draw();
    expect(screen.queryByText(/MODE/)).toBeNull();
  });

  // ══ geometry — the 71px header constraint ═════════════════════════

  it('is exactly 44x44, matching the logo so --header-h stays 71px', () => {
    // The header's height is set by its tallest child. 12 + 44 + 12 + 2
    // + 1 = 71 = --header-h, which every section's scroll-margin-top
    // reads. A 48px target here moves every anchor jump on the site.
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });

  it('cannot be compressed below 44px by the flex row', () => {
    expect(css).toContain('flex: none');
  });

  it('uses the requested 18px icon at 1.75 stroke', () => {
    const { container } = draw();
    const svg = iconOf(container);
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
    expect(css).toContain('width: 18px');
  });

  it('rests on --muted and goes accent on hover', () => {
    expect(css).toMatch(/\.toggle\s*\{[^}]*color:\s*var\(--muted\)/);
    expect(css).toMatch(/\.toggle:hover\s*\{[^}]*color:\s*var\(--acc/);
  });

  // ══ the sun glow (owner, 2026-08-22 second pass) ══════════════════

  /** The declarations of one rule, by exact selector, comments already
   *  stripped. Text rather than postcss because this file has asserted
   *  text since PF-79 and the strip is applied at the top; the selectors
   *  here are exact, so there is nothing to mis-parse. */
  const ruleFor = (selector) => {
    const i = css.indexOf(selector + ' {');
    if (i === -1) return null;
    return css.slice(i, css.indexOf('}', i));
  };

  it('glows in DARK theme — lit at rest, flaring on hover', () => {
    const rest = ruleFor(":global(html[data-theme='dark']) .toggle");
    const hover = ruleFor(":global(html[data-theme='dark']) .toggle:hover");
    expect(rest).toMatch(/filter:\s*drop-shadow\(0 0 6px rgba\(252, 163, 17, \.55\)\)/);
    expect(hover).toMatch(/filter:\s*drop-shadow\(0 0 11px rgba\(252, 163, 17, \.85\)\)/);
  });

  it('uses drop-shadow, not box-shadow, so the light comes off the rays', () => {
    // box-shadow would halo the 44px round BUTTON — a circle of empty
    // space around an 18px icon. drop-shadow follows the SVG's alpha.
    const rest = ruleFor(":global(html[data-theme='dark']) .toggle");
    expect(rest).not.toContain('box-shadow');
  });

  it('does NOT glow in light theme, at any state', () => {
    // ⚠️ The failure this prevents: --acc is amber #FCA311 in dark and
    // BROWN #7E4800 in light. An unscoped glow paints a brown smudge
    // behind the moon — valid CSS, no error, reads as a rendering
    // artefact. Same trap as the terminal caret.
    const lightHover = ruleFor(":global(html[data-theme='light']) .toggle:hover");
    expect(lightHover).not.toContain('filter');
    // and nothing may declare a filter outside the dark-scoped rules
    for (const block of css.split('}')) {
      if (block.includes('filter:')) {
        expect(block).toContain("[data-theme='dark']");
      }
    }
  });

  it('darkens the moon on hover in light theme', () => {
    const lightHover = ruleFor(":global(html[data-theme='light']) .toggle:hover");
    expect(lightHover).toMatch(/color:\s*var\(--strong\)/);
  });

  it('scopes both themes explicitly rather than relying on a default', () => {
    // Dark is a REAL attribute — index.html:31 and theme.js:63 both
    // write it — never merely the absent default. Had it been implicit,
    // [data-theme='dark'] would match nothing and the glow would
    // silently never appear in the one theme it exists for.
    expect(css).toContain(":global(html[data-theme='dark'])");
    expect(css).toContain(":global(html[data-theme='light'])");
  });

  it('transitions the glow, so it does not pop on hover', () => {
    expect(ruleFor('.toggle')).toMatch(/transition:[^;]*filter/);
  });

  // ══ what the rework REMOVED ═══════════════════════════════════════

  it('no longer declares the prototype switch — track, knob or slide', () => {
    // Guarded as an absence because the prototype still HAS the switch
    // and is frozen, so a fidelity pass diffing the two reads this as an
    // un-transcribed value rather than a sanctioned deviation.
    expect(css).not.toContain('.track');
    expect(css).not.toContain('.knob');
    expect(css).not.toContain('translateX(13px)');
    expect(css).not.toContain('.label');
  });

  // ══ focus ring ════════════════════════════════════════════════════

  it('keeps a focus ring the prototype does not have', () => {
    // motion.css policy: focus indicators are ALWAYS kept.
    expect(css).toContain('.toggle:focus-visible');
  });

  it('keeps its own 2px offset, which wins on specificity not order', () => {
    // .toggle:focus-visible is (0,2,0) against tokens.css's (0,1,1).
    expect(css).toMatch(/\.toggle:focus-visible\s*\{[^}]*outline-offset:\s*2px/);
  });

  it('declares no border-radius inside the focus rule', () => {
    // A radius there reshapes the ELEMENT while focused, not the ring —
    // the trap PF-83 documented against this project's 999px pills.
    const i = css.indexOf('.toggle:focus-visible');
    const rule = css.slice(i, css.indexOf('}', i));
    expect(rule).not.toContain('border-radius');
  });
});
