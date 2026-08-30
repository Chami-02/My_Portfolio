// frontend/src/styles/__tests__/patterns.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../patterns.module.css'), 'utf8');

/* The stylesheet with comments stripped. patterns.module.css documents
 * selectors and values in prose — removed properties are preserved in a
 * comment beside the rule that lost them — so a search against the raw
 * text finds the COMMENT describing a rule rather than the rule, and the
 * assertion PASSES while checking nothing. A false positive, not a false
 * negative: it survives review and is invisible to coverage.
 *
 * EIGHT test files in this repo carry this same workaround, the earliest
 * from PF-69, and five confirmed blind guards were found in PF-82's
 * follow-up alone — two of them in this file, on the pill rule. (An
 * earlier version of this comment called it the "third" occurrence; that
 * was wrong, and the full inventory is in CLAUDE.md's Silent failures.)
 *
 * ⚠️ PF-93 (2026-08-21) moved the strip INSIDE ruleBody() rather than
 * exposing it as a separate `cssRules` constant to remember to reach for.
 * The old shape made the safe path opt-in, and four negative assertions
 * in this file were still searching raw text — `.not.toContain
 * ('margin-bottom')`, `('var(--muted2)')` and two `('transition')` — each
 * against a rule whose own comment names the missing property. None was
 * blind yet; all four were one edit away from becoming so.
 *
 * Mutate any raw-text guard before trusting it, because this failure is
 * not visible by reading. Better still, parse with `postcss`, as the pill
 * guards below now do — a declaration walk never visits comment nodes at
 * all, which is immune rather than defended. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The declaration block of a single rule, by exact selector, with
 * comments removed — see above. Searching for the selector happens on the
 * stripped text too, so a selector quoted inside a comment cannot be
 * mistaken for the rule itself.
 */
function ruleBody(selector) {
  const css_ = stripComments(css);
  const i = css_.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule for "${selector}"`);
  return css_.slice(i, css_.indexOf('}', i));
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
    /**
     * PF-93, 2026-08-21. This used to assert THREE selectors on one
     * rule: `:not([data-reveal])`, `[data-reveal='in']`, and
     * `[data-reveal='in'][data-type='pop']`. The last two are gone.
     *
     * The gate they formed does not work — `data-reveal="in"` is set at
     * the entrance's START (Reveal.jsx:57), not its end, so it hands a
     * Reveal-wrapped pill its hover transition for the whole entrance.
     * That was measured on four shipped elements, all fixed in PF-93.
     * The pre-emptive version here never had a consumer, so nothing was
     * visibly broken by it — but it was teaching the wrong pattern from
     * a shared file, which is how it would have spread.
     *
     * `:not([data-reveal])` STAYS, and keeping it is the substance of
     * this test. A pill used as an ordinary button has no Reveal
     * supplying a transition, so it needs its own. Deleting all three
     * selectors would trade one silent failure for another.
     *
     * postcss rather than cssRules: two of the guards this replaces were
     * confirmed blind, matching the comment above the rule instead of
     * the rule. A declaration walk never visits comment nodes at all,
     * which is immune rather than defended.
     */
    const pillTransitionRules = [];
    postcss.parse(css).walkRules((rule) => {
      if (!/\.pill(?![\w-])/.test(rule.selector)) return;
      const decls = [];
      rule.walkDecls(/^transition/, (d) => decls.push(`${d.prop}: ${d.value}`));
      if (decls.length) pillTransitionRules.push({ selector: rule.selector, decls });
    });

    it('has exactly one .pill rule declaring a transition', () => {
      expect(pillTransitionRules.map((r) => r.selector))
        .toEqual(['.pill:not([data-reveal])']);
    });

    it('keeps the transition itself on that one rule', () => {
      // The values are unchanged by PF-93 — only the selector list moved.
      expect(pillTransitionRules[0].decls)
        .toEqual(['transition: color .2s, border-color .2s, background .2s, transform .2s']);
    });

    it('declares no transition on the bare .pill rule', () => {
      // Bare, `.pill` (0,1,0) ties with `.reveal` and wins on emission
      // order — the original bug, in the file most able to spread it.
      expect(ruleBody('.pill')).not.toContain('transition');
    });

    // .pill-accent composes .pill, so it inherits whichever transition
    // applies rather than needing its own. Its :hover stays bare.
    it('lets .pill-accent inherit through composes', () => {
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
