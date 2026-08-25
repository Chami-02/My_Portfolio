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
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

function renderFooter({ path = '/', onReplay } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MotionProvider>
        <Footer onReplay={onReplay} />
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
      expect.objectContaining({ prop: 'background', value: 'rgba(252, 163, 17, .06)' }),
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

  it('uses the prototype marquee scale, not the hero\'s slimmed one', () => {
    const text = Object.fromEntries(
      declsFor(footerCss, forClass('marqueeText')).map((d) => [d.prop, d.value]),
    );
    expect(text['font-size']).toBe('clamp(16px, 2vw, 26px)');
    expect(text['padding-right']).toBe('30px');

    const band = Object.fromEntries(
      declsFor(footerCss, forClass('marqueeBand')).map((d) => [d.prop, d.value]),
    );
    expect(band.padding).toBe('10px 0');

    // The hero's 2026-08-17 deviation, read from the hero's own module
    // so this fails if that deviation is ever copied across rather than
    // comparing against a string frozen here.
    const heroText = Object.fromEntries(
      declsFor(heroCss, forClass('marqueeText')).map((d) => [d.prop, d.value]),
    );
    expect(heroText['font-size']).not.toBe(text['font-size']);
    expect(text['font-size']).not.toBe('clamp(13px, 1.6vw, 21px)');
    expect(band.padding).not.toBe('8px 0');
  });

  /* ── Step 6 / PF-93 — no transition on a Reveal-wrapped element ──── */

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
    // be inventing a value.
    for (const name of ['link', 'statusCta', 'replay', 'scrollUp']) {
      const props = declsFor(footerCss, forClass(name)).map((d) => d.prop);
      expect(props.filter((p) => p.startsWith('transition'))).toEqual([]);
    }
  });

  /* ── Content and structure ───────────────────────────────────────── */

  it('repeats the strip twelve times, each ending in a non-breaking space', () => {
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
    expect(strips).toHaveLength(12);
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
    expect(selectors).toMatch(/marqueeText/);
    expect(selectors).toMatch(/availabilityLabel/);
    expect(selectors).toMatch(/statusDotOk/);

    const okRule = light.find((r) => r.selector.includes('statusDotOk'));
    expect(okRule.toString()).toMatch(/#0E7A55/);
  });

  /* ── Step 3 — route-aware links ──────────────────────────────────── */

  it('keeps bare hashes on the home page', () => {
    renderFooter({ path: '/' });
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#about');
    expect(screen.getByRole('link', { name: 'Field Notes' })).toHaveAttribute('href', '#blog');
    expect(screen.getByRole('link', { name: 'SCROLL BACK UP ↑' })).toHaveAttribute('href', '#hero');
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
        'SCROLL BACK UP ↑': '/?nosplash=1#hero',
        'START A PROJECT →': '/?nosplash=1#contact',
      };
      for (const [name, href] of Object.entries(expected)) {
        expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
      }
    },
  );

  /* ── Step 5 — the bottom bar ─────────────────────────────────────── */

  it('lays the bottom bar out as 1fr auto 1fr with three children', () => {
    // The centring is structural: with two children the copyright lands
    // in column 1 and stops being centred, so dropping the replay button
    // is a LAYOUT change, not one fewer control.
    const bar = Object.fromEntries(
      declsFor(footerCss, forClass('bottomBar')).map((d) => [d.prop, d.value]),
    );
    expect(bar['grid-template-columns']).toBe('1fr auto 1fr');

    const { container } = renderFooter({ path: '/' });
    expect(pick(container, 'bottomBar').children).toHaveLength(3);
  });

  it('keeps three bottom-bar children off the home page, without a dead button', () => {
    // No splash exists off "/", so a replay button there would be dead
    // chrome of exactly the kind Step 3 removed from the links — but the
    // grid still needs its first column occupied.
    const { container } = renderFooter({ path: '/blog' });
    expect(pick(container, 'bottomBar').children).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /REPLAY INTRO/ })).toBeNull();
    expect(screen.getByText(/DESIGNED & BUILT FROM SCRATCH/)).toBeInTheDocument();
  });

  it('calls onReplay when REPLAY INTRO is clicked on the home page', () => {
    const onReplay = vi.fn();
    renderFooter({ path: '/', onReplay });
    fireEvent.click(screen.getByRole('button', { name: '↻ REPLAY INTRO' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  /* ── PF-88 — the footer's own reveals on replay ──────────────────── */

  /**
   * ⚠️ The prototype's hideReveals() walks EVERY [data-reveal] in the
   * document, and four of them are in this component. <Footer /> is a
   * sibling of the routed page in App.jsx, so HomePage's keyed subtree
   * cannot reach them — without the grid's own key the four columns
   * stay revealed through a replay and are already shown when the
   * visitor scrolls back down, where the prototype re-animates them.
   */
  it('resets its four column reveals when replayCount rises', () => {
    // ⚠️ The global IntersectionObserver stub in src/test/setup.js fires
    // isIntersecting the instant it observes, so with it in place the
    // remounted columns snap straight back to "in" and this test
    // asserts nothing. A controllable stub reproduces the real
    // situation: the footer is below the fold when replay is clicked, so
    // the fresh observers arm and simply do not fire until the visitor
    // scrolls back down. (Reveal's 140ms safety sweep cannot fire here
    // either — every jsdom rect is zero-sized.)
    const observed = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb) { this.cb = cb; }
      observe(el) { observed.push({ cb: this.cb, el }); }
      unobserve() {}
      disconnect() {}
    });
    const intersectAll = () => {
      const pending = observed.splice(0);
      act(() => pending.forEach(({ cb, el }) => cb([{ isIntersecting: true, target: el }])));
    };

    try {
      const { container, rerender } = render(
        <MemoryRouter initialEntries={['/']}>
          <MotionProvider><Footer replayCount={0} /></MotionProvider>
        </MemoryRouter>,
      );
      const shown = () => [...container.querySelectorAll('[data-reveal]')]
        .map((el) => el.getAttribute('data-reveal'));

      expect(shown()).toEqual(['out', 'out', 'out', 'out']);
      intersectAll();
      expect(shown()).toEqual(['in', 'in', 'in', 'in']);

      rerender(
        <MemoryRouter initialEntries={['/']}>
          <MotionProvider><Footer replayCount={1} /></MotionProvider>
        </MemoryRouter>,
      );
      expect(shown()).toEqual(['out', 'out', 'out', 'out']);

      // And they still reveal again once scrolled into view — the
      // control. A remount that broke the observer would also report
      // "out" forever.
      intersectAll();
      expect(shown()).toEqual(['in', 'in', 'in', 'in']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does NOT remount the bottom bar, so the button keeps focus', () => {
    // Remounting the element that was just activated drops keyboard
    // focus to <body> mid-sequence. Nothing in the bar is a reveal
    // target, so it has nothing to reset either.
    const { container, rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <MotionProvider><Footer replayCount={0} /></MotionProvider>
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: '↻ REPLAY INTRO' });
    button.focus();
    expect(document.activeElement).toBe(button);

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <MotionProvider><Footer replayCount={1} /></MotionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '↻ REPLAY INTRO' })).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(pick(container, 'bottomBar').children).toHaveLength(3);
  });

  /**
   * ⚠️ A WIRING guard, not a behaviour test, and it is deliberate that
   * it reads App.jsx as source.
   *
   * The two tests above prove the component does the right thing with
   * the props; nothing proves App.jsx still HANDS it both. Dropping
   * `replayCount` there is silent — every test in this file passes,
   * every test in HomePage's file passes, and the footer's four columns
   * quietly stop resetting on replay.
   *
   * It lives here rather than in an App test because App.jsx sits at
   * src/ root, which has no `__tests__` directory under this repo's
   * per-module convention (CLAUDE.md is explicit that there is no
   * top-level src/__tests__/).
   *
   * Comments are stripped first: this file and App.jsx both discuss the
   * prop names in prose, and a raw search would match the explanation
   * rather than the JSX.
   */
  it('is handed BOTH props by App.jsx', () => {
    const appSrc = readCss('../../../App.jsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const tag = /<Footer\b([^/>]*)\/>/.exec(appSrc);
    expect(tag, '<Footer /> is not rendered in App.jsx at all').not.toBeNull();
    expect(tag[1]).toMatch(/onReplay=\{replay\}/);
    expect(tag[1]).toMatch(/replayCount=\{replayCount\}/);
  });

  it('is handed replayCount by App.jsx to HomePage too', () => {
    const appSrc = readCss('../../../App.jsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const tag = /<HomePage\b([^/>]*)\/>/.exec(appSrc);
    expect(tag).not.toBeNull();
    expect(tag[1]).toMatch(/replayCount=\{replayCount\}/);
  });
});
