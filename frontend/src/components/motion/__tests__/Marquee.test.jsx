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
    ['footer', '../../layout/Footer.jsx', 16],
    ['hero', '../../sections/HeroSection.jsx', 6],
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
   * ⚠️ The two bands must also agree on DURATION, since 2026-08-25 —
   * "reduce the speed … exactly like the above one", then "reduce the
   * speed of the text" for both. The prototype runs the footer at 15s
   * and the hero at 26s; the footer was matched to 26 and then both
   * were slowed to 40.
   *
   * Guarded by comparing the two call sites to each other rather than
   * to a frozen number, so re-tuning the hero fails this until the
   * footer follows. Reverting the footer to 15 is otherwise silent in
   * every unit test — found by mutation, not by reading.
   */
  it('footer and hero run their bands at the same speed', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const here = dirname(fileURLToPath(import.meta.url));
    const read = (rel) =>
      readFileSync(resolve(here, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    const durationOf = (src) => {
      const m = /<Marquee[^>]*\sduration=\{(\d+)\}/.exec(src);
      expect(m, 'no <Marquee duration={n}> found').not.toBeNull();
      return Number(m[1]);
    };

    const footer = durationOf(read('../../layout/Footer.jsx'));
    const hero = durationOf(read('../../sections/HeroSection.jsx'));

    expect(footer).toBe(hero);
    expect(footer).toBe(40);
    expect(footer).not.toBe(15);   // the prototype's footer value
    expect(footer).not.toBe(26);   // the prototype's hero value
  });

});
