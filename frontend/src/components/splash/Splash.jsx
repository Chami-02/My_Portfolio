// frontend/src/components/splash/Splash.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSplashControls } from '../../hooks/useSplashControls';
import logo from '../../assets/logo.png';
import styles from './Splash.module.css';

const BOOT_LINES = [
  { text: '$ booting portfolio…', className: styles.bootLine },
  { text: '✓ assets loaded · galaxy seeded', className: styles.bootLineGreen },
  { text: '✓ animations armed', className: styles.bootLineGreen },
  { text: "● welcome — let's build something loud", className: styles.bootLineAccent },
];

/**
 * Splash screen — PF-78.
 *
 * Transcribed from the prototype's runSplash()/finishSplash() (lines
 * 924-947). Every timing below is read straight from there:
 *
 *   560 + i*820 ms   each boot line reveals  (560, 1380, 2200, 3020)
 *   220 ms           first progress tick, then every 140 ms while < 100
 *   4600 ms          finish — a fixed timer, NOT the bar reaching 100%
 *   +320 ms          reveals arm (startReveals(320) — a real delay, the
 *                    reveals begin partway through the 1s exit
 *                    transform, not at its start)
 *   +1150 ms         splash leaves the DOM
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
   * Prototype: finishSplash(). Reachable two ways — the 4600ms timer and
   * the SKIP button — so it is guarded. Without finishedRef, a SKIP
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
        after(560 + i * 820, () => {
          line.style.opacity = '1';
          line.style.transform = 'none';
        }),
      );
    }

    /* Prototype: runSplash()'s progress tick. The increment is random,
       so the bar hits 100% at a different moment on every load —
       typically around 2.5-3s, always before the 4600ms finish. It is
       decoration, not a real measure of anything, and the exit does not
       wait for it. */
    let pct = 0;
    const tick = () => {
      pct = Math.min(100, pct + Math.random() * 6 + 2.2);
      if (barRef.current) barRef.current.style.width = `${pct}%`;
      if (pctRef.current) {
        pctRef.current.textContent = `${String(Math.round(pct)).padStart(3, '0')}%`;
      }
      if (pct < 100) after(140, tick);
    };
    after(220, tick);

    after(4600, finish);

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

      <div aria-hidden="true" className={styles.scanlineLayer}>
        <div className={styles.scanline1} />
        <div className={styles.scanline2} />
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
          <img src={logo} alt="Parindra Gallage" className={styles.logoImg} />
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
          <span ref={pctRef}>000%</span>
        </div>
      </div>

      <button type="button" className={styles.skip} onClick={finish}>
        SKIP INTRO →
      </button>
    </div>
  );
}
