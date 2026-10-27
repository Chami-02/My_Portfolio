// frontend/src/hooks/usePasswordStrength.js
import { useEffect, useMemo, useState } from 'react';
import { loadStrengthChecker } from '../utils/passwordStrength';

/**
 * PF-124 follow-up — the live strength of a NEW password, for the meter and
 * the form's own check.
 *
 * Returns null while there is nothing to judge (empty, or zxcvbn still
 * loading — a few hundred ms on the first keystroke), else
 * `{ score: 0–4, problem: string | null }`. A form must treat null as "not
 * known yet" and let the server decide, never as "fine".
 *
 * The checker loads the first time the field has text; the result is DERIVED
 * in render, so nothing here calls setState in an effect body.
 */
export function usePasswordStrength(password, words) {
  const [check, setCheck] = useState(null);
  const wanted = password.length > 0;

  useEffect(() => {
    if (!wanted || check) return undefined;
    let live = true;
    loadStrengthChecker().then((fn) => { if (live) setCheck(() => fn); });
    return () => { live = false; };
  }, [wanted, check]);

  // `words` arrives as a fresh array every render; key the memo on its text.
  const key = words.join(' ');
  return useMemo(
    () => (check && password ? check(password, key ? key.split(' ') : []) : null),
    [check, password, key],
  );
}
