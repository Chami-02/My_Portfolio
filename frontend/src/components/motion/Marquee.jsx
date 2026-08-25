// frontend/src/components/motion/Marquee.jsx
import { useReducedMotion } from '../../hooks/useReducedMotion';
import styles from './Marquee.module.css';

/**
 * Infinite scrolling strip — PF-74.
 *
 * @param {number}  duration  seconds for one full cycle
 * @param {boolean} reverse   scroll right-to-left instead
 * @param {number}  copies    how many times to repeat `children`
 *
 * ⚠️ `copies` MUST BE EVEN, AND BIG ENOUGH. Both halves of that are
 * arithmetic, not taste, and getting either wrong is silent — the strip
 * still scrolls, it just has a hole in it.
 *
 * `marq` translates the track from 0 to **-50%** of its own width, so
 * one cycle moves it by exactly HALF the copies. Two consequences:
 *
 *   1. EVEN. With an even count the second half lands precisely where
 *      the first half started and the wrap is invisible. An odd count
 *      lands mid-copy and the text visibly jumps once per cycle.
 *   2. HALF THE TRACK MUST COVER THE BAND. At the end of a cycle the
 *      track has slid left by `copies/2 × copyWidth`, so anything past
 *      that point is empty band. The requirement is therefore
 *
 *          copies ≥ 2 × bandWidth / copyWidth
 *
 *      — NOT `copyWidth ≥ bandWidth`, which is the intuitive reading and
 *      is off by a factor of two.
 *
 * ⚠️ THE PROTOTYPE'S TWO COPIES IS NOT ENOUGH ON EITHER BAND. Measured
 * in Chromium on the production build at 1440px:
 *
 *   footer  band 1440 · one copy  600px → needs 4.80 → 840px of empty
 *                                          band at the wrap
 *   hero    band 1484 · one copy 1297px → needs 2.29 → 187px
 *
 * The prototype has exactly two `<span>`s in each strip (lines 546-547
 * and 188-189 of Portfolio Revolution.dc.html), so this is not a
 * transcription slip — the export renders the same hole. Raised with the
 * owner and fixed on both bands, 2026-08-24. `copies` is the mechanism;
 * the design value is a continuously filled band.
 *
 * ⚠️ AND NO SINGLE COUNT IS CORRECT AT EVERY WIDTH — same shape as the
 * measured placeholder heights in Projects and Blog. `copyWidth` is
 * clamped, so it stops growing while the band keeps going, and the
 * requirement rises with the viewport. The counts in use are sized past
 * any realistic window and the coverage is stated rather than implied:
 *
 *   caller  copies  copyWidth  covers a band up to
 *   footer    12       600px    3600px
 *   hero       6      1297px    3891px
 *
 * Beyond that the hole comes back. Raise the count, don't reason about
 * it — `copies/2 × copyWidth` is the number.
 *
 * Default 2, so any caller that does not pass it is byte-identical to
 * the pre-PF-88 component.
 */
export default function Marquee({
  children,
  duration = 15,
  reverse = false,
  copies = 2,
  className = '',
  ...rest
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className={`${styles.marquee} ${className}`}
      // Decorative — the content is repeated and carries no
      // information a screen reader should announce twice.
      aria-hidden="true"
      {...rest}
    >
      <div
        className={styles.track}
        style={reduced ? undefined : {
          animationDuration:  `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {/* The -50% translate requires an EVEN number of copies, and
            enough of them to fill the container. See the note above. */}
        {Array.from({ length: copies }, (_, i) => (
          <div key={i} className={styles.group}>{children}</div>
        ))}
      </div>
    </div>
  );
}
