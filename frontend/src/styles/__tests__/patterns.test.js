// frontend/src/styles/__tests__/patterns.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../patterns.module.css'), 'utf8');

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
      expect(row).toContain('margin-bottom: 38px');
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
