// frontend/src/components/sections/__tests__/HeroSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import postcss from 'postcss';
import { HeroSection } from '../HeroSection';
import { MotionProvider } from '../../../providers/MotionProvider';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../HeroSection.module.css'), 'utf8');

/** The declaration block of a single rule, by exact selector. */
function ruleBody(selector) {
  const i = css.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule for "${selector}"`);
  return css.slice(i, css.indexOf('}', i));
}

function mockMatchMedia(matches) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

/* The flushable requestAnimationFrame queue that used to live here went
   with the parallax grid (2026-08-18) — it existed only to drive that
   scroll listener's coalescing, and HeroSection no longer calls rAF at
   all. AboutSection.test.jsx still has the same harness and still needs
   it, including the note on why a synchronous stub does not work. */

function mockRect(el, rect) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
}

const withMotion = (ui) => <MotionProvider>{ui}</MotionProvider>;
const pick = (container, name) => container.querySelector(`[class*="${name}"]`);
const pickAll = (container, name) => container.querySelectorAll(`[class*="${name}"]`);

describe('HeroSection (PF-80)', () => {
  beforeEach(() => {
    window.innerWidth = 1440;
    window.innerHeight = 900;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── content ────────────────────────────────────────────────────────

  it('renders all three role pills with their exact text', () => {
    mockMatchMedia(false);
    render(withMotion(<HeroSection />));

    ['Full-Stack Web Developer', 'Cloud & DevOps Enthusiast', 'Continuous Learner']
      .forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
  });

  // Eight from the prototype plus the owner-requested Next.js and Java.
  it('renders all ten tech chips', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    ['React', 'Node.js', 'Docker', 'MongoDB', 'Python', 'PostgreSQL', 'Git',
      'FastAPI', 'Next.js', 'Java']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    expect(pickAll(container, 'chipLabel')).toHaveLength(10);
  });

  // Owner-requested, 2026-08-17. An <a> rather than a <button> so the
  // in-page move is a real navigation: native smooth scroll, keyboard
  // activation and open-in-new-tab all come for free.
  // Matched loosely on purpose. What this guards is that the CTA exists
  // and points at #contact; the exact wording is copy and is expected to
  // get edited without a test failing for it.
  it('renders the "build something loud" CTA pointing at #contact', () => {
    mockMatchMedia(false);
    render(withMotion(<HeroSection />));

    const cta = screen.getByText(/build something loud/i).closest('a');
    expect(cta).not.toBeNull();
    expect(cta).toHaveAttribute('href', '#contact');
  });

  // The pill's outline keeps breathing (glowpulse); only the dot's own
  // pulse was dropped. That is the whole reason this dot is not
  // .badgeDot — the two look identical and animate differently, so a
  // later "de-duplication" into one shared class would silently put the
  // pulse back.
  it('gives the loud CTA a dot element of its own, not the badge dot', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    const ctaDot = pick(container, 'loudCtaDot');
    expect(ctaDot).not.toBeNull();
    expect(ctaDot.className).not.toMatch(/badgeDot/);
    expect(pick(container, 'badgeDot')).not.toBeNull();
  });

  it('sits the loud CTA in the pill row, after Continuous Learner', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    const row = pick(container, 'pillRow');
    const cta = screen.getByText(/build something loud/i).closest('a');
    expect(row.contains(cta)).toBe(true);
    expect(row.lastElementChild).toBe(cta);
  });

  it('renders the badge, eyebrow and both heading lines', () => {
    mockMatchMedia(false);
    render(withMotion(<HeroSection />));

    expect(screen.getByText('OPEN TO OPPORTUNITIES')).toBeInTheDocument();
    expect(screen.getByText('HEY — I AM')).toBeInTheDocument();
    expect(screen.getByText('Parindra')).toBeInTheDocument();
    expect(screen.getByText('Gallage')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('carries id="hero" so the navbar anchor resolves', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));
    expect(container.querySelector('section#hero')).not.toBeNull();
  });

  // The prototype's typeLoop()/ROLES runs and updates state.typed, but
  // {{ typed }} appears nowhere in the hero markup. Nothing renders it,
  // so nothing is built. This pins that reading.
  it('does not render a typewriter/typed element', () => {
    mockMatchMedia(false);
    render(withMotion(<HeroSection />));
    expect(screen.queryByText('MERN Stack Engineer')).toBeNull();
  });

  it('CTA buttons point at the right in-page anchors', () => {
    mockMatchMedia(false);
    render(withMotion(<HeroSection />));

    expect(screen.getByText('VIEW MY WORK →').closest('a'))
      .toHaveAttribute('href', '#projects');
    expect(screen.getByText('DOWNLOAD CV').closest('a'))
      .toHaveAttribute('href', '#contact');
  });

  it('renders the portrait with its alt text and the marquee strip', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    // PF-83 retitled this from the bare "Parindra Gallage" it shared with
    // the navbar logo and the splash logo — three images announcing one
    // string. Asserted as an exact value, and asserted here rather than
    // in one central place, because the sibling halves live in
    // Navbar.test.jsx and Splash.test.jsx: one file per module, so no
    // single edit can quietly collapse them back onto each other.
    expect(screen.getByAltText('Portrait of Parindra Gallage')).toBeInTheDocument();
    expect(screen.queryByAltText('Parindra Gallage')).toBeNull();
    // Marquee duplicates its children, so both copies match.
    expect(pickAll(container, 'marqueeText')).toHaveLength(2);
  });

  // The marquee follows </section> in the prototype. Nested inside a
  // min-height:100vh flex-centre section it would be laid out as a
  // centred flex item instead of a full-bleed strip beneath the hero.
  it('renders the marquee as a sibling of the section, not a child', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    const wrap = pick(container, 'marqueeWrap');
    expect(wrap).not.toBeNull();
    expect(wrap.closest('section')).toBeNull();
  });

  // The ticket's inventory listed four blobs in the section background
  // AND four more in the portrait stage. The prototype has four in
  // total, all inside the stage (lines 138-141).
  it('renders exactly four drift blobs, all inside the portrait stage', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    const blobs = pickAll(container, 'blob');
    expect(blobs).toHaveLength(4);
    const stage = pick(container, 'portraitStage');
    blobs.forEach((b) => expect(stage.contains(b)).toBe(true));
  });

  // The light-theme reveal of this element is a global rule in
  // tokens.css matching [data-lightplate], not anything in this
  // component's module. The attribute is the whole join between them:
  // drop it and the plate never appears in light theme, with no error
  // and nothing wrong in either file read on its own.
  it('marks the light plate with data-lightplate for the global theme rule', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    const plate = pick(container, 'lightPlate');
    expect(plate).not.toBeNull();
    expect(plate).toHaveAttribute('data-lightplate');
  });

  // ── stylesheet assertions ──────────────────────────────────────────
  //
  // Read as text, not through the DOM: vite.config.js sets no test.css,
  // so CSS Modules are stubbed under Vitest — `composes` never resolves
  // and getComputedStyle reports initial values. A DOM assertion here
  // would pass or fail for the wrong reason.

  describe('stylesheet', () => {

    // Owner-requested, 2026-08-18: every section wash was removed so the
    // StarfieldCanvas reads through the whole page. Asserted as absent
    // because the PROTOTYPE STILL HAS IT — a later fidelity pass diffing
    // the two would read this as a missing transcription and paint it
    // back, which is precisely the regression worth catching. 
    it('paints no section background, so the starfield reads through', () => {
      // Comments stripped: the rule DOCUMENTS the removed prototype
      // gradient in place, so a raw check matches the note explaining the
      // absence rather than an actual declaration.
      const rule = ruleBody('section.hero').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(rule).not.toContain('background');
      expect(rule).not.toContain('gradient');
    });
    // Owner-requested asymmetry, and the whole point of .loudCtaDot
    // existing beside .badgeDot: the CTA's outline breathes, its dot
    // does not. Merging the two classes would silently restore the pulse.
    it('pulses the badge dot but not the loud CTA dot', () => {
      expect(ruleBody('.badgeDot')).toContain('composes: kf-dot from global');
      expect(ruleBody('.loudCtaDot')).not.toContain('composes');
      expect(ruleBody('.loudCtaDot')).not.toContain('animation');
    });

    it('keeps the loud CTA outline breathing, like the badge', () => {
      expect(ruleBody('.loudCta')).toContain('composes: kf-glowpulse from global');
      expect(ruleBody('.loudCta')).toContain('animation-duration: 3s');
    });

    /**
     * PF-93, 2026-08-21. Both of these were `[data-reveal='in']
     * [data-type='pop']` gates until this ticket; both are now deleted
     * outright, because the gate matches at the entrance's START
     * (Reveal.jsx:57) and therefore animated the entrance on the 0.25s
     * hover values. Measured on the production build — opacity reached 1
     * at 0ms for both, and the pop settled at 448ms (.rolePill) and
     * 301ms (.loudCta) instead of ~900ms.
     *
     * `.rolePill` is the sharper case. The prototype's line 102 really
     * does declare `transition:border-color .25s,background .25s,
     * transform .25s` in its style attribute, and PF-80 transcribed it
     * faithfully — but hideReveals() writes el.style.transition into the
     * SAME declaration block, so the design never renders that value.
     * This guard is what stops a future fidelity pass reading line 102
     * and putting it back.
     *
     * `animation` longhands are untouched by this: both elements keep
     * their `composes: kf-glowpulse` and its timing, asserted above.
     * Only `transition*` is forbidden.
     */
    it('declares no transition on .rolePill or .loudCta, at any selector', () => {
      const offenders = [];
      postcss.parse(css).walkRules((rule) => {
        if (!/\.(rolePill|loudCta)(?![\w-])/.test(rule.selector)) return;
        rule.walkDecls(/^transition/, (d) => {
          offenders.push(`${rule.selector} { ${d.prop}: ${d.value} }`);
        });
      });
      expect(offenders).toEqual([]);
    });

    // The hover END STATES stay — .rolePill's are the prototype's
    // (line 102's style-hover). Asserted so the deletion above cannot be
    // over-applied into removing the hover treatment itself.
    it('keeps the hover end states the transitions used to animate', () => {
      const pill = ruleBody('.rolePill:hover');
      expect(pill).toContain('border-color: var(--acc');
      expect(pill).toContain('background: rgba(252, 163, 17, .12)');
      expect(pill).toContain('transform: translateY(-2px)');

      const cta = ruleBody('.loudCta:hover');
      expect(cta).toContain('border-color: var(--acc');
      expect(cta).toContain('transform: translateY(-2px)');
    });

    it('floats every chip out of phase with the others', () => {
      const durations = [...css.matchAll(/\.chip[A-Z]\w*\s*{[^}]*animation-duration:\s*([\d.]+)s/g)]
        .map((m) => m[1]);
      expect(durations).toHaveLength(10);
      expect(new Set(durations).size).toBe(10);
    });

    // Owner-requested edge blend. Both mask layers and BOTH composite
    // spellings have to survive: with no mask-composite the layers union
    // instead of intersecting, which covers nearly the whole box and
    // silently hands back the unmasked image — no error, no visual clue
    // beyond the hard rim being back.
    it('fades the portrait edges with an intersected two-layer mask', () => {
      const img = ruleBody('.portraitImg');

      expect(img).toContain('mask-image:');
      expect(img).toContain('-webkit-mask-image:');
      expect(img).toContain('mask-composite: intersect');
      expect(img).toContain('-webkit-mask-composite: source-in');

      // Radii over 50% would clip the gradient before it reaches zero
      // and put a hard line back at the box edge.
      const radial = img.match(/radial-gradient\(ellipse ([\d.]+)% ([\d.]+)%/);
      expect(radial).not.toBeNull();
      expect(Number(radial[1])).toBeLessThanOrEqual(50);
      expect(Number(radial[2])).toBeLessThanOrEqual(50);
    });

    // Owner-requested slimming. Both halves matter — dropping the padding
    // alone barely moves the band, because the line box dominates it.
    it('slims the marquee band below the prototype\'s values', () => {
      expect(ruleBody('.marqueeInner')).toContain('padding: 8px 0');
      expect(ruleBody('.marqueeText')).toContain('font-size: clamp(13px, 1.6vw, 21px)');
      expect(ruleBody('.marqueeText')).toContain('padding-right: 24px');
    });

    // The strip stays edge to edge — only its thickness came down. A
    // max-width or horizontal margin here would be the other reading of
    // "reduce the width", which was explicitly not what was asked for.
    it('keeps the marquee full-bleed', () => {
      const wrap = ruleBody('.marqueeWrap');
      expect(wrap).not.toContain('max-width');
      expect(wrap).not.toContain('margin-inline');
      expect(wrap).toContain('margin: -10px 0 0');
    });
  });

  // ── tilt ───────────────────────────────────────────────────────────

  it('writes the exact tilt transform on pointermove', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    const stage = pick(container, 'portraitStage');
    mockRect(stage, { left: 0, top: 0, width: 0, height: 0 });

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 600 }));
    });

    // nx = 900 / 720 = 1.25          → rotateY 8.75deg,  translateX 17.5px
    // ny = 600 / 450 = 1.3333…       → rotateX -6.67deg, translateY 10.7px
    const inner = pick(container, 'portraitInner');
    expect(inner.style.transform)
      .toBe('rotateY(8.75deg) rotateX(-6.67deg) translate3d(17.5px,10.7px,0)');
  });

  // Normalisation is against the window, not the stage's own box — so
  // the same cursor position at a wider viewport tilts LESS.
  it('scales tilt sensitivity with the viewport, not the stage', () => {
    mockMatchMedia(false);
    window.innerWidth = 2880;
    const { container } = render(withMotion(<HeroSection />));

    const stage = pick(container, 'portraitStage');
    mockRect(stage, { left: 0, top: 0, width: 0, height: 0 });

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 600 }));
    });

    // nx = 900 / 1440 = 0.625 → rotateY 4.38deg (half of the 1440 case)
    expect(pick(container, 'portraitInner').style.transform)
      .toContain('rotateY(4.38deg)');
  });

  // Deliberately ungated: a 1:1 pointer follow, same category as
  // CursorGlow. Parallax below is the one that gates.
  it('still tilts under reduced motion', () => {
    mockMatchMedia(true);
    const { container } = render(withMotion(<HeroSection />));

    const stage = pick(container, 'portraitStage');
    mockRect(stage, { left: 0, top: 0, width: 0, height: 0 });

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 600 }));
    });

    expect(pick(container, 'portraitInner').style.transform).toContain('rotateY(');
  });

  // ── parallax ───────────────────────────────────────────────────────
  //
  // The hero's data-para="0.12" grid layer and its scroll listener were
  // removed 2026-08-18 (owner-requested — see HeroSection.jsx). Four
  // tests covering the 0.12 factor, the mount write, the reduced-motion
  // gate and rAF coalescing went with them.
  //
  // Not simply deleted: asserted as absent below, because the prototype
  // still has the element at line 84 and a later fidelity pass would
  // otherwise read this as an un-transcribed layer and add it back.
  // computeParallaxTransform() keeps its own tests in
  // utils/__tests__/parallax.test.js, and AboutSection still exercises
  // the scroll-listener shape at 0.05.

  it('renders no parallax grid layer', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));

    expect(pick(container, 'parallaxGrid')).toBeNull();
    // The element carried the grid; the stylesheet must not keep it
    // alive for something else to pick up.
    expect(css).not.toContain('background-size: 74px 74px');
  });

  it('registers no scroll listener now the grid is gone', () => {
    mockMatchMedia(false);
    const addSpy = vi.spyOn(window, 'addEventListener');

    render(withMotion(<HeroSection />));

    const events = addSpy.mock.calls.map(([e]) => e);
    expect(events).not.toContain('scroll');
    // The portrait tilt is a different listener and stays.
    expect(events).toContain('pointermove');
  });

  // ── teardown ───────────────────────────────────────────────────────

  // Only pointermove now. The scroll half went with the parallax grid
  // (2026-08-18) — its absence is asserted in the parallax block above,
  // so this covers teardown of what remains rather than silently
  // dropping the assertion.
  it('removes the pointermove listener on unmount', () => {
    mockMatchMedia(false);
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(withMotion(<HeroSection />));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });
});
