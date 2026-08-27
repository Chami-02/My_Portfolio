import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Marquee from '../Marquee';
import { MotionProvider } from '../../../providers/MotionProvider';

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches, addEventListener: () => {}, removeEventListener: () => {},
  })));
}

const withMotion = (ui) => render(<MotionProvider>{ui}</MotionProvider>);

describe('Marquee (PF-74)', () => {

  afterEach(() => { vi.unstubAllGlobals(); });

  // The marq keyframe translates -50%, which assumes two copies.
  // One copy and the strip visibly jumps every cycle.
  it('renders its content twice', () => {
    mockMatchMedia(false);
    withMotion(<Marquee>REPEATED</Marquee>);

    expect(screen.getAllByText('REPEATED')).toHaveLength(2);
  });

  it('is hidden from assistive technology', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee>x</Marquee>);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the duration', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee duration={20}>x</Marquee>);

    const track = container.firstChild.firstChild;
    expect(track.style.animationDuration).toBe('20s');
  });

  it('reverses direction when asked', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee reverse>x</Marquee>);

    const track = container.firstChild.firstChild;
    expect(track.style.animationDirection).toBe('reverse');
  });

  it('applies no inline animation under reduced motion', () => {
    mockMatchMedia(true);
    const { container } = withMotion(<Marquee duration={20}>x</Marquee>);

    const track = container.firstChild.firstChild;
    expect(track.style.animationDuration).toBe('');
  });


  /* ── copies — PF-88 ──────────────────────────────────────────────── */

  it('defaults to two copies, so pre-PF-88 callers are unchanged', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee>x</Marquee>);
    expect(container.firstChild.firstChild.children).toHaveLength(2);
  });

  it('repeats the children as many times as asked', () => {
    mockMatchMedia(false);
    const { container } = withMotion(<Marquee copies={4}>x</Marquee>);
    const track = container.firstChild.firstChild;
    expect(track.children).toHaveLength(4);
    expect([...track.children].map((g) => g.textContent)).toEqual(['x', 'x', 'x', 'x']);
  });

  /**
   * ⚠️ Both callers pass an EVEN count, and that is not a style choice.
   *
   * `marq` translates the track from 0 to -50% of its own width, so one
   * cycle moves it by exactly half the copies. With an even count the
   * second half lands precisely where the first half started and the
   * loop is invisible; with an odd count it lands mid-copy and the text
   * jumps at the wrap. jsdom cannot observe the jump, so the count
   * itself is what gets pinned.
   *
   * The second half of the fix is the SIZE, and the intuitive version
   * of it is wrong by a factor of two: because a cycle slides the track
   * by only half its width, the requirement is
   * `copies >= 2 * band / copy`, not `copy >= band`. Measured in
   * Chromium at 1440px — the footer's copy is 600px against a 1440px
   * band (needs 4.8) and the hero's is 1297px against 1484px (needs
   * 2.29). Neither measurement is reproducible in jsdom, which is why
   * they live in Marquee.jsx's doc comment and only the counts are
   * pinned here.
   */
  it.each([
    ['footer', '../../layout/Footer.jsx', 18],
    ['hero', '../../sections/HeroSection.jsx', 8],
  ])('$0 passes an even copies count of $2', async (_name, rel, expected) => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), rel),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');   // both files discuss it in prose

    const m = /<Marquee[^>]*\scopies=\{(\d+)\}/.exec(src);
    expect(m, 'no <Marquee copies={n}> found').not.toBeNull();
    const copies = Number(m[1]);
    expect(copies).toBe(expected);
    expect(copies % 2).toBe(0);
  });

  /**
   * ⚠️ THE TWO BANDS DELIBERATELY NO LONGER SHARE A DURATION — and the
   * previous version of this test asserted that they did.
   *
   * Until 2026-08-27 both ran at 40s, which was correct while their copy
   * widths were close. The Option A slimming changed that: a smaller
   * font shrinks `copyW`, and seamlessness (`copies >= 2 * band / copy`)
   * then forced different copy counts — hero 6 -> 8, footer 16 -> 18. But
   * distance per cycle is `copies/2 * copyW`, so at ONE duration the two
   * bands would have run at 105 and 88 px/s: visibly different speeds.
   *
   * The owner set both to **70 px/s at 1440**, which needs:
   *
   *     footer  9 * 392.9  = 3536.4px / 50.5s = 70.02 px/s
   *     hero    4 * 1050.6 = 4202.2px / 60s   = 70.04 px/s
   *
   * So EQUAL SPEED is the contract and equal duration is now the bug.
   * jsdom can measure neither `copyW` nor px/s, so what is pinned here
   * is each call site's number plus the arithmetic that ties them —
   * reverting either band to 40 fails this, as does quietly making them
   * equal again.
   */
  it('each band runs at its own duration, matched on px/s not on time', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const here = dirname(fileURLToPath(import.meta.url));
    const read = (rel) =>
      readFileSync(resolve(here, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    const durationOf = (src) => {
      // [\d.]+ — the footer's is 50.5, not an integer.
      const m = /<Marquee[^>]*\sduration=\{([\d.]+)\}/.exec(src);
      expect(m, 'no <Marquee duration={n}> found').not.toBeNull();
      return Number(m[1]);
    };

    const footer = durationOf(read('../../layout/Footer.jsx'));
    const hero = durationOf(read('../../sections/HeroSection.jsx'));

    expect(footer).toBe(50.5);
    expect(hero).toBe(60);
    expect(footer).not.toBe(hero);   // equal duration = unequal speed
    expect(footer).not.toBe(40);     // both bands' pre-2026-08-27 value
    expect(hero).not.toBe(40);
    expect(footer).not.toBe(15);     // the prototype's footer value
    expect(hero).not.toBe(26);       // the prototype's hero value

    // The measured copy widths that make those two numbers one speed.
    const SPEED = 70;                       // px/s at 1440, owner-set
    const footerPxS = (18 / 2 * 392.9) / footer;
    const heroPxS = (8 / 2 * 1050.6) / hero;
    expect(footerPxS).toBeCloseTo(SPEED, 0);
    expect(heroPxS).toBeCloseTo(SPEED, 0);
    expect(Math.abs(footerPxS - heroPxS)).toBeLessThan(1);
  });

});
