// frontend/src/components/ambient/StarfieldCanvas.jsx
import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSplashReady } from '../../hooks/useSplashReady';
import styles from './StarfieldCanvas.module.css';

/**
 * Star-to-star cursor web tuning — the ONLY deliberate visual departure
 * from the prototype in this file, requested directly by the user on
 * 2026-08-16: the web read as too prominent on the real site.
 *
 * Prototype values are 150px and 0.14 (lines 826 and 828). Both are
 * lowered here, and they compound: a shorter link distance draws fewer
 * lines, and every line that survives is also fainter, since alpha
 * falls off across the shorter span. Do NOT "restore" these to match
 * the prototype — the mismatch is intentional, not a transcription
 * slip. Named rather than inlined so the next adjustment is one edit.
 *
 * The cursor's own accent-coloured spray (cursor → star) is untouched
 * at 0.3 — it is a separate line family, and the request was about the
 * web specifically.
 */
const WEB_LINK_PX = 130; // prototype: 150
const WEB_ALPHA = 0.1; // prototype: 0.14

/**
 * Star field + cursor web — PF-76.
 *
 * Transcribed from initGalaxy() in the prototype (lines 733-840), with
 * four deliberate departures. None are visual changes — all are either
 * project-wide requirements the prototype has no equivalent for, or the
 * one confirmed prototype bug:
 *
 *   1. accColorRef.current, not the prototype's undeclared `acc` — line
 *      834 reads an identifier that is never declared, throwing a
 *      ReferenceError every frame the cursor is near a star. Its two
 *      siblings (806, 816) already use self.accColor correctly.
 *   2. Gates on useReducedMotion() and useSplashReady() — neither
 *      exists in the prototype; both are this project's own rules. CSS
 *      cannot stop a requestAnimationFrame loop, and animating under a
 *      full-screen splash spends its whole runtime on nobody.
 *   3. Pauses on document visibilitychange — confirmed absent from the
 *      prototype, a pure battery/CPU saving with no visual effect.
 *   4. Reads theme through a ref updated by a small separate effect,
 *      not by putting `isLight` in the draw loop's dependency array.
 *      That would tear the effect down and call build() again on every
 *      toggle, regenerating all 620 stars at fresh random positions —
 *      a visible reset the prototype never does, since themeLight and
 *      accColor are plain instance properties read fresh each frame.
 */
export default function StarfieldCanvas({ ref: externalRef }) {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();
  const splashReady = useSplashReady();
  const { isLight } = useTheme();

  // Live theme state the draw loop reads without being torn down and
  // rebuilt on every toggle. See departure 4 above.
  const themeRef = useRef(isLight);
  const accColorRef = useRef('#FCA311');

  // Set by the reduced-motion branch only. Under full motion, frame()
  // calls pal() itself every frame and needs no help picking up a
  // theme change.
  const repaintStaticRef = useRef(null);

  // Declared before the draw effect deliberately: effects run in
  // declaration order, so accColorRef is populated before the first
  // paint rather than one frame behind it.
  useEffect(() => {
    themeRef.current = isLight;
    accColorRef.current =
      getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() ||
      '#FCA311';

    // A static frame has no loop to pick the new palette up on, and
    // --acc plus the star colour both flip with the theme. Without
    // this, a reduced-motion user who toggles to light keeps the dark
    // theme's near-white stars on a light background — an invisible
    // star field, silently, until something triggers a resize.
    // Null on mount (the draw effect has not run yet, and does its own
    // first paint) and under full motion.
    repaintStaticRef.current?.();
  }, [isLight]);

  // Merges PF-75's external ref contract with the internal ref this
  // effect needs direct access to. Nothing currently passes a ref from
  // outside — this exists so PF-75's forwarding test keeps its meaning.
  const setRef = useCallback(
    (node) => {
      canvasRef.current = node;
      if (typeof externalRef === 'function') externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars = [];
    const mouse = { x: -9999, y: -9999 };
    let rafId = null;

    /** Prototype: build(), inside initGalaxy(). */
    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // setTransform, not scale() — it replaces the matrix outright, so
      // repeated resizes cannot compound a scale factor.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(620, Math.round((w * h) / 2600));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.15 + 0.45,
        a: Math.random() * 0.5 + 0.5,
        t: Math.random() * Math.PI * 2,
        ts: Math.random() * 0.9 + 0.25,
        // Pixels per frame, not per second — the prototype does not
        // delta-time-normalise this, and behaviour transcribes as
        // faithfully as values do.
        vx: (Math.random() - 0.5) * 0.09,
        vy: (Math.random() - 0.5) * 0.09,
        warm: Math.random() < 0.16,
      }));
    };

    /** Prototype: const pal = () => self.themeLight ? {...} : {...}. */
    const pal = () =>
      themeRef.current
        ? { star: 'rgba(20,33,61,1)', web: 'rgba(20,33,61,1)', neb: '20,33,61', nebA: 0.16 }
        : { star: 'rgba(226,235,255,1)', web: 'rgba(226,235,255,1)', neb: '20,33,61', nebA: 1 };

    const NEB = [
      { x: 0.78, y: 0.18, r: 0.55, a: 0.55 },
      { x: 0.16, y: 0.62, r: 0.45, a: 0.4 },
    ];

    build();

    if (reduced) {
      // One resting-state paint: stars at their initial positions and
      // resting alpha, nebula in its base non-drifting position, no
      // cursor web, no cursor dot. No prototype precedent exists here —
      // "design fidelity is absolute" reads more naturally as "keep the
      // star field, remove the motion" than "remove the whole layer".
      const paintStatic = () => {
        ctx.clearRect(0, 0, w, h);
        const P = pal();
        NEB.forEach((n) => {
          const R = Math.max(w, h) * n.r;
          const g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, R);
          g.addColorStop(0, `rgba(${P.neb},${(n.a * P.nebA).toFixed(3)})`);
          g.addColorStop(1, 'rgba(20,33,61,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        });
        for (const s of stars) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = s.warm ? accColorRef.current : P.star;
          ctx.globalAlpha = s.a;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };

      paintStatic();
      repaintStaticRef.current = paintStatic;

      const onResize = () => {
        build();
        paintStatic();
      };
      window.addEventListener('resize', onResize);
      return () => {
        // Cleared before the animated branch's setup runs — React
        // flushes every effect's cleanup in a commit before any
        // effect's new setup runs, so there is no window where a later
        // theme toggle could reach this closure after this effect run
        // has torn down. Confirmed by mutation test, not just this
        // comment: removing this line makes exactly one test fail, the
        // stale-frame one in StarfieldCanvas.test.jsx.
        repaintStaticRef.current = null;
        window.removeEventListener('resize', onResize);
      };
    }

    // Waits for the splash — no correctness reason, since nothing under
    // it is visible either way, but no reason to animate ~1.2s of every
    // fresh load for nobody. splashReady is a dep, so this whole effect
    // re-runs once it flips.
    if (!splashReady) return undefined;

    /** Prototype: frame(now), the requestAnimationFrame body. */
    const frame = (now) => {
      // Re-arm first, exactly as the prototype does. This is the only
      // reason its `acc` ReferenceError never stopped the animation.
      rafId = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, w, h);
      const P = pal();

      // Drifting nebula clouds — genuinely time-based, unlike the stars.
      NEB.forEach((n, i) => {
        const dx = Math.sin(now / (26000 + i * 9000)) * 40;
        const dy = Math.cos(now / (31000 + i * 7000)) * 30;
        const R = Math.max(w, h) * n.r;
        const g = ctx.createRadialGradient(
          n.x * w + dx, n.y * h + dy, 0,
          n.x * w + dx, n.y * h + dy, R,
        );
        g.addColorStop(0, `rgba(${P.neb},${(n.a * P.nebA).toFixed(3)})`);
        g.addColorStop(1, 'rgba(20,33,61,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      const R = 210;
      const R2 = R * R;
      const near = [];
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        s.t += 0.02 * s.ts;
        if (s.x < -10) s.x = w + 10;
        if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        if (s.y > h + 10) s.y = -10;

        // Compared as d² < R² — no sqrt in the hot path.
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        const close = d2 < R2;
        if (close) near.push(s);

        const tw = 0.55 + 0.45 * Math.sin(s.t);
        const alpha = Math.min(1, s.a * tw + (close ? 0.22 * (1 - Math.sqrt(d2) / R) : 0));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (close ? 1.25 : 1), 0, Math.PI * 2);
        ctx.fillStyle = s.warm ? accColorRef.current : P.star;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }

      // Spider web: cursor -> nearby stars, then star -> star.
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.65;
      for (const s of near) {
        const d = Math.hypot(s.x - mouse.x, s.y - mouse.y);
        ctx.strokeStyle = accColorRef.current;
        ctx.globalAlpha = 0.3 * (1 - d / R);
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.lineWidth = 0.7;
      // Capped at 80 nodes: this loop is O(n²), and 80 is the lever to
      // lower first if a real device misses frame budget — the 2600
      // star-density divisor is the fallback, not the first move.
      const web = near.length > 80 ? near.slice(0, 80) : near;
      for (let i = 0; i < web.length; i++) {
        for (let j = i + 1; j < web.length; j++) {
          const a = web[i];
          const b = web[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > WEB_LINK_PX) continue;
          ctx.strokeStyle = P.web;
          ctx.globalAlpha = WEB_ALPHA * (1 - d / WEB_LINK_PX);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      if (near.length) {
        ctx.globalAlpha = 0.3;
        // Prototype line 834 reads an undeclared `acc` here. See the
        // header comment — this is the corrected form.
        ctx.fillStyle = accColorRef.current;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const onResize = () => build();
    const onPointerMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onPointerLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    // Not in the prototype (confirmed absent). 620 stars, 2 gradients
    // and up to 3,160 pairwise web checks per frame is real, continuous
    // cost — a hidden tab should not keep paying it.
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (!rafId) {
        rafId = requestAnimationFrame(frame);
      }
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    rafId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reduced, splashReady]);

  return <canvas ref={setRef} aria-hidden="true" className={styles.canvas} />;
}
