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
    // PF-142: the card-list rows are 52px — the 44px FLOOR is the rule.
    expect(parseFloat(decls(sheet, 'overlayLink')['min-height'])).toBeGreaterThanOrEqual(44);
    expect(decls(sheet, 'overlayClose').width).toBe('44px');
    expect(decls(sheet, 'overlayClose').height).toBe('44px');
    expect(parseFloat(decls(sheet, 'overlayAdminLink')['min-height'])).toBeGreaterThanOrEqual(44);
    expect(parseFloat(decls(sheet, 'overlayContactPill')['min-height'])).toBeGreaterThanOrEqual(44);
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

/**
 * Declarations of the top-level rules whose selector list contains EXACTLY
 * `selector` as one part. `decls()` merges every rule naming a class, which
 * is right for "what does this class end up with" and wrong for "does this
 * one rule exist" — a dark override or a ::before would fold into the base.
 */
function rule(sheet, selector) {
  const out = {};
  postcss.parse(sheet).walkRules((r) => {
    if (r.parent.type !== 'root') return;
    if (!r.selector.split(',').map((s) => s.trim()).includes(selector)) return;
    r.walkDecls((d) => { out[d.prop] = d.value; });
  });
  return out;
}

const DARK = ":global(html[data-theme='dark'])";

// PF-117 — the admin at phone width, measured in a real browser at
// 320/375/768/899/900/1280 in both themes. Every value here was a defect the
// page-level scrollWidth check did not see.
describe('admin responsive + state audit (PF-117)', () => {
  const admin = () => css('styles/admin.module.css');

  it('lets a list row wrap its actions instead of crushing the title', () => {
    // ⚠️ `flex: 1` has a basis of 0, so the row never wrapped: at 375 the
    // Blog title column was 5px wide with UNPUBLISH/EDIT/DELETE painted over
    // the title and the PUBLISHED badge.
    expect(decls(admin(), 'rowBody').flex).toBe('1 1 200px');
    // `flex: none` sizes the actions to max-content; without a cap their own
    // `flex-wrap` never fires on a line narrower than every button.
    expect(decls(admin(), 'rowActions')['max-width']).toBe('100%');
  });

  it('keeps the media cards inside the card at 320px', () => {
    // A bare `min-width: 220px` set the grid track's minimum: every panel on
    // About and Projects ran 8px off the right edge, border and all.
    expect(decls(css('components/admin/panels/AdminAboutPanel.module.css'), 'mediaBody')['min-width'])
      .toBe('min(220px, 100%)');
    expect(decls(css('components/admin/panels/AdminProjectsPanel.module.css'), 'bgBody')['min-width'])
      .toBe('min(220px, 100%)');
  });

  it('lets a long sender address break inside a message card', () => {
    // 210px of unbreakable address pushed the page 10px wider than 320.
    expect(decls(css('components/admin/panels/AdminMessagesPanel.module.css'), 'email')['overflow-wrap'])
      .toBe('anywhere');
  });

  it('gives the × buttons a 24px tap area without growing the ×', () => {
    // 12×15 is under WCAG AA 2.5.8. The pseudo-element hit-tests as the
    // button; the glyph's own box is unchanged (owner, 2026-10-11).
    expect(rule(admin(), '.btnIcon')).toMatchObject({ position: 'relative' });
    expect(rule(admin(), '.btnIcon::before')).toMatchObject({ content: "''", position: 'absolute', inset: '-6px' });
    expect(rule(admin(), '.btnIcon').padding).toBe('0 0 0 3px');
  });

  it('puts RETRY on its own line on a phone, beside the message on desktop', () => {
    // Owner, 2026-10-11: on mobile RETRY sat beside a message already broken
    // over two lines.
    expect(decls(admin(), 'loadErrorText', '(max-width: 560px)')['flex-basis']).toBe('calc(100% - 17px)');
    expect(decls(admin(), 'loadError')['flex-wrap']).toBe('wrap');
    expect(decls(admin(), 'loadErrorText')['flex-basis']).toBeUndefined();
  });

  it('drops the glow from a disabled primary button', () => {
    // Owner-approved: a dim SAVE that still glowed read as lit.
    expect(rule(admin(), '.btnPrimary:disabled')['box-shadow']).toBe('none');
    // …while the enabled button keeps it.
    expect(rule(admin(), '.btnPrimary')['box-shadow']).not.toBe('none');
  });

  it('applies PF-91\'s --muted substitution to the --muted2 admin text that failed in dark', () => {
    // 4.15–4.42:1 in dark, all --muted2 on a tinted card; light passes.
    for (const sel of [`${DARK} .btnIcon:not(:hover)`, `${DARK} .badgeMuted`, `${DARK} .emptyState`, `${DARK} .rowMeta`]) {
      expect(rule(admin(), sel).color, sel).toBe('var(--muted)');
    }
    const about = css('components/admin/panels/AdminAboutPanel.module.css');
    for (const cls of ['mediaMeta', 'thumbEmpty', 'bioNo']) {
      expect(rule(about, `${DARK} .${cls}`).color, cls).toBe('var(--muted)');
    }
    expect(rule(css('components/admin/VocabularyPicker.module.css'), `${DARK} .chip:not(.chipOn) > .remove:not(:hover)`).color)
      .toBe('var(--muted)');
    // ⚠️ Never a bare `.btnIcon` — at (0,2,1) it would beat `.btnIcon:hover`
    // and the × would never turn red in dark.
    expect(rule(admin(), `${DARK} .btnIcon`)).toEqual({});
  });
});
