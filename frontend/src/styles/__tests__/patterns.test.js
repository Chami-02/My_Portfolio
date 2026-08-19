// frontend/src/styles/__tests__/patterns.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../patterns.module.css'), 'utf8');

/* Comments stripped. This file documents selectors and values in prose —
 * including, below, the three-part pill gate — so a search against the raw
 * text finds the COMMENT describing a rule rather than the rule, and the
 * assertion passes while checking nothing.
 *
 * EIGHT test files in this repo carry this same workaround, the earliest
 * from PF-69, and five confirmed blind guards were found in PF-82's
 * follow-up alone — two of them in this file, on this one rule. (An
 * earlier version of this comment called it the "third" occurrence; that
 * was wrong, and the full inventory is in CLAUDE.md's Silent failures.)
 *
 * Search `cssRules`, not `css`, for anything structural — and mutate any
 * raw-text guard before trusting it, because this failure is not visible
 * by reading. `postcss` is available if you would rather parse than
 * search, which is immune instead of merely defended. */
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declaration block of a single rule, by exact selector. */
function ruleBody(selector) {
  const i = css.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule for "${selector}"`);
  return css.slice(i, css.indexOf('}', i));
}

/**
 * Guards the two patterns PF-81 extracted here. Asserted as text because
 * vite.config.js sets no test.css — CSS Modules are stubbed under Vitest,
 * so nothing in this file is ever applied to an element and a DOM
 * assertion would pass or fail for the wrong reason.
 */
describe('patterns.module.css', () => {
  // Confirmed 5× in the prototype, byte-identical apart from the label
  // text — About/Skills/Projects/Blog/Contact. Values are the prototype's.
  describe('numbered section eyebrow', () => {
    it('lays the label and rule out on one baseline', () => {
      const row = ruleBody('.section-eyebrow');
      expect(row).toContain('display: flex');
      expect(row).toContain('align-items: baseline');
      expect(row).toContain('gap: 16px');
    });

    // PF-81 shipped `margin-bottom: 38px` here, generalised from About
    // alone. PF-82 found the prototype's five eyebrows disagree — About
    // (line 194) is 38px, Skills (246) is 14px — so it was never shared.
    //
    // It has to be ABSENT, not overridden: a composed class and its
    // composer both land on the element at (0,1,0), so an override in a
    // section module would be settled by bundle emission order rather
    // than by intent. Leaving it here and "expecting the local one to
    // win" is the failure mode this guards.
    it('leaves margin-bottom to the composing section', () => {
      expect(ruleBody('.section-eyebrow')).not.toContain('margin-bottom');
    });

    it('sets the label at the accent tone, 12px and .24em', () => {
      const label = ruleBody('.section-eyebrow-label');
      expect(label).toContain('font-size: 12px');
      expect(label).toContain('letter-spacing: .24em');
      expect(label).toContain('color: var(--acc, #FCA311)');
    });

    it('fades the rule out to the right', () => {
      expect(ruleBody('.section-eyebrow-line'))
        .toContain('linear-gradient(90deg, rgba(252, 163, 17, .5), transparent)');
    });

    // PF-70's generic `.eyebrow` is a DIFFERENT pattern — 11px, .14em,
    // muted — and is not what the numbered eyebrow uses. Composing the
    // wrong one renders a label that is grey and slightly tight rather
    // than nothing, which is the kind of near-miss nobody spots in review.
    it('stays distinct from PF-70\'s generic .eyebrow label', () => {
      const generic = ruleBody('.eyebrow');
      expect(generic).toContain('font-size: 11px');
      expect(generic).toContain('color: var(--muted2)');
      expect(ruleBody('.section-eyebrow-label')).not.toContain('var(--muted2)');
    });
  });

  /* The shared pill pattern carries a hover transition. Declared bare it
   * would tie with Reveal's own `.reveal` at (0,1,0) and win on emission
   * order, replacing a 1.05s entrance ease with a 0.2s hover transition —
   * the bug found independently in PF-80 (.rolePill) and PF-81 (.statCard).
   * Gated pre-emptively in PF-82's follow-up, while the pattern still has
   * zero consumers, so it can never become occurrence three. */
  describe('pill hover transition is gated', () => {
    it('declares no transition on the bare .pill rule', () => {
      expect(ruleBody('.pill')).not.toContain('transition');
    });

    it('gates it behind a finished entrance, and behind no-Reveal-at-all', () => {
      // cssRules, not css — the comment above the rule names all three
      // selectors, and searching the raw text matched that instead.
      const i = cssRules.indexOf(".pill:not([data-reveal])");
      expect(i).toBeGreaterThan(-1);
      const rule = cssRules.slice(i, cssRules.indexOf('}', i));

      // A plain pill with no Reveal has no data-reveal attribute at all;
      // without this clause the gate would silently remove its transition.
      expect(rule).toContain(".pill:not([data-reveal])");
      // Types up/rise/left take their transition from the base .reveal.
      expect(rule).toContain(".pill[data-reveal='in']");
      // type="pop" declares its own at (0,2,0), so the two-part selector
      // only ties with it — this three-part one wins outright.
      expect(rule).toContain(".pill[data-reveal='in'][data-type='pop']");
      expect(rule).toContain('transition: color .2s');
    });

    // .pill-accent composes .pill, so it inherits the gate rather than
    // needing its own. Its :hover stays bare and is unaffected.
    it('lets .pill-accent inherit the gate through composes', () => {
      expect(ruleBody('.pill-accent')).toContain('composes: pill');
      expect(ruleBody('.pill-accent')).not.toContain('transition');
    });
  });

  describe('outlined heading word', () => {
    it('strokes the glyphs and empties the fill', () => {
      const outline = ruleBody('.outline-text');
      expect(outline).toContain('-webkit-text-stroke: 1.5px var(--acc, #FCA311)');
      expect(outline).toContain('color: transparent');
    });

    // Robustness addition, not a prototype value. Without it, an engine
    // that does not paint -webkit-text-stroke shows literally nothing —
    // the failure is total rather than degraded, and `color: transparent`
    // is what makes it so. Anyone already seeing the outline sees no
    // change, which is why this counts as an implementation choice.
    it('falls back to solid accent text where the stroke is unsupported', () => {
      const i = css.indexOf('@supports not (-webkit-text-stroke');
      expect(i).toBeGreaterThan(-1);

      // The fallback has to come after the base rule to win the cascade,
      // and has to restore a visible fill.
      expect(i).toBeGreaterThan(css.indexOf('\n.outline-text {'));
      const block = css.slice(i, css.indexOf('\n}', css.indexOf('{', i)));
      expect(block).toContain('color: var(--acc, #FCA311)');
      expect(block).toContain('-webkit-text-stroke: 0');
    });
  });
});
