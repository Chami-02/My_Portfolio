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

  const [revealed, setRevealed] = useState(false);

  // Two cases skip the entrance entirely and start revealed: reduced
  // motion, and no IntersectionObserver (very old browsers, some test
  // envs) where nothing would ever fire and the content would stay
  // invisible. Derived during render rather than written by an effect —
  // a setState in an effect body paints the hidden state first.
  const immediate = reduced || typeof IntersectionObserver === 'undefined';

  useEffect(() => {
    if (immediate) return;

    const el = ref.current;
    if (!el) return;

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
  }, [immediate]);

  return (
    <Tag
      ref={ref}
      data-reveal={immediate || revealed ? 'in' : 'out'}
      data-type={type}
      className={`${styles.reveal} ${className}`}
      style={reduced ? undefined : { transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
