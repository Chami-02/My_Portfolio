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

  it('declares NO background on the <footer> rule', () => {
    // The prototype's line 543 carries
    //   background: linear-gradient(180deg, rgba(var(--gnd),.4),
    //                               rgba(var(--ftr),.86))
    // omitted under the 2026-08-18 site-wide wash removal. Asserted as
    // an ABSENCE so a fidelity pass diffing against the prototype
    // cannot read it as un-transcribed and paint it back.
    const decls = declsFor(footerCss, forClass('footer'));
    expect(decls.length).toBeGreaterThan(0);          // the rule exists at all
    expect(decls.map((d) => d.prop)).not.toContain('background');
    expect(decls.map((d) => d.prop)).not.toContain('background-image');
    expect(decls.some((d) => /gradient/.test(d.value))).toBe(false);
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

  it('repeats the strip sixteen times, each ending in a non-breaking space', () => {
    // ⚠️ TWELVE, not the prototype's two, and the number is arithmetic.
    // `marq` translates the track by -50% of its OWN width, so one cycle
    // slides it by half the copies — the requirement is
    // `copies >= 2 * band / copy`, which is 4.8 at 1440px and 8.5 at
    // 2560px, NOT the intuitive `copy >= band`. One copy of this strip
    // is 600px, so the prototype's two left 840px of the band empty at
    // the wrap, growing as the track slid. Twelve covers a band up to
    // 3600px. Measured in Chromium; owner-approved 2026-08-24.
    //
    // Even, separately: an odd count lands mid-copy at the wrap and the
    // text visibly jumps once per cycle.
    //
    // The trailing U+00A0 is a different thing again — the gap BETWEEN
    // repeats. A plain space is collapsed and the copies butt together.
    const { container } = renderFooter();
    const strips = pickAll(container, 'marqueeText');
    expect(strips).toHaveLength(16);
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

  it('scopes the [data-ok] and [data-strip] colours to a real theme attribute', () => {
    // Ported from applyTheme() as CSS rather than a JS sweep. Both win
    // on SPECIFICITY — (0,2,0) against (0,1,0) — not on bundle emission
    // order, which is the tie that has bitten this project six times.
    const light = [];
    postcss.parse(footerCss).walkRules((rule) => {
      if (rule.selector.includes("data-theme='light'")) light.push(rule);
    });
    const selectors = light.map((r) => r.selector).join(' ');
    expect(selectors).toMatch(/availabilityLabel/);
    expect(selectors).toMatch(/statusDotOk/);
    // ⚠️ marqueeText is deliberately NOT here any more. The band is
    // ink-on-accent since 2026-08-25 and --accInk already flips per
    // theme, so the prototype's [data-strip] opacity rule has nothing
    // left to act on.
    expect(selectors).not.toMatch(/marqueeText/);

    const okRule = light.find((r) => r.selector.includes('statusDotOk'));
    expect(okRule.toString()).toMatch(/#0E7A55/);
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

  it('is a single centred copyright line, with no grid left behind', () => {
    // ⚠️ OWNER-REQUESTED, 2026-08-25. The prototype's bar is
    // `1fr auto 1fr` holding REPLAY INTRO · copyright · SCROLL BACK UP.
    // Both outer controls are gone, so the grid goes with them — two
    // empty `1fr` columns around a lone centred line is exactly the kind
    // of inert declaration the next reader treats as load-bearing.
    const bar = Object.fromEntries(
      declsFor(footerCss, forClass('bottomBar')).map((d) => [d.prop, d.value]),
    );
    expect(bar['grid-template-columns']).toBeUndefined();
    expect(bar.display).toBeUndefined();
    expect(bar['text-align']).toBe('center');

    const { container } = renderFooter({ path: '/' });
    const bottom = pick(container, 'bottomBar');
    expect(bottom.children).toHaveLength(1);
    expect(has(bottom.firstElementChild, 'copyright')).toBe(true);
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

  it('renders neither removed control, on any route', () => {
    // Guarded as an ABSENCE in both directions: the button and the link
    // are in the prototype, so a fidelity pass diffing against the
    // export reads them as un-transcribed and puts them back.
    for (const path of ['/', '/blog', '/nope']) {
      const { container, unmount } = renderFooter({ path });
      expect(container.querySelectorAll('button')).toHaveLength(0);
      expect(screen.queryByText(/REPLAY INTRO/i)).toBeNull();
      expect(screen.queryByText(/SCROLL BACK UP/i)).toBeNull();
      expect(container.querySelectorAll('a[href$="#hero"]')).toHaveLength(0);
      unmount();
    }
  });

  it('declares no rule for either removed control', () => {
    // The CSS half. Both rules existed until today and the module still
    // discusses them in prose, so this goes through postcss — a text
    // search matches the comment explaining the removal.
    const selectors = [];
    postcss.parse(footerCss).walkRules((r) => selectors.push(r.selector));
    expect(selectors.join(' ')).not.toMatch(/\.replay\b/);
    expect(selectors.join(' ')).not.toMatch(/\.scrollUp\b/);
  });
});
