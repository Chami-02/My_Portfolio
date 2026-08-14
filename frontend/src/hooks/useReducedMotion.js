// frontend/src/hooks/useReducedMotion.js
import { useContext } from 'react';
import { MotionContext } from '../providers/MotionContext';

/**
 * Returns true when the user has asked for reduced motion.
 *
 * Gate JS-driven animation on this — rAF loops, canvas rendering,
 * count-ups, parallax, scroll handlers. CSS animation is handled
 * separately by motion.css; this hook exists because CSS cannot
 * stop a requestAnimationFrame loop.
 */
export function useReducedMotion() {
  const ctx = useContext(MotionContext);

  if (!ctx) {
    throw new Error('useReducedMotion must be used within a MotionProvider');
  }

  return ctx.reduced;
}
