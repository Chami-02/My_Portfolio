// frontend/src/styles/__tests__/mobile.test.js
//
// The 2026-08-25 mobile pass — "whole ui mobile optimization should be
// fine as butter".
//
// ⚠️ A cross-cutting guard, so it lives here rather than in any one
// module's directory, following the precedent
// styles/__tests__/revealTransition.test.js set. Every value it pins was
// found by MEASURING a real browser at phone widths, and every one of
// them is the kind a fidelity pass against the prototype restores —
// the prototype is a fixed-width design export and has no mobile
// behaviour to transcribe.
//
// ⚠️ Parsed with postcss, never searched as text: each module explains
// the value it replaced in prose directly above the rule, so a raw
// `includes()` matches the comment rather than the declaration.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const css = (rel) => readFileSync(resolve(src, rel), 'utf8');

/**
 * Declarations for a class, optionally inside a given @media prelude.
 *
 * ⚠️ The class must be the LAST element in the selector, not an ancestor
 * of it. A bare `/\.hamburger/` also matches `.hamburger span`, whose
 * `width: 100%` then overwrote the button's own `width: 44px` and the
 * test failed against correct code. Anchoring on `[^\s>+~]*$` accepts
 * `.hamburger`, `.hamburger:hover` and `:global(html[…]) .hamburger`,
 * and rejects any descendant of it.
 */
function decls(sheet, cls, media = null) {
  const out = {};
  const want = new RegExp(`\\.${cls}(?![\\w-])[^\\s>+~]*$`);
  const matches = (selector) =>
    selector.split(',').some((part) => want.test(part.trim()));
  const visit = (container) =>
    container.walkRules((rule) => {
      if (!matches(rule.selector)) return;
      rule.walkDecls((d) => { out[d.prop] = d.value; });
    });

  const root = postcss.parse(sheet);
  if (media === null) {
    // Top-level rules only — a media override must not be read as the
    // base value. That exact collapse made a Footer test read the mobile
    // layout while asserting the desktop one.
    root.walkRules((rule) => {
      if (rule.parent.type !== 'root') return;
      if (!matches(rule.selector)) return;
      rule.walkDecls((d) => { out[d.prop] = d.value; });
    });
  } else {
    root.walkAtRules('media', (at) => { if (at.params === media) visit(at); });
  }
  return out;
}

describe('mobile pass (2026-08-25)', () => {

  /* ── the one real layout bug ─────────────────────────────────────── */

  it('lets the contact fields shrink below their intrinsic width', () => {
    // ⚠️ THE BUG. An <input> has an intrinsic width of ~202px and a grid
    // item's default `min-width: auto` refuses to shrink below its
    // min-content size — so when the form row goes to two columns the
    // fields stayed 202px in a 151px track and EMAIL ran off the right
    // edge of the viewport.
    //
    //   375px  1 column,  301px track  →  ok
    //   390px  2 columns, 151px track  →  +14px past the edge
    //   414px  2 columns, 162px track  →  +2px
    //   430px  2 columns, 170px track  →  ok, it fits again
    //
    // Only broken between ~380 and ~424px — a band containing the
    // iPhone 14/15 Pro (393) and 14 Plus (414) and excluding both widths
    // anyone tests first. The page never grew a scrollbar, because an
    // ancestor clips.
    const sheet = css('components/sections/ContactSection.module.css');
    expect(decls(sheet, 'input')['min-width']).toBe('0');
    // Both levels, or the floor just moves up a box.
    expect(decls(sheet, 'field')['min-width']).toBe('0');
  });

  /* ── tap targets ─────────────────────────────────────────────────── */

  it('gives the hamburger a 44px hit area without moving --header-h', () => {
    // 32×32 measured, below the 44px minimum and the smallest target on
    // the site. The 6px padding keeps the content box at 32px, so the
    // bars stay 32px wide and the translateY(7px) rotation math is
    // untouched. 44 is also what keeps --header-h at 71px — the logo and
    // theme toggle are both 44, and the header's height is set by its
    // tallest child.
    const d = decls(css('components/layout/Navbar.module.css'), 'hamburger');
    expect(d.width).toBe('44px');
    expect(d.height).toBe('44px');
    expect(d.padding).toBe('6px');
  });

  it('gives the mobile overlay links and close button 44px', () => {
    // ⚠️ MISSED BY THE FIRST TWO AUDIT PASSES, because an automated
    // sweep never opens the menu. These are the only way to navigate on
    // a phone and they measured 32px.
    const sheet = css('components/layout/Navbar.module.css');
    expect(decls(sheet, 'overlayLink')['min-height']).toBe('44px');
    expect(decls(sheet, 'overlayClose').width).toBe('44px');
    expect(decls(sheet, 'overlayClose').height).toBe('44px');

    // ⚠️ And the gap came DOWN by exactly what the boxes grew, so the
    // space between labels is unchanged. Fixing one without the other
    // turns a tap-target fix into a visible layout change.
    expect(decls(sheet, 'overlayNav').gap).toBe('8px');
  });

  it('raises the two short CTAs to 44px on touch widths only', () => {
    // Both are the prototype's own padding and both measured under 44.
    // Scoped to a media query so a pointer user sees the design's value.
    //
    // ⚠️ `min-height`, not padding. 12px top and bottom looked like it
    // made exactly 44 and measured 43.6 — the line box is 19.6px, not
    // the whole 20 it appears to be. A min-height cannot be wrong by a
    // rounding error.
    expect(
      decls(css('components/sections/HeroSection.module.css'), 'loudCta', '(max-width: 768px)')['min-height'],
    ).toBe('44px');
    expect(
      decls(css('components/layout/Footer.module.css'), 'statusCta', '(max-width: 899px)')['min-height'],
    ).toBe('44px');
  });

  it('gives the footer nav links 44px, and pays for it out of the gap', () => {
    const sheet = css('components/layout/Footer.module.css');
    const MQ = '(max-width: 899px)';
    expect(decls(sheet, 'link', MQ)['min-height']).toBe('44px');
    // Ten links stacked 12px apart is the densest touch surface on the
    // site; the gap goes to 0 so the rhythm stays near the desktop's.
    expect(decls(sheet, 'column', MQ).gap).toBe('0');
  });

  /* ── clipped decoration ──────────────────────────────────────────── */

  it('pulls the two overhanging hero chips inside below 1024px', () => {
    // ⚠️ NEVER SHOWED AS A LAYOUT BUG. `.chipFastapi` sits at
    // `right: -6%` and `.chipNext` at `left: -5%` so the cluster reads as
    // surrounding the portrait frame. That works while the stage is
    // narrower than the viewport — true at 1024px and up. Below it the
    // stage IS the column, so both chips landed past the edge and were
    // clipped MID-WORD: FastAPI by 5px at 375, 9px at 600, 14px at 900.
    //
    // The page has no horizontal scroll at any width, so every automated
    // check passed while two of the ten chips were visibly sliced. Found
    // by looking at a screenshot.
    const sheet = css('components/sections/HeroSection.module.css');
    const MQ = '(max-width: 1023px)';
    expect(decls(sheet, 'chipFastapi', MQ).right).toBe('0');
    expect(decls(sheet, 'chipNext', MQ).left).toBe('0');

    // The overhang is still the base value — this is a narrow-screen
    // correction, not a redesign of the cluster.
    expect(decls(sheet, 'chipFastapi').right).toBe('-6%');
    expect(decls(sheet, 'chipNext').left).toBe('-5%');
  });
});
