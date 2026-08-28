// frontend/src/components/layout/__tests__/SkipLink.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { SkipLink } from '../SkipLink';

/**
 * ⚠️ Every CSS assertion here goes through postcss, not a substring
 * search over the raw file.
 *
 * CSS Modules are stubbed under Vitest — `document.styleSheets.length`
 * is 0 and no rule is ever applied — so the only way to assert a
 * class-declared value is to read the stylesheet. But this repo
 * documents its CSS heavily, and SkipLink.module.css's own comments
 * contain the strings "z-index", "200", "absolute", ":focus-visible"
 * and "-100%" while explaining the decisions. A raw
 * `expect(css).toContain(...)` would happily match the prose EXPLAINING
 * a rule instead of the rule, and report PASS while asserting nothing.
 *
 * postcss is immune rather than defended: comments are a distinct node
 * type that a declaration walk never visits. It is already in the tree
 * as a Vite dependency, so this costs no new install. See CLAUDE.md's
 * Silent-failures entry — eight test files in this repo carry a
 * comment-stripping workaround, five of them confirmed to have been
 * blind on the first attempt.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = postcss.parse(
  readFileSync(resolve(here, '../SkipLink.module.css'), 'utf8'),
);

/** Every declaration in the rule whose selector matches exactly. */
const declsFor = (selector) => {
  const out = {};
  root.walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((decl) => {
      out[decl.prop] = decl.value;
    });
  });
  return out;
};

describe('SkipLink (PF-83)', () => {
  it('renders an anchor pointing at the <main> id App.jsx sets', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('is parked off-screen at rest', () => {
    const base = declsFor('.skipLink');
    expect(base.position).toBe('fixed');
    expect(base.top).toBe('-100%');
  });

  it('is fixed rather than absolute, so tabbing to it never scrolls the page', () => {
    // An absolutely-positioned skip link sits at the top of the
    // DOCUMENT. Browsers scroll a newly-focused element into view, so
    // tabbing to it from halfway down the page yanks the viewport to the
    // top before the user has chosen to go there. Fixed positions it
    // against the viewport, so there is nothing to scroll to.
    expect(declsFor('.skipLink').position).toBe('fixed');
  });

  it('clears the splash at z-index 200', () => {
    // The stack is canvas 0 · glow 1 · header 60 · grain 70 · overlay 80
    // · splash 100. Anything at or below 100 leaves the link invisible
    // while the splash covers the screen — which is precisely when
    // someone tabbing into a page with nothing rendered yet needs it.
    expect(Number(declsFor('.skipLink')['z-index'])).toBeGreaterThan(100);
  });

  it('reveals itself on :focus, not only :focus-visible', () => {
    // While hidden the link is off-screen and unreachable by pointer, so
    // :focus and :focus-visible have the same audience. They differ only
    // in failure mode: if the :focus-visible heuristic declines to match,
    // the link holds focus while parked off-screen and Tab reads as
    // broken. A `:focus-visible`-only rule must not creep back in.
    expect(declsFor('.skipLink:focus').top).toBe('16px');
    expect(declsFor('.skipLink:focus-visible')).toEqual({});
  });

  it('declares its own focus ring instead of inheriting the accent one', () => {
    // tokens.css's global a:focus-visible ring is var(--acc) — the same
    // colour as this element's own background — so inherited it draws an
    // accent ring on an accent fill and reads as no ring at all.
    // --accInk is the token that means "ink placed ON accent fills" and
    // flips with the theme, so it contrasts in both.
    const focus = declsFor('.skipLink:focus');
    expect(focus.outline).toContain('var(--accInk)');
    expect(declsFor('.skipLink').background).toContain('var(--acc)');
  });

  it('uses the mono token rather than a hardcoded family', () => {
    // The ticket's sketch wrote "'JetBrains Mono', monospace" inline.
    // --font-mono is declared in tokens.css and carries the same stack,
    // so hardcoding it here would silently stop tracking the token.
    expect(declsFor('.skipLink')['font-family']).toBe('var(--font-mono)');
  });

  /**
   * Both halves of this component's contract live in App.jsx, and both
   * fail silently if broken: a skip link that is not the first focusable
   * element still renders and still works, it just is not a skip link
   * any more; and one whose target id has gone still focuses and still
   * navigates, to nothing.
   *
   * Asserted against App.jsx's SOURCE rather than a render. The
   * invariant genuinely is document order in that file, and App mounts
   * BrowserRouter, every route and two canvases — a render would pull
   * all of it in to observe one ordering. App.jsx also has no test
   * directory of its own, and CLAUDE.md rules out a top-level
   * src/__tests__/, so the assertions live with the component whose
   * contract they are.
   */
  describe('contract with App.jsx', () => {
    const appSrc = readFileSync(resolve(here, '../../../App.jsx'), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // JSX comments — same trap as CSS

    it('gives <main> the id the link targets', () => {
      expect(appSrc).toMatch(/<main[^>]*\bid="main-content"/);
    });

    /*
     * PF-91. Without tabIndex={-1} the link scrolls to <main> and leaves
     * document.activeElement on <body>, so the next Tab restarts from the
     * top of the document — the failure the link exists to prevent. It is
     * NEGATIVE deliberately: a positive value would add a tab stop and
     * change the keyboard order PF-83 specified and measured.
     */
    it('gives <main> a NEGATIVE tabIndex so the link can move focus to it', () => {
      const main = appSrc.match(/<main[^>]*>/)[0];
      expect(main).toMatch(/tabIndex=\{-1\}/);
      expect(main).not.toMatch(/tabIndex=\{\s*[0-9]/);
    });

    it('renders the link before the route that renders the Navbar', () => {
      const link = appSrc.indexOf('<SkipLink />');
      const navbar = appSrc.indexOf('<Navbar />');
      expect(link).toBeGreaterThan(-1);
      expect(navbar).toBeGreaterThan(-1);
      expect(link).toBeLessThan(navbar);
    });
  });
});
