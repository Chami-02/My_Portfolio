// frontend/src/components/motion/CountUp.jsx
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const DURATION = 1300;

/** Ease-out cubic. Linear count-ups look mechanical. */
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Animated numeral — PF-74.
 *
 * @param {number} to        target value
 * @param {string} suffix    appended after the number, e.g. '+'
 * @param {number} decimals  fixed decimal places
 */
export default function CountUp({
  to,
  suffix = '',
  decimals = 0,
  className = '',
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    // Reduced motion → show the final value, run nothing.
    if (reduced) { setValue(to); return; }

    const el = ref.current;
    if (!el) return;

    let frameId = null;
    let startedAt = null;
    let cancelled = false;

    const step = (now) => {
      if (cancelled) return;
      if (startedAt === null) startedAt = now;

      const progress = Math.min((now - startedAt) / DURATION, 1);
      setValue(to * easeOut(progress));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setValue(to);            // land exactly on target
      }
    };

    const start = () => {
      observer.disconnect();
      frameId = requestAnimationFrame(step);
    };

    if (typeof IntersectionObserver === 'undefined') {
      setValue(to);
      return;
    }

    // Same shared observer config the prototype uses for both
    // data-reveal and data-count elements (startReveals()).
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) start(); },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [to, reduced]);

  return (
    <span ref={ref} className={className} {...rest}>
      {value.toFixed(decimals)}{suffix}
    </span>
  );
}
