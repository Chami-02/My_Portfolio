// frontend/src/components/layout/__tests__/Footer.test.jsx
//
// PF-88. Replaces the Phase 1 footer's tests wholesale — that footer
// (a `<PC/>` wordmark, a "Built with" line and three inline SVG icons)
// no longer exists at this path.
//
// ⚠️ Every CSS assertion here goes through postcss, never a text
// search. This module documents each removed prototype declaration in
// prose exactly where the rule used to be, so `css.includes('background')`
// matches the COMMENT explaining the absence and reports PASS while
// asserting nothing. postcss never visits a comment node.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';

import { Footer } from '../Footer';
import { MotionProvider } from '../../../providers/MotionProvider';

const here = dirname(fileURLToPath(import.meta.url));
const readCss = (rel) => readFileSync(resolve(here, rel), 'utf8');

const footerCss = readCss('../Footer.module.css');
const marqueeCss = readCss('../../motion/Marquee.module.css');
const heroCss = readCss('../../sections/HeroSection.module.css');

/**
 * Declarations of one rule, as { prop, value }[]. Selector match is on
 * the raw selector text, which is fine because these are module-local
 * names that postcss leaves untouched.
 */
function declsFor(css, selectorTest) {
  const out = [];
  postcss.parse(css).walkRules((rule) => {
    if (!selectorTest(rule.selector)) return;
    rule.walkDecls((d) => out.push({ prop: d.prop, value: d.value, selector: rule.selector }));
  });
  return out;
}

/**
 * As `declsFor`, but TOP-LEVEL rules only — nothing inside an @media.
 *
 * ⚠️ Not a refinement for tidiness. `.grid` is declared twice: once at
 * the top level and once inside the stacking breakpoint. Collapsing both
 * into one object lets the media query's `grid-template-columns: 1fr`
 * overwrite the base three-zone value, so a test asserting the base
 * layout reads the MOBILE one and fails against correct code. Found
 * exactly that way.
 */
function baseDeclsFor(css, selectorTest) {
  const out = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type !== 'root') return;
    if (!selectorTest(rule.selector)) return;
    rule.walkDecls((d) => out.push({ prop: d.prop, value: d.value, selector: rule.selector }));
  });
  return out;
}

/** Declarations for a selector inside a given @media prelude. */
function mediaDeclsFor(css, params, selectorTest) {
  const out = [];
  postcss.parse(css).walkAtRules('media', (at) => {
    if (at.params !== params) return;
    at.walkRules((rule) => {
      if (!selectorTest(rule.selector)) return;
      rule.walkDecls((d) => out.push({ prop: d.prop, value: d.value }));
    });
  });
  return out;
}

/** Exactly this class, at any selector depth or state. */
const forClass = (name) => (sel) =>
  new RegExp(`\\.${name}(?![\\w-])`).test(sel);

/**
 * Element lookup by CSS-Module local name, matched EXACTLY — the
 * SkillsSection convention. `[class*="status"]` would count `.status`,
 * `.statusLines`, `.statusCta` and three `.statusDot*` as one another,
 * and `.link` is a prefix of nothing but `.logo` is a near-miss for
 * `[class*="lo"]`-style sloppiness. Exact matching removes the class of
 * bug entirely.
 */
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _link_f5cf21
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__link
  return named ? named[1] : token;
}
const has = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (root, name) =>
  [...root.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick = (root, name) => pickAll(root, name)[0] ?? null;

function renderFooter({ path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MotionProvider>
        <Footer />
      </MotionProvider>
    </MemoryRouter>,
  );
}

describe('Footer (PF-88)', () => {

  /* ── Step 4 — the wash decision ─────────────────────────────────── */

  it('carries the navbar surface, and STILL not the prototype gradient', () => {
    // ⚠️ THIS REVERSED ON 2026-08-27, and both halves matter.
    //
    // Until then the <footer> rule declared NO background at all, under
    // the 2026-08-18 site-wide wash removal. The owner then asked for
    // the navbar's surface on the whole footer, which narrows that
    // decision to "sections, not chrome" — see Locked decisions.
    //
    // What did NOT come back is the prototype's line 543 gradient:
    //   background: linear-gradient(180deg, rgba(var(--gnd),.4),
    //                               rgba(var(--ftr),.86))
    // A flat token tint is not a wash — no vertical ramp, so it does not
    // reintroduce the banded-panel look the removal targeted. Still
    // asserted as an absence, because a fidelity pass diffing against
    // the prototype reads the missing gradient as un-transcribed.
    const decls = declsFor(footerCss, forClass('footer'));
    expect(decls.length).toBeGreaterThan(0);

    // present: the navbar's own surface, verbatim
    expect(decls).toContainEqual(
      expect.objectContaining({ prop: 'background', value: 'rgba(var(--ftr), .86)' }),
    );
    // present: the blur, prefix FIRST — reversed order ships no blur at
    // all (esbuild collapses the pair; Chrome ignores the prefixed form)
    const props = decls.map((d) => d.prop);
    expect(props).toContain('-webkit-backdrop-filter');
    expect(props).toContain('backdrop-filter');
    expect(props.indexOf('-webkit-backdrop-filter'))
      .toBeLessThan(props.indexOf('backdrop-filter'));

    // absent: the prototype's two-stop wash
    expect(decls.some((d) => /gradient/.test(d.value))).toBe(false);
  });

  it('matches the navbar surface exactly, rather than inventing a value', () => {
    // The justification for reversing the wash removal is "the two ends
    // of the page are matching chrome". A drifted value would keep the
    // reversal without its reason.
    const navCss = readCss('../Navbar.module.css');
    const header = declsFor(navCss, forClass('header'));
    const footer = declsFor(footerCss, forClass('footer'));
    const pick = (decls, prop) => decls.find((d) => d.prop === prop)?.value;
    expect(pick(footer, 'background')).toBe(pick(header, 'background'));
    expect(pick(footer, 'backdrop-filter')).toBe(pick(header, 'backdrop-filter'));
  });

  it('keeps the marquee band surface and the STATUS card surface', () => {
    // The over-deletion guard for the test above. Neither of these is a
    // section wash: one is a designed band element (same category as the
    // hero's marquee strip), the other a card surface — and the
    // 2026-08-18 entry is explicit that card and panel surfaces were
    // untouched.
    const band = declsFor(footerCss, forClass('marqueeBand'));
    expect(band).toContainEqual(
      expect.objectContaining({ prop: 'background', value: 'var(--acc, #FCA311)' }),
    );
    expect(band.filter((d) => d.prop.startsWith('border-')).length).toBe(2);

    const status = declsFor(footerCss, forClass('status'));
    expect(status).toContainEqual(
      expect.objectContaining({ prop: 'background', value: 'rgba(var(--srf), .5)' }),
    );
  });

  /* ── Step 5 / Silent failures — keyframes across the module edge ── */

  it('reaches its keyframes through global carriers, naming none itself', () => {
    // A keyframe name written inside a *.module.css is scoped to an
    // identifier no @keyframes defines, and the element then silently
    // does not animate — getComputedStyle still reports it "running".
    const root = postcss.parse(footerCss);

    const composed = [];
    root.walkDecls('composes', (d) => composed.push(d.value));
    expect(composed).toContain('kf-dot from global');

    root.walkDecls((d) => {
      if (d.prop === 'animation') {
        throw new Error(`Footer.module.css uses the animation SHORTHAND (${d.value}); it resets animation-name and undoes the composed carrier`);
      }
      expect(d.prop).not.toBe('animation-name');
    });

    // The marquee's own name arrives from Marquee (PF-74), not here.
    const track = declsFor(marqueeCss, forClass('track'));
    expect(track).toContainEqual(
      expect.objectContaining({ prop: 'composes', value: 'kf-marq from global' }),
    );
  });

  /* ── Step 5 — the hero's slimming must not leak here ─────────────── */

  it('uses the HERO\'s band treatment, not the prototype\'s footer strip', () => {
    // ⚠️ OWNER-REQUESTED DEVIATION, 2026-08-25 — "exactly like the top
    // one". This inverts the guard that stood here until today, which
    // asserted the opposite: that the hero's 2026-08-17 slimming had
    // NOT leaked into the footer. It is now required to have.
    //
    // Read from HeroSection's own module rather than from strings
    // frozen here, so the two bands cannot drift apart silently — if
    // the hero is ever re-tuned, this fails until the footer follows.
    const footer = Object.fromEntries(
      declsFor(footerCss, forClass('marqueeText')).map((d) => [d.prop, d.value]),
    );
    const hero = Object.fromEntries(
      declsFor(heroCss, forClass('marqueeText')).map((d) => [d.prop, d.value]),
    );

    expect(footer['font-size']).toBe(hero['font-size']);
    expect(footer['padding-right']).toBe(hero['padding-right']);
    expect(footer.color).toBe(hero.color);
    expect(footer['text-transform']).toBe(hero['text-transform']);

    // And explicitly NOT the prototype's footer values, so a fidelity
    // pass diffing against the export cannot quietly restore them.
    expect(footer['font-size']).not.toBe('clamp(16px, 2vw, 26px)');
    expect(footer['padding-right']).not.toBe('30px');
    expect(footer.color).not.toBe('var(--acc, #FCA311)');

    const band = Object.fromEntries(
      declsFor(footerCss, forClass('marqueeBand')).map((d) => [d.prop, d.value]),
    );
    const heroWrap = Object.fromEntries(
      declsFor(heroCss, forClass('marqueeWrap')).map((d) => [d.prop, d.value]),
    );
    expect(band.background).toBe(heroWrap.background);

    // ⚠️ The TILT is the one hero value that does NOT come across —
    // owner's second pass, "full 100% horizontal and fit to footer".
    // The hero's band is a torn strip laid over the page; this one is a
    // level rule marking where the page ends.
    expect(heroWrap.transform).toMatch(/rotate/);
    expect(band.transform).toBeUndefined();
    expect(band.width).toBe('100%');

    // The hero splits the slab and its padding across two elements
    // because its wrapper also carries a negative margin; here one
    // element does both, so compare across the two class names.
    const heroInner = Object.fromEntries(
      declsFor(heroCss, forClass('marqueeInner')).map((d) => [d.prop, d.value]),
    );
    expect(band.padding).toBe(heroInner.padding);
    expect(band.padding).not.toBe('10px 0');   // the prototype's footer value
  });

  it('has no tilt wrapper left behind', () => {
    // `.marqueeWrap` existed ONLY to clear the rotation the footer's
    // `overflow: hidden` would cut — max(22px, 1.5vw), sized against a
    // rise of 0.99vw. With the tilt gone there is no rise, and the
    // padding would read as an unexplained gap between Contact and the
    // band. Guarded as an absence in both files, because the module
    // still explains the retired rule in prose.
    const selectors = [];
    postcss.parse(footerCss).walkRules((r) => selectors.push(r.selector));
    expect(selectors.join(' ')).not.toMatch(/\.marqueeWrap\b/);

    const { container } = renderFooter();
    const band = pick(container, 'marqueeBand');
    expect(band).not.toBeNull();
    // The band is the footer's FIRST child — nothing between it and the
    // top edge.
    expect(container.querySelector('footer').firstElementChild).toBe(band);
  });

  /* ── Step 6 / PF-93 — no transition on a Reveal-wrapped element ──── */

  it('lays the footer out as three zones, with the link pair grouped', () => {
    // ⚠️ Owner-requested 2026-08-25. The prototype's
    // `repeat(auto-fit, minmax(min(100%,210px), 1fr))` gives four tracks
    // of equal width, which reads as four peers; the ask is a left
    // group, a centred pair and a right card.
    const grid = Object.fromEntries(
      baseDeclsFor(footerCss, forClass('grid')).map((d) => [d.prop, d.value]),
    );
    expect(grid['grid-template-columns']).toBe('minmax(0, 1fr) auto minmax(0, 1fr)');
    expect(grid['grid-template-columns']).not.toMatch(/auto-fit/);

    const group = Object.fromEntries(
      baseDeclsFor(footerCss, forClass('linkGroup')).map((d) => [d.prop, d.value]),
    );
    expect(group['justify-self']).toBe('center');
    // Wider than the grid's own gap — they are a pair, not two more
    // equal columns.
    expect(group['column-gap']).toBe('clamp(36px, 6vw, 96px)');

    expect(
      Object.fromEntries(baseDeclsFor(footerCss, forClass('identity')).map((d) => [d.prop, d.value]))['justify-self'],
    ).toBe('start');
    expect(
      Object.fromEntries(baseDeclsFor(footerCss, forClass('status')).map((d) => [d.prop, d.value]))['justify-self'],
    ).toBe('end');

    // Three children of the grid, not four — the middle one wraps the
    // two link columns, which keep their own Reveal delays.
    const { container } = renderFooter();
    const gridEl = pick(container, 'grid');
    expect(gridEl.children).toHaveLength(3);
    expect(has(gridEl.children[1], 'linkGroup')).toBe(true);
    expect(container.querySelectorAll('[data-reveal]')).toHaveLength(4);
  });

  it('stacks below 900px, which the explicit grid does not do on its own', () => {
    // ⚠️ The prototype's `repeat(auto-fit, minmax(min(100%,210px), 1fr))`
    // drops a column when the tracks stop fitting. Three EXPLICIT tracks
    // never do — they just get narrower. Measured without this rule:
    // zone widths went 323/217/320 at 1024px to 116/191/50 at 375px,
    // with the status card crushed to 50px and the outer zones
    // overlapping below 430px. No scrollbar, nothing in the console.
    const MQ = '(max-width: 899px)';

    const grid = Object.fromEntries(
      mediaDeclsFor(footerCss, MQ, forClass('grid')).map((d) => [d.prop, d.value]),
    );
    expect(grid['grid-template-columns']).toBe('1fr');

    // Everything hugs the left once stacked — a centred pair and a
    // right-aligned card under a left-aligned identity block reads as
    // three unrelated fragments.
    const stacked = mediaDeclsFor(footerCss, MQ, (sel) =>
      /\.linkGroup\b/.test(sel) || /\.status\b/.test(sel));
    expect(stacked.filter((d) => d.prop === 'justify-self').map((d) => d.value))
      .toContain('start');
  });

  it('is full-bleed, like the header', () => {
    // The prototype caps `.inner` at the 1240px content column. Within
    // it the four columns already spanned edge to edge, so there was no
    // slack to redistribute — the only way further out is to drop the
    // cap. This is the same call the header made on 2026-08-22, and it
    // carries the same accepted consequence: above ~1320px the footer
    // no longer aligns with section content.
    const inner = Object.fromEntries(
      baseDeclsFor(footerCss, forClass('inner')).map((d) => [d.prop, d.value]),
    );
    expect(inner['max-width']).toBeUndefined();
    expect(inner.margin).toBeUndefined();
    expect(inner.padding).toMatch(/clamp\(16px, 4vw, 40px\)/);

    // ⚠️ And the top padding is reduced from the prototype's
    // clamp(38px, 6vw, 64px) — owner-requested, so the band reads as
    // heading the footer rather than floating clear of it. Settled at
    // 46px after 30px overshot. Guarded because it is exactly the kind
    // of value a fidelity pass restores.
    expect(inner.padding).toMatch(/^clamp\(26px, 3\.4vw, 46px\)/);
    expect(inner.padding).not.toMatch(/6vw/);
  });

  it('declares no transition on any of the four column wrappers', () => {
    // data-reveal sits on the COLUMNS in the prototype (lines 553, 568,
    // 574, 587), so these four are the reveal targets and Reveal owns
    // `transition` on each. The repo-wide scanner in
    // styles/__tests__/revealTransition.test.js catches this too; this
    // is the local, named guard.
    for (const name of ['identity', 'column', 'status']) {
      const props = declsFor(footerCss, forClass(name)).map((d) => d.prop);
      expect(props.filter((p) => p.startsWith('transition'))).toEqual([]);
    }
  });

  it('gives the four hover targets no transition either — they snap', () => {
    // The other direction, which the scanner CANNOT check: these are
    // children of a reveal target rather than targets, so the
    // prototype's hideReveals() never writes an inline transition over
    // them, and the prototype declares none. Adding easing here would
    // be inventing a value. (`.replay` and `.scrollUp` were in this
    // list until 2026-08-25, when both controls were removed.)
    for (const name of ['link', 'statusCta']) {
      const props = declsFor(footerCss, forClass(name)).map((d) => d.prop);
      expect(props.filter((p) => p.startsWith('transition'))).toEqual([]);
    }
  });

  /* ── Content and structure ───────────────────────────────────────── */

  it('repeats the strip eighteen times, each ending in a non-breaking space', () => {
    // ⚠️ EIGHTEEN as of 2026-08-27, and the number is arithmetic.
    // `marq` translates the track by -50% of its OWN width, so one cycle
    // slides it by half the copies — the requirement is
    // `copies >= 2 * band / copy`, NOT the intuitive `copy >= band`.
    //
    // It was 16, which covered 3878px and sat EXACTLY on the limit at
    // 3440. The Option A slimming dropped the font, which shrank one
    // copy from 484.7px to 392.9px and so RAISED the requirement to 18 —
    // thinning a band makes it need MORE copies, not fewer. Shipping A
    // at 16 would have reopened the hole this count exists to close.
    // Measured in Chromium; owner-approved 2026-08-27.
    //
    // Even, separately: an odd count lands mid-copy at the wrap and the
    // text visibly jumps once per cycle.
    //
    // The trailing U+00A0 is a different thing again — the gap BETWEEN
    // repeats. A plain space is collapsed and the copies butt together.
    const { container } = renderFooter();
    const strips = pickAll(container, 'marqueeText');
    expect(strips).toHaveLength(18);
    expect(strips.length % 2).toBe(0);
    for (const strip of strips) {
      expect(strip.textContent).toBe(
        "OPEN TO OPPORTUNITIES ✦ LET'S BUILD SOMETHING LOUD ✦ ",
      );
      expect(strip.textContent.endsWith(' ')).toBe(true);
    }
  });

  it('gives the logo an empty alt — it is decorative', () => {
    // The FOURTH element that would otherwise carry
    // alt="Parindra Gallage" (navbar logo, hero portrait, splash logo).
    // The name and role render as real text beside it and it is not a
    // link, so describing it announces the same thing twice.
    const { container } = renderFooter();
    const logo = pick(container, 'logo');
    expect(logo).not.toBeNull();
    expect(logo.getAttribute('alt')).toBe('');
    expect(container.querySelectorAll('img[alt="Parindra Gallage"]')).toHaveLength(0);
  });

  it('labels the blog section "Field Notes", not "BLOG"', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Field Notes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Blog' })).toBeNull();
  });

  it('marks external links target=_blank rel=noreferrer, and mailto neither', () => {
    renderFooter();
    for (const name of ['GitHub ↗', 'LinkedIn ↗', 'Facebook ↗', 'Instagram ↗']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
    const email = screen.getByRole('link', { name: 'Email ↗' });
    expect(email).toHaveAttribute('href', 'mailto:parindrachameekara@gmail.com');
    expect(email).not.toHaveAttribute('target');
  });

  it('tags both [data-ok] elements the prototype tags', () => {
    // applyTheme() (prototype line 868) recolours every [data-ok] to
    // #0E7A55 in light and #34d399 in dark. Dropping the attribute is
    // silent — the element keeps dark theme's green on light paper,
    // which measured 1.72:1 on the Contact form surface in PF-87.
    const { container } = renderFooter();
    expect(container.querySelectorAll('[data-ok]')).toHaveLength(2);
  });

  /*
   * ⚠️ REWRITTEN IN PF-91, AND THE BEHAVIOUR IT GUARDS DID NOT CHANGE.
   *
   * PF-88 ported applyTheme()'s [data-ok] recolour as a light-scoped
   * rule carrying the literal #0E7A55, and this test pinned that rule.
   * PF-91 moved the same pair onto `var(--ok)` — which tokens.css had
   * declared since PF-67 with nothing reading it — and deleted the
   * scoped rule as a second source of truth.
   *
   * So the test now pins the CONTRACT rather than its expression: the
   * two nodes read a token, and that token really does resolve to a
   * different value per theme. Both halves are needed — a token that
   * failed to flip would leave the same 1.72:1 failure the port exists
   * to prevent, and would pass a check for `var(--ok)` alone.
   *
   * That cross-file reach is the cost of the token: the mechanism now
   * lives in two files, so the guard has to as well.
   */
  it('gives both [data-ok] elements a green that really flips per theme', () => {
    const declared = [];
    postcss.parse(footerCss).walkRules((rule) => {
      rule.walkDecls('color', (d) => {
        if (/\.(availabilityLabel|statusDotOk)\b/.test(rule.selector)) {
          declared.push({ sel: rule.selector.trim(), value: d.value });
        }
      });
    });
    expect(declared).toHaveLength(2);
    declared.forEach((d) => {
      expect(d.value).toBe('var(--ok)');
      // ...and NOT via a theme-scoped duplicate, which is what was deleted
      expect(d.sel).not.toMatch(/data-theme/);
    });

    // the token must genuinely carry two different values
    const tokensCss = readCss('../../../styles/tokens.css');
    const ok = [];
    postcss.parse(tokensCss).walkDecls('--ok', (d) => ok.push(d.value.trim()));
    expect(ok).toHaveLength(2);
    expect(new Set(ok).size).toBe(2);

    // ⚠️ marqueeText is deliberately NOT scoped any more. The band is
    // ink-on-accent since 2026-08-25 and --accInk already flips per
    // theme, so the prototype's [data-strip] opacity rule has nothing
    // left to act on.
    const scoped = [];
    postcss.parse(footerCss).walkRules((rule) => {
      if (rule.selector.includes('data-theme')) scoped.push(rule.selector);
    });
    expect(scoped.join(' ')).not.toMatch(/marqueeText/);
  });

  /* ── Step 3 — route-aware links ──────────────────────────────────── */

  it('keeps bare hashes on the home page', () => {
    renderFooter({ path: '/' });
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#about');
    expect(screen.getByRole('link', { name: 'Field Notes' })).toHaveAttribute('href', '#blog');
    expect(screen.getByRole('link', { name: 'START A PROJECT →' })).toHaveAttribute('href', '#contact');
  });

  it.each(['/blog', '/blog/some-post', '/nope'])(
    'makes every section link absolute with ?nosplash=1 on %s',
    (path) => {
      // The bug fixed in the navbar, one element lower: App.jsx mounts
      // <Footer /> on path="*", so a bare hash here resolves to nothing
      // on /blog and on NotFoundPage. ?nosplash=1 is the prototype's own
      // convention (Blog.dc.html lines 45, 51-53, 60).
      renderFooter({ path });
      const expected = {
        About: '/?nosplash=1#about',
        Skills: '/?nosplash=1#skills',
        Projects: '/?nosplash=1#projects',
        'Field Notes': '/?nosplash=1#blog',
        Contact: '/?nosplash=1#contact',
        'START A PROJECT →': '/?nosplash=1#contact',
      };
      for (const [name, href] of Object.entries(expected)) {
        expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
      }
    },
  );

  /* ── Step 5 — the bottom bar ─────────────────────────────────────── */

  it('is a three-cell bar: spacer, centred copyright, scroll-to-top', () => {
    // ⚠️ THE GRID IS BACK, 2026-08-27, and this test asserted the
    // OPPOSITE until then. Both states were right for their moment.
    //
    // 2026-08-25 removed REPLAY INTRO and SCROLL BACK UP, so the
    // prototype's `1fr auto 1fr` had nothing left to balance and went
    // with them — two empty columns around a lone centred line is an
    // inert declaration the next reader treats as load-bearing.
    //
    // The owner then asked for a scroll-to-top control back, because
    // hiding the floating ScrollToTop over this bar left no way up from
    // the very bottom. With the right-hand cell populated again the
    // premise is gone: `1fr auto 1fr` is what keeps the copyright
    // optically centred against a control on ONE side, which neither
    // `space-between` nor `text-align: center` can do.
    // ⚠️ baseDeclsFor, not declsFor — the stacking breakpoint redeclares
    // grid-template-columns as `1fr`, and collapsing both into one object
    // makes this read the MOBILE value and fail against correct code.
    // Exactly the trap that helper's own doc comment describes.
    const bar = Object.fromEntries(
      baseDeclsFor(footerCss, forClass('bottomBar')).map((d) => [d.prop, d.value]),
    );
    expect(bar.display).toBe('grid');
    expect(bar['grid-template-columns']).toBe('1fr auto 1fr');

    const { container } = renderFooter({ path: '/' });
    const bottom = pick(container, 'bottomBar');
    expect(bottom.children).toHaveLength(3);
    // The empty first cell is the counterweight, not decoration.
    expect(has(bottom.children[0], 'barSpacer')).toBe(true);
    expect(bottom.children[0]).toHaveAttribute('aria-hidden', 'true');
    expect(has(bottom.children[1], 'copyright')).toBe(true);
    expect(has(bottom.children[2], 'scrollUp')).toBe(true);
    expect(bottom.children[2]).toHaveTextContent(/SCROLL TO TOP/i);
  });

  it('puts the scroll-to-top link at the RIGHT, and it snaps rather than easing', () => {
    // `justify-self: end` is the prototype's own value (line 601) and is
    // what puts it bottom-right, where the owner asked for it.
    // ⚠️ EXACT selector, not forClass: `.scrollUp:hover` is also a
    // top-level rule, so forClass matches both and the hover's
    // `color: var(--acc)` overwrites the resting `var(--muted)`. Reads
    // as the rest colour being wrong when it is not.
    // And baseDeclsFor, since the breakpoint redeclares justify-self.
    const pill = Object.fromEntries(
      baseDeclsFor(footerCss, (sel) => sel.trim() === '.scrollUp')
        .map((d) => [d.prop, d.value]),
    );
    expect(pill['justify-self']).toBe('end');
    expect(pill['border-radius']).toBe('999px');
    expect(pill['font-size']).toBe('10.5px');
    expect(pill.color).toBe('var(--muted)');

    // ⚠️ NO transition — this bar sits outside the four data-reveal
    // column wrappers, so nothing supplies one and the prototype
    // declares none. Every hover in this bar snaps, in the export as
    // much as here. The PF-93 rule's second half: an unwrapped element
    // keeps its own transition ONLY if the design gives it one.
    expect(Object.keys(pill).some((k) => k.startsWith('transition'))).toBe(false);

    // The hover is its own rule, and it is the prototype's: accent ink
    // and an accent border, nothing else.
    const hover = Object.fromEntries(
      baseDeclsFor(footerCss, (sel) => sel.trim() === '.scrollUp:hover')
        .map((d) => [d.prop, d.value]),
    );
    expect(hover.color).toBe('var(--acc)');
    expect(hover['border-color']).toBe('var(--acc)');
  });

  it('states all rights reserved, on every route', () => {
    for (const path of ['/', '/blog', '/nope']) {
      const { unmount } = renderFooter({ path });
      expect(
        screen.getByText(/ALL RIGHTS RESERVED/),
      ).toHaveTextContent(
        '© 2026 PARINDRA GALLAGE · ALL RIGHTS RESERVED · DESIGNED & BUILT FROM SCRATCH',
      );
      unmount();
    }
  });

  it('renders REPLAY INTRO nowhere, and the scroll-to-top link everywhere', () => {
    // ⚠️ THE TWO REMOVED CONTROLS HAVE DIFFERENT FATES NOW, and keeping
    // them in one test is deliberate — they were removed together on
    // 2026-08-25 and only one came back, which is exactly the pair a
    // fidelity pass would get wrong in both directions.
    //
    // REPLAY INTRO stays gone: "no one wants to replay that splash when
    // in the website". It is in the prototype, so it still needs an
    // absence guard.
    for (const path of ['/', '/blog', '/nope']) {
      const { container, unmount } = renderFooter({ path });
      expect(screen.queryByText(/REPLAY INTRO/i)).toBeNull();
      // no <button> — the restored control is an <a>, not a button
      expect(container.querySelectorAll('button')).toHaveLength(0);

      // The scroll-to-top link is back, on every route, pointing at the
      // hero through sectionHref so it works off the home page too.
      //
      // ⚠️ MATCHED ON /SCROLL TO TOP/, NOT the prototype's own
      // "SCROLL BACK UP ↑" (line 601). The owner renamed it to match
      // what he asked for — "go to top button". Everything else about
      // the control is the prototype's; only the label deviates, and
      // this regex is the record of that.
      const up = screen.getByText(/SCROLL TO TOP/i);
      expect(up.tagName).toBe('A');
      expect(up.getAttribute('href')).toBe(
        path === '/' ? '#hero' : '/?nosplash=1#hero',
      );
      unmount();
    }
  });

  it('declares a rule for the scroll-to-top link but not for REPLAY INTRO', () => {
    // The CSS half. Goes through postcss — the module discusses both
    // controls in prose, so a text search matches the comment rather
    // than the rule.
    const selectors = [];
    postcss.parse(footerCss).walkRules((r) => selectors.push(r.selector));
    expect(selectors.join(' ')).not.toMatch(/\.replay\b/);
    expect(selectors.join(' ')).toMatch(/\.scrollUp\b/);
  });

  it('gives the pill a 44px tap target once the bar stacks', () => {
    // The prototype's 10px padding on 10.5px type measures 39px — four
    // short of the touch minimum, and this is the only way back to the
    // top from the bottom of a phone screen. Applied at the stacked
    // breakpoint only; 39px is the design's value for a pointer.
    const pill = Object.fromEntries(
      mediaDeclsFor(footerCss, '(max-width: 899px)', forClass('scrollUp'))
        .map((d) => [d.prop, d.value]),
    );
    expect(pill['min-height']).toBe('44px');

    const bar = Object.fromEntries(
      mediaDeclsFor(footerCss, '(max-width: 899px)', forClass('bottomBar'))
        .map((d) => [d.prop, d.value]),
    );
    expect(bar['grid-template-columns']).toBe('1fr');
  });
});

/*
 * ── PF-91 · the footer's three contrast fixes ──────────────────────────
 *
 * The footer is where the 2026-08-27 navbar surface did the most damage:
 * adding a translucent ground under text that had been sitting on the
 * page ground flipped --muted2 and --faint from passing to failing, on
 * colours that themselves did not move. That is the whole mechanism, and
 * it is why the fixes below are two steps rather than one.
 */
describe('PF-91 contrast', () => {
  /*
   * ⚠️ EXACT selector, not `forClass`. `forClass('role')` matches
   * `.role` at any depth — including the new
   * `:global(html[data-theme='dark']) .role`, which is also a top-level
   * rule, so `baseDeclsFor` does not filter it out either. Collecting
   * both and letting the last win made `base('role').color` read
   * `var(--muted)` and the base-rule assertion fail against correct
   * code. Same shape as the `.scrollUp` / `.scrollUp:hover` trap this
   * file already documents.
   */
  const base = (name) => {
    const d = {};
    baseDeclsFor(footerCss, (sel) => sel.trim() === `.${name}`)
      .forEach((x) => { d[x.prop] = x.value; });
    return d;
  };

  /* Colour declarations on rules scoped to one theme, with the selector. */
  const scopedColours = (theme, classRe) =>
    declsFor(footerCss, (sel) => sel.includes(`[data-theme='${theme}']`))
      .filter((d) => d.prop === 'color' && classRe.test(d.selector));

  /* Group A — role and bio fail DARK only, so the fix is dark-scoped. */
  describe('role and bio (Group A)', () => {
    it('keeps --muted2 as the base, so light stays unmoved at 4.69', () => {
      expect(base('role').color).toBe('var(--muted2)');
      expect(base('bio').color).toBe('var(--muted2)');
    });

    it('raises both to --muted in DARK, on specificity not source order', () => {
      // ⚠️ `.role, .bio` is a comma-GROUP: postcss sees one rule with one
      // `color` declaration, so counting declarations reads 1 and not 2.
      // Assert against the selector list instead.
      const scoped = scopedColours('dark', /\.(role|bio)\b/);
      expect(scoped).toHaveLength(1);
      expect(scoped[0].value).toBe('var(--muted)');

      const parts = scoped[0].selector.split(',').map((x) => x.trim());
      expect(parts).toHaveLength(2);
      parts.forEach((sel) => {
        // (0,2,1) — never a second bare `.role {}` relying on emission order
        expect(sel).toMatch(/^:global\(html\[data-theme='dark'\]\)\s+\.(role|bio)$/);
      });
    });
  });

  /* Group B — the copyright fails BOTH themes, so it is UNSCOPED. That
     asymmetry with role/bio directly above is deliberate: there is no
     compliant value being moved for symmetry here. */
  describe('copyright (Group B)', () => {
    it('is --muted in BOTH themes — it failed 3.37 dark AND 4.27 light', () => {
      expect(base('copyright').color).toBe('var(--muted)');
    });

    it('has NO dark-scoped override, because the base rule already moved', () => {
      expect(scopedColours('dark', /\.copyright\b/)).toEqual([]);
    });
  });

  /* Group D — the two [data-ok] elements move onto the token. */
  describe('the AVAILABLE FOR WORK badge and CI dot (Group D)', () => {
    it('reads var(--ok) rather than hardcoding the pair', () => {
      expect(base('availabilityLabel').color).toBe('var(--ok)');
      expect(base('statusDotOk').color).toBe('var(--ok)');
    });

    it('DELETED the light-scoped literal, so there is one source of truth', () => {
      // PF-88's port was correct and is why this measured 3.66 rather
      // than 1.72. Keeping it alongside var(--ok) would be two places
      // declaring one colour, drifting the next time either moved.
      expect(scopedColours('light', /\.(availabilityLabel|statusDotOk)\b/)).toEqual([]);
      // and no literal green survives on either node
      expect(base('availabilityLabel').color).not.toMatch(/#0E7A55|#34d399|#0B6446/i);
      expect(base('statusDotOk').color).not.toMatch(/#0E7A55|#34d399|#0B6446/i);
    });

    it('leaves .availabilityDot on its literal — it is NOT a [data-ok] node', () => {
      // Only two elements carry [data-ok] in the prototype: the label
      // and the CI dot. Recolouring this 7px decorative disc as well
      // would be a design change wearing an accessibility fix's clothes.
      expect(base('availabilityDot').background).toBe('#34d399');
    });
  });
});
