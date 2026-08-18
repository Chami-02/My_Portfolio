// frontend/src/components/splash/Splash.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSplashControls } from '../../hooks/useSplashControls';
import logo from '../../assets/logo.png';
import styles from './Splash.module.css';

const BOOT_LINES = [
  { text: '⚡ Booting portfolio…', className: styles.bootLine },
  { text: '✓ Assets loaded · galaxy seeded', className: styles.bootLineGreen },
  { text: '✓ Animations armed', className: styles.bootLineGreen },
  { text: "● Welcome — let's build something loud!", className: styles.bootLineAccent },
];

/* ── Sequence timing ──────────────────────────────────────────────────
 *
 * The prototype runs 4600ms with a progress bar whose increment is
 * random (`Math.random()*6 + 2.2` every 140ms). That bar finished around
 * 2.9s and then sat at 100% for another 1.7s before the splash left —
 * the visible gap the owner reported.
 *
 * Changed on 2026-08-17 at the owner's request: the whole sequence is
 * longer, and the bar is now derived from the exit time instead of
 * racing it. Both are sanctioned deviations from the prototype.
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Exit begins here — the one number that sets the sequence's length.
 * Prototype: 4600. Everything below is derived from this, so changing
 * it alone keeps the bar and the boot lines in step.
 */
const SPLASH_MS = 4500;

/** The prototype's own sequence length, the baseline the ratios use. */
const PROTOTYPE_SPLASH_MS = 4600;

const BAR_START_MS = 220;   // prototype's first tick
const BAR_TICK_MS = 140;    // prototype's cadence, kept
const BAR_TRANSITION_MS = 250; // .progressFill's own `transition: width .25s`

/**
 * Ticks needed to reach 100%.
 *
 * The last tick lands one transition-length before the exit, because
 * the bar's width is CSS-transitioned: writing `100%` at the exit
 * moment would leave the bar visibly still growing as the splash
 * slides away.
 * Backing off by BAR_TRANSITION_MS makes it *look* full exactly as the
 * exit starts, which is what "synced" means to the eye.
 *
 * Derived rather than hardcoded so changing SPLASH_MS alone keeps the
 * two in step — the desync this replaces came from two independently
 * chosen numbers.
 */
const BAR_TICKS = Math.ceil(
  (SPLASH_MS - BAR_START_MS - BAR_TRANSITION_MS) / BAR_TICK_MS,
);

/* Boot lines hold the prototype's PROPORTIONS rather than its absolute
   milliseconds — 560 and 820 out of 4600 — so the four reveals still
   span the sequence whatever SPLASH_MS is. Pinned to the prototype's
   absolute values instead, they finish early and leave the remainder
   reading as a stall; hand-scaled to one particular SPLASH_MS, they
   need re-scaling every time it moves, which is the same
   two-numbers-drifting-apart problem the progress bar had.

   At SPLASH_MS 4500 that gives 548, 1350, 2152, 2954. */
const BOOT_FIRST_MS = Math.round(SPLASH_MS * (560 / PROTOTYPE_SPLASH_MS));
const BOOT_STEP_MS = Math.round(SPLASH_MS * (820 / PROTOTYPE_SPLASH_MS));

/**
 * Splash screen — PF-78.
 *
 * Structure transcribed from the prototype's runSplash()/finishSplash()
 * (lines 924-947). The timings are the prototype's shape, re-scaled on
 * 2026-08-17 at the owner's request — see the constants above for the
 * before/after and why:
 *
 *   548 + i*802 ms   each boot line reveals  (548, 1350, 2152, 2954)
 *                    — derived from SPLASH_MS, not hardcoded
 *   220 ms           first progress tick, then every 140 ms while < 100
 *   4500 ms          finish — still a fixed timer, but the bar is now
 *                    derived from it rather than racing it
 *   +320 ms          reveals arm (startReveals(320) — a real delay, the
 *                    reveals begin partway through the 1s exit
 *                    transform, not at its start)
 *   +1150 ms         splash leaves the DOM
 *
 * The exit is still NOT triggered by the bar reaching 100%. The bar is
 * decoration; making the exit wait on it would hand the sequence's
 * length to a progress indicator that measures nothing.
 *
 * This component never calls setReady(false). By the time it mounts,
 * ready is already false: HomePage decided a splash was showing before
 * it rendered anything and passed initialReady={false} to
 * SplashProvider. Setting it false from an effect here would be a render
 * too late — see SplashProvider.jsx for the sequence that makes that a
 * real bug rather than a stylistic preference.
 *
 * The boot lines and progress bar are driven imperatively through refs,
 * same convention as StarfieldCanvas and CountUp: they are values
 * updating tens of times over four seconds, and routing each through
 * state would re-render the whole splash per tick for a number that only
 * ever lands in one text node and one width. The exit is state +
 * data-attribute instead, closer to Reveal's shape — it fires exactly
 * once. The two approaches differ because the two jobs differ.
 */
export default function Splash() {
  const { setReady } = useSplashControls();
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(true);

  const bootRef = useRef(null);
  const barRef = useRef(null);
  const pctRef = useRef(null);
  const timersRef = useRef([]);
  const finishedRef = useRef(false);

  /**
   * Prototype: finishSplash(). Reachable two ways — the SPLASH_MS timer
   * and the SKIP button — so it is guarded. Without finishedRef, a SKIP
   * click landing after the timer already fired would clear the pending
   * ready/unmount timers and schedule fresh ones, pushing both 320ms and
   * 1150ms further out: the reveals would arm late and the splash would
   * linger, with no error to explain either.
   *
   * setReady is a useState setter delivered through context, so it is
   * referentially stable and this callback never changes identity — the
   * effect below depends on it and still runs exactly once.
   */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    // Prototype clears splashTimers here: boot lines that have not
    // appeared yet never do, and the progress bar stops wherever it got
    // to. Both are intended on the SKIP path.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setExiting(true);

    timersRef.current.push(
      setTimeout(() => setReady(true), 320),
      setTimeout(() => setMounted(false), 1150),
    );
  }, [setReady]);

  useEffect(() => {
    const after = (ms, fn) => {
      const id = setTimeout(fn, ms);
      timersRef.current.push(id);
      return id;
    };

    /* Prototype: runSplash()'s boot-line loop. Walks the rendered
       children rather than holding a ref per line — same as the
       prototype's [...boot.children] — so adding a line to BOOT_LINES
       needs no change here. */
    const boot = bootRef.current;
    if (boot) {
      [...boot.children].forEach((line, i) =>
        after(BOOT_FIRST_MS + i * BOOT_STEP_MS, () => {
          line.style.opacity = '1';
          line.style.transform = 'none';
        }),
      );
    }

    /* Progress tick — same 140ms cadence as the prototype, but the
       amount is no longer random.

       Counting ticks rather than accumulating a random increment is
       what makes the bar land with the exit: tick n is n/BAR_TICKS of
       the way along, so the fill rate is a consequence of SPLASH_MS
       rather than a separate guess that happened to finish early. It
       also means no wall-clock read, so the sequence stays exact under
       fake timers.

       Still decoration, not a real measure of loading — nothing waits
       on it, and SKIP abandons it wherever it got to. */
    let ticks = 0;
    const tick = () => {
      ticks += 1;
      const pct = Math.min(100, (ticks / BAR_TICKS) * 100);
      if (barRef.current) barRef.current.style.width = `${pct}%`;
      if (pctRef.current) pctRef.current.textContent = `${Math.round(pct)}%`;
      if (pct < 100) after(BAR_TICK_MS, tick);
    };
    after(BAR_START_MS, tick);

    after(SPLASH_MS, finish);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [finish]);

  if (!mounted) return null;

  return (
    <div className={styles.splash} data-exiting={exiting || undefined}>
      <div aria-hidden="true" className={styles.bgGlow} />
      <div aria-hidden="true" className={styles.ringOuter} />
      <div aria-hidden="true" className={styles.ringMid} />
      <div aria-hidden="true" className={styles.ringInner} />

      {/* The prototype's two travelling scan lines are deliberately not
          here — removed at the owner's request, see the module. The
          static CRT hatch below is a different element and stays. */}
      <div aria-hidden="true" className={styles.scanlineLayer}>
        <div className={styles.scanTexture} />
      </div>

      <div className={styles.logoCluster}>
        <div className={styles.orbitStage}>
          <span aria-hidden="true" className={styles.orbitOuter}>
            <span className={styles.orbitOuterDotA} />
            <span className={styles.orbitOuterDotB} />
          </span>
          <span aria-hidden="true" className={styles.orbitInner}>
            <span className={styles.orbitInnerDot} />
          </span>
          <span aria-hidden="true" className={styles.spinRingA} />
          <span aria-hidden="true" className={styles.spinRingB} />
          <span aria-hidden="true" className={styles.pulseGlow} />
          {/* PF-83. The third element carrying alt="Parindra Gallage" —
              the ticket named only two (navbar logo, hero portrait), so
              this one was found by grepping alt= rather than from the
              brief. It gets the opposite answer to the hero portrait,
              on purpose: this is a brand mark whose own .nameBlock
              sibling below renders "Parindra Gallage" and "Full-Stack
              Developer" as real text, so a description here announces
              the name twice in a row inside one cluster. Empty alt, and
              the surrounding text carries the meaning. */}
          <img src={logo} alt="" className={styles.logoImg} />
        </div>

        <div className={styles.nameBlock}>
          <span className={styles.name}>
            Parindra <span className={styles.nameAccent}>Gallage</span>
          </span>
          <span className={styles.role}>Full-Stack Developer</span>
        </div>
      </div>

      <div ref={bootRef} className={styles.boot}>
        {BOOT_LINES.map((line) => (
          <div key={line.text} className={line.className}>
            {line.text}
          </div>
        ))}
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          <div ref={barRef} className={styles.progressFill} />
        </div>
        <div className={styles.progressLabels}>
          <span>LOADING</span>
          {/* Unpadded, at the owner's request: 2% / 50% / 100%, not the
              prototype's zero-filled 002% / 050% / 100%. */}
          <span ref={pctRef}>0%</span>
        </div>
      </div>

      <button type="button" className={styles.skip} onClick={finish}>
        SKIP INTRO →
      </button>
    </div>
  );
}
