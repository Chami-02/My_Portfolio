// frontend/src/styles/__tests__/motion.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../motion.css'), 'utf8');

// This file is heavily commented, and a /* … */ block sitting above a
// rule is otherwise swept into that rule's "selector" by the naive
// split below — which made the root-element check fail against CSS
// that was already correct.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Selectors of every rule that sets scroll-behavior: auto !important. */
const scrollBehaviourSelectors = () =>
  [...stripped.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => /scroll-behavior:\s*auto\s*!important/.test(body))
    .map(([, selector]) => selector.trim().replace(/\s+/g, ' '));

describe('motion.css reduced-motion layer', () => {
  it('neutralises scroll-behavior on the ROOT element, not only its descendants', () => {
    // The bug this guards: the universal rule is written as
    //   html[data-motion="reduced"] *
    // which is a DESCENDANT selector — it matches everything inside
    // <html> and never <html> itself. Since the document's scrolling
    // box takes scroll-behavior from the root element, smooth anchor
    // jumps survived reduced motion completely: the attribute was set,
    // every descendant was neutralised, and the page still animated.
    //
    // Confirmed in a real browser during PF-79 before the fix —
    // getComputedStyle(document.documentElement).scrollBehavior read
    // 'smooth' with data-motion="reduced" applied.
    const selectors = scrollBehaviourSelectors();
    const hitsRoot = selectors.some(
      (s) =>
        s
          .split(',')
          .map((part) => part.trim())
          .includes('html[data-motion="reduced"]'),
    );

    expect(
      hitsRoot,
      `No rule targets html[data-motion="reduced"] itself.\nFound: ${JSON.stringify(selectors, null, 2)}`,
    ).toBe(true);
  });

  it('still covers descendants too', () => {
    const selectors = scrollBehaviourSelectors().join(' ');
    expect(selectors).toContain('html[data-motion="reduced"] *');
  });

  it('uses !important, since the root rule it overrides has equal weight', () => {
    // tokens.css declares `html { scroll-behavior: smooth }`. Without
    // !important this would come down to source order between two
    // stylesheets, which is exactly the kind of dependency that breaks
    // silently when an import is reordered.
    expect(css).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it('keeps animations at near-zero rather than none', () => {
    // An animation with duration 0 still fires animationend, so
    // sequences chaining on that event continue instead of stalling.
    expect(css).toContain('animation-duration: 0.01ms !important');
    expect(css).not.toMatch(/animation:\s*none\s*!important/);
  });
});
