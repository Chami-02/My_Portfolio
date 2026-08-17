// frontend/src/components/sections/__tests__/HeroSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

/**
 * A flushable requestAnimationFrame queue.
 *
 * Deliberately NOT a stub that invokes the callback synchronously: the
 * component does `raf = requestAnimationFrame(cb)`, and a synchronous
 * stub runs cb — which clears `raf` — before that assignment lands, so
 * `raf` ends up holding a stale handle and the coalescing guard latches
 * shut forever. Real rAF is always async, so queueing reproduces it and
 * a sync stub does not.
 */
let rafQueue = [];
function queueRaf() {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb) => rafQueue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
}
function flushRaf() {
  const pending = rafQueue;
  rafQueue = [];
  act(() => { pending.forEach((cb) => cb()); });
}

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
    queueRaf();
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

    expect(screen.getByAltText('Parindra Gallage')).toBeInTheDocument();
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

  it('does not touch the parallax grid transform under reduced motion', () => {
    mockMatchMedia(true);
    const { container } = render(withMotion(<HeroSection />));

    act(() => {
      window.scrollY = 500;
      window.dispatchEvent(new Event('scroll'));
    });
    flushRaf();

    expect(pick(container, 'parallaxGrid').style.transform).toBe('');
  });

  // Matches the prototype's trailing this.onScroll(). Without it, a
  // reload that restores mid-page scroll leaves the grid unshifted.
  it('writes the parallax transform once at mount, before any scroll', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));
    flushRaf();

    // jsdom rects are all-zero: mid = 0 + 0 - 450 = -450 → 450 * .12 = 54
    expect(pick(container, 'parallaxGrid').style.transform)
      .toBe('translate3d(0,54.0px,0)');
  });

  it('updates the parallax grid on scroll, at the 0.12 factor', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));
    flushRaf();

    const grid = pick(container, 'parallaxGrid');
    mockRect(grid, { top: 200, height: 500 });

    act(() => {
      window.scrollY = 500;
      window.dispatchEvent(new Event('scroll'));
    });
    flushRaf();

    // mid = 200 + 250 - 450 = 0 → no shift at viewport centre
    expect(grid.style.transform).toBe('translate3d(0,0.0px,0)');

    mockRect(grid, { top: -300, height: 500 });
    act(() => { window.dispatchEvent(new Event('scroll')); });
    flushRaf();

    // mid = -300 + 250 - 450 = -500 → 500 * .12 = 60
    expect(grid.style.transform).toBe('translate3d(0,60.0px,0)');
  });

  it('coalesces multiple scroll events into a single frame', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<HeroSection />));
    flushRaf();                                  // drain the mount frame

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });

    expect(rafQueue).toHaveLength(1);
    flushRaf();
    expect(pick(container, 'parallaxGrid').style.transform).toContain('translate3d');
  });

  // ── teardown ───────────────────────────────────────────────────────

  it('removes the pointermove and scroll listeners on unmount', () => {
    mockMatchMedia(false);
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(withMotion(<HeroSection />));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
