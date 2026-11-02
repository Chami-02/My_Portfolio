import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSplashReady } from '../../hooks/useSplashReady';
import styles from './HeroSection.module.css';

/** The roles typed under the name, in order (owner, 2026-11-02 — the fifth, Problem Solver, the same day). */
const ROLES = [
  'Full-Stack Web Developer',
  'Cloud & DevOps Enthusiast',
  'Continuous Learner',
  'Tech Explorer',
  'Problem Solver',
];

// The prototype's own typeLoop() timings (Portfolio Revolution.dc.html:1092):
// type a letter every 85ms, hold a full role 2.6s, delete at 40ms a letter,
// start 600ms in.
export const TYPE_MS = 85;
export const HOLD_MS = 2600;
export const DELETE_MS = 40;
export const START_MS = 600;

/**
 * The hero's typing line — replaced the three role pills (owner, 2026-11-02).
 * Types one role, holds it, deletes it, types the next, forever.
 *
 * - Starts only when the splash is done (`useSplashReady`), like every Reveal.
 * - Under reduced motion nothing types: the first role stands still, no caret.
 * - A screen reader hears all the roles ONCE (the hidden list); the typed
 *   letters are `aria-hidden`, so it never reads a half-typed word.
 * - The line keeps its height and never wraps (CSS), so nothing below jumps.
 */
export function TypingRoles() {
  const reduced = useReducedMotion();
  const ready = useSplashReady();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (reduced || !ready) return undefined;
    let role = 0;
    let chars = 0;
    let deleting = false;
    let timer;
    const step = () => {
      const word = ROLES[role];
      if (!deleting) {
        chars += 1;
        setTyped(word.slice(0, chars));
        if (chars === word.length) { deleting = true; timer = setTimeout(step, HOLD_MS); return; }
        timer = setTimeout(step, TYPE_MS);
      } else {
        chars -= 1;
        setTyped(word.slice(0, chars));
        if (chars === 0) { deleting = false; role = (role + 1) % ROLES.length; }
        timer = setTimeout(step, DELETE_MS);
      }
    };
    timer = setTimeout(step, START_MS);
    return () => clearTimeout(timer);
  }, [reduced, ready]);

  return (
    <>
      <span className={styles.srOnly}>{ROLES.join(', ')}</span>
      <span aria-hidden="true" className={styles.typed}>
        {reduced ? ROLES[0] : typed}
        {!reduced && <span className={styles.typingCaret} />}
      </span>
    </>
  );
}
