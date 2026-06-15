import { useEffect, useRef, useState } from 'react';

const DEFAULT_OPTIONS = {};

/**
 * Returns a [ref, inView] tuple.
 * Attach ref to any element. inView becomes true once
 * the element enters the viewport and stays true forever.
 *
 * Usage:
 *   const [ref, inView] = useInView();
 *   <div ref={ref} className={`reveal ${inView ? 'revealed' : ''}`}>
 */
export function useInView(options = DEFAULT_OPTIONS) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(element); // Animate once, then stop watching
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -50px 0px', ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, inView];
}
