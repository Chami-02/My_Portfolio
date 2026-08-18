// frontend/src/components/sections/__tests__/AboutSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AboutSection } from '../AboutSection';
import { MotionProvider } from '../../../providers/MotionProvider';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../AboutSection.module.css'), 'utf8');

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
 * A flushable requestAnimationFrame queue — same reasoning as
 * HeroSection.test.jsx. Deliberately NOT a stub that invokes the callback
 * synchronously: the component does `raf = requestAnimationFrame(cb)`, and
 * a synchronous stub runs cb — which clears `raf` — before that assignment
 * lands, so `raf` holds a stale handle and the coalescing guard latches
 * shut forever. Real rAF is always async.
 *
 * It also has to exist at all: reading el.style.transform straight after
 * dispatching a scroll event would read it before any real frame had run.
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
const portrait = (container) => container.querySelector('img[alt*="visor"]');

describe('AboutSection (PF-81)', () => {
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

  it('carries id="about" so the navbar anchor resolves', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));
    expect(container.querySelector('section#about')).not.toBeNull();
  });

  it('renders the numbered eyebrow and its decorative rule', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));

    expect(screen.getByText('01 / ABOUT')).toBeInTheDocument();
    expect(pick(container, 'eyebrowLine')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the heading with "I am" as the outlined word', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Who')).toBeInTheDocument();

    const outlined = screen.getByText('I am');
    expect(outlined).toBe(pick(container, 'outlined'));
  });

  it('renders three CountUp stats landing on the right values', () => {
    mockMatchMedia(true);          // reduced motion — CountUp lands immediately
    render(withMotion(<AboutSection />));

    expect(screen.getByText('10+')).toBeInTheDocument();
    // Two cards count to 5 — PROJECTS BUILT and GITHUB REPOS. That is the
    // prototype's, not a duplication slip on the way over.
    expect(screen.getAllByText('5+')).toHaveLength(2);

    ['PROJECTS BUILT', 'TECHNOLOGIES', 'GITHUB REPOS']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  // The fourth card has no data-count in the prototype. Rendering it
  // through CountUp with a sentinel would animate a word.
  it('renders the fourth stat card as static text, not a counter', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));

    expect(screen.getByText('Continuous')).toBeInTheDocument();
    expect(screen.getByText('LEARNING')).toBeInTheDocument();

    expect(pickAll(container, 'statCard')).toHaveLength(4);
    const staticNumber = pickAll(container, 'statNumberStatic');
    expect(staticNumber).toHaveLength(1);
    // CountUp renders a <span>; this card must contain none.
    expect(staticNumber[0].querySelector('span')).toBeNull();
  });

  it('CTAs point at the projects anchor and the real mailto address', () => {
    mockMatchMedia(false);
    render(withMotion(<AboutSection />));

    expect(screen.getByText('SEE MY WORK →').closest('a'))
      .toHaveAttribute('href', '#projects');
    expect(screen.getByText('EMAIL ME').closest('a'))
      .toHaveAttribute('href', 'mailto:parindrachameekara@gmail.com');
  });

  it('renders the portrait with its alt text', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));

    expect(screen.getByAltText('Parindra Gallage in the visor')).toBeInTheDocument();
    // The sweep and the fade are decoration, not content.
    expect(pick(container, 'portraitSweep')).toHaveAttribute('aria-hidden', 'true');
  });

  // Owner-requested removal, 2026-08-18. Asserted as absent rather than
  // simply deleted, because the prototype still carries it at line 205 —
  // a later fidelity pass comparing the two would otherwise read this as
  // a transcription gap and "fix" it back in.
  it('does not render the prototype\'s location caption', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));

    expect(screen.queryByText(/GALLE, SRI LANKA/)).toBeNull();
    expect(screen.queryByText(/SEEING THE STACK/)).toBeNull();
    // The element, not just its text — an empty positioned div would
    // still occupy the frame's bottom-left corner.
    expect(pick(container, 'portraitCaption')).toBeNull();
    // The fade is a different element and stays.
    expect(pick(container, 'portraitFade')).not.toBeNull();
  });

  // ── stylesheet assertions ──────────────────────────────────────────
  //
  // Read as text, not through the DOM: vite.config.js sets no test.css, so
  // CSS Modules are stubbed under Vitest — `composes` never resolves and
  // getComputedStyle reports initial values. A DOM assertion here would
  // pass or fail for the wrong reason.

  describe('stylesheet', () => {
    // A bare `.about` ties with global.css:338's `[id] { scroll-margin-top:
    // 5rem }` at (0,1,0) and loses on stylesheet order, computing 80px for
    // a 71px header and landing the eyebrow 9px low. jsdom cannot catch
    // this — CSS Modules are stubbed, so no cascade exists to lose.
    it('qualifies the section selector so [id] cannot win the cascade', () => {
      expect(css).toContain('\nsection.about {');
      expect(ruleBody('section.about')).toContain('scroll-margin-top: var(--header-h)');
    });

    // First use of `sweep` in the port. Naming it directly in a module
    // scopes it to an identifier no @keyframes defines and the element
    // silently does not animate; `composes` must also be the first
    // declaration in the rule.
    it('pulls the sweep keyframe in through a global carrier, first', () => {
      const sweep = ruleBody('.portraitSweep');
      expect(sweep).toContain('composes: kf-sweep from global');
      expect(sweep.indexOf('composes:')).toBeLessThan(sweep.indexOf('position:'));
      expect(sweep).toContain('animation-duration: 8s');
      // Longhands only — the shorthand would reset animation-name to none
      // and undo the composed class.
      expect(sweep).not.toMatch(/animation:\s/);
    });

    it('composes the two extracted patterns rather than redeclaring them', () => {
      ['section-eyebrow', 'section-eyebrow-label', 'section-eyebrow-line', 'outline-text']
        .forEach((name) => {
          expect(css).toContain(`composes: ${name} from '../../styles/patterns.module.css'`);
        });
      // The stroke itself lives in patterns.module.css, not here.
      expect(css).not.toContain('-webkit-text-stroke');
    });

    // PF-82 moved margin-bottom OUT of the shared .section-eyebrow — the
    // prototype's Skills eyebrow is 14px against this one's 38px, so the
    // two sections never agreed and PF-81 had generalised from a single
    // observation. This section's own 38px has to be restored locally or
    // the gap under `01 / ABOUT` silently collapses to zero.
    it('declares its own 38px eyebrow gap, no longer inherited', () => {
      expect(ruleBody('.eyebrow')).toContain('margin-bottom: 38px');
    });

    // Prototype line 211 is 18px, line 212 is 20px. Collapsing the pair to
    // one value is the wrong-by-2px change that stays invisible in review.
    it('keeps the second paragraph\'s 20px bottom margin distinct from the first\'s 18px', () => {
      expect(ruleBody('.body')).toContain('margin: 0 0 18px');
      const second = ruleBody('.bodySecond');
      expect(second).toContain('composes: body');
      expect(second).toContain('margin-bottom: 20px');
    });

    // The card is a Reveal, so its own hover transition and Reveal's
    // entrance transition compete for one element. Declared bare, this
    // ties with `.reveal` at (0,1,0) and wins on order — replacing the
    // 1.05s entrance ease with a 0.25s hover transition. Gating on
    // [data-reveal='in'] makes it (0,2,0) and hands over only once the
    // entrance has finished.
    it('gates the stat-card hover transition behind a finished reveal', () => {
      expect(css).toContain("\n.statCard[data-reveal='in'] {");
      expect(ruleBody('.statCard')).not.toContain('transition');
      expect(ruleBody(".statCard[data-reveal='in']"))
        .toContain('transition: border-color .25s, transform .25s');
    });

    // The resting scale must stay inline in the JSX. Declared here it
    // would compete with the parallax effect's own write, and under
    // reduced motion there would be two sources for one value.
    it('leaves the portrait transform out of the module', () => {
      expect(ruleBody('.portraitImg')).not.toContain('transform');
    });

    // About's CTAs are visually close to the hero's and not identical:
    // 14px/24px against 16px/26px, 12px type against 12.5px, and no
    // resting shadow on the primary. Sharing a base would drift both.
    it('uses About\'s own CTA metrics, not the hero\'s', () => {
      const primary = ruleBody('.ctaPrimary');
      expect(primary).toContain('padding: 14px 24px');
      expect(primary).toContain('font-size: 12px');
      // No RESTING shadow, where the hero's primary has one. Matched as a
      // declaration, not a substring — the transition below legitimately
      // names box-shadow as a property it animates.
      expect(primary).not.toMatch(/\n\s*box-shadow:/);
      expect(ruleBody('.ctaSecondary')).toContain('padding: 14px 24px');
    });
  });

  // ── parallax ───────────────────────────────────────────────────────

  // Matches the prototype's trailing this.onScroll(). Without it a reload
  // that restores mid-page scroll leaves the portrait unshifted.
  it('writes the parallax transform once at mount, before any scroll', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));
    flushRaf();

    // jsdom rects are all-zero: mid = 0 + 0 - 450 = -450 → 450 * .05 = 22.5
    expect(portrait(container).style.transform)
      .toBe('translate3d(0,22.5px,0) scale(1.1)');
  });

  it('updates the portrait transform on scroll, at the 0.05 factor', () => {
    mockMatchMedia(false);
    const { container } = render(withMotion(<AboutSection />));
    flushRaf();                                   // drain the mount frame

    const img = portrait(container);
    mockRect(img, { top: 200, height: 500 });

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });
    flushRaf();

    // mid = 200 + 250 - 450 = 0 → no shift at viewport centre
    expect(img.style.transform).toBe('translate3d(0,0.0px,0) scale(1.1)');

    mockRect(img, { top: -300, height: 500 });
    act(() => { window.dispatchEvent(new Event('scroll')); });
    flushRaf();

    // mid = -300 + 250 - 450 = -500 → 500 * .05 = 25
    expect(img.style.transform).toBe('translate3d(0,25.0px,0) scale(1.1)');
  });

  // The scale(1.1) is the effect's, not the markup's. The prototype's
  // static scale(1.02) survives only where the effect never runs.
  it('leaves the portrait at its static scale(1.02) under reduced motion', () => {
    mockMatchMedia(true);
    const { container } = render(withMotion(<AboutSection />));
    flushRaf();

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });
    flushRaf();

    expect(portrait(container).style.transform).toBe('scale(1.02)');
  });

  it('coalesces multiple scroll events into a single frame', () => {
    mockMatchMedia(false);
    render(withMotion(<AboutSection />));
    flushRaf();                                   // drain the mount frame

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });

    expect(rafQueue).toHaveLength(1);
  });

  // ── teardown ───────────────────────────────────────────────────────

  it('removes the scroll listener on unmount', () => {
    mockMatchMedia(false);
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(withMotion(<AboutSection />));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
