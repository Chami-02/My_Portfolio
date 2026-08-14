// frontend/src/components/motion/Reveal.jsx
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import styles from './Reveal.module.css';

/**
 * Scroll-triggered entrance wrapper — PF-74.
 *
 * @param {number} delay  stagger delay in ms
 * @param {'up'|'pop'|'rise'|'left'} type  entrance style, from the
 *   prototype's data-reveal attribute. 'up' is the default used by
 *   most content; 'pop' for badges/pills, 'rise' for the hero
 *   portrait, 'left' for the about photo.
 * @param {string} as     element to render, default 'div'
 */
export default function Reveal({
  children,
  delay = 0,
  type = 'up',
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  // Under reduced motion, start revealed. No transform, no delay.
  const [revealed, setRevealed] = useState(reduced);

  useEffect(() => {
    if (reduced) { setRevealed(true); return; }

    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (very old browsers, some test envs)
    // → reveal immediately rather than leaving content invisible.
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    let sweepId = null;

    const reveal = () => {
      setRevealed(true);
      observer.disconnect();
      if (sweepId) { clearInterval(sweepId); sweepId = null; }
    };

    // Matches the prototype's shared reveal/count-up observer exactly
    // (Portfolio Revolution.dc.html startReveals()).
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) reveal(); },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(el);

    // Safety sweep — catches an observer that never fires.
    // Clears itself the moment this element reveals, unlike the
    // prototype's version which runs for the life of the page.
    sweepId = setInterval(() => {
      if (!ref.current) return;
      const box = ref.current.getBoundingClientRect();
      const inView = box.top < window.innerHeight && box.bottom > 0;
      if (inView) reveal();
    }, 140);

    return () => {
      observer.disconnect();
      if (sweepId) clearInterval(sweepId);
    };
  }, [reduced]);

  return (
    <Tag
      ref={ref}
      data-reveal={revealed ? 'in' : 'out'}
      data-type={type}
      className={`${styles.reveal} ${className}`}
      style={reduced ? undefined : { transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
