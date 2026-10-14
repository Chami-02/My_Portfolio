// frontend/src/hooks/useFormGuard.js
//
// The refuse-shake-and-mark behaviour, once, for every admin panel.
//
// ── THE STANDING RULE THIS IMPLEMENTS (owner, 2026-09-25) ───────────────────
// "when miss something if i try to save the save button should shake and say
//  check the changes again and pop up the text feild or somthing around the
//  missing field saying fill the missing values… this is a common rule for all
//  other sections as well in admin panel"
//
// Four parts, and all four are required for the behaviour to make sense:
//
//   1. SAVE stays PRESSABLE while the form is dirty — never disabled BECAUSE
//      something is invalid. A button that will not light up cannot explain
//      why, which is the exact confusion this replaces.
//   2. An invalid save is refused and NO REQUEST IS SENT.
//   3. A banner names the scale.
//   4. Every offending field is marked in place, and the FIRST one is focused
//      and scrolled to.
//
// ⚠️ Point 1 does NOT reopen the locked "SAVE is dim until the form is dirty"
// decision. Dirty still gates the button; validity does not.
//
// Used by AdminAboutPanel and AdminBlogPanel. PF-113/114/115 inherit it.

import { useCallback, useState } from 'react';
import { errorFor, fieldId } from '../utils/formErrors';

/**
 * @param validate  (form) => [{ field, message }]   — a panel's own validator
 * @param prefix    the id namespace its inputs use, e.g. 'about'
 */
export function useFormGuard(validate, prefix) {
  const [errors, setErrors] = useState([]);
  const [shaking, setShaking] = useState(false);

  // ⚠️ THIS COUNTER IS WHAT MAKES A SECOND FAILED PRESS SHAKE AGAIN.
  // `setShaking(true)` when `shaking` is already true is a no-op React bails
  // out of, so the class never leaves the DOM and the animation never restarts
  // — the button refuses visibly the first time and sits perfectly still every
  // time after, which reads as the button having stopped working. Bumping a
  // key forces React to swap the element's identity, and a remount restarts
  // the animation from 0%.
  //
  // ⚠️ STATE, NOT A REF, and that is not a style choice. A `useRef` read during
  // render — which is exactly what handing `.current` back to the caller does —
  // fails `react-hooks`'s "Cannot access refs during render" rule at
  // --max-warnings=0, and the rule is right: a value read during render has to
  // be one React can see change, or a concurrent re-render can paint a stale
  // key and skip the remount. Both updates below land in one batch.
  const [shakeKey, setShakeKey] = useState(0);

  /**
   * Run the validator. Returns true when the caller may proceed.
   *
   * ⚠️ Returns a BOOLEAN and does not throw. A guard that threw would need a
   * try/catch around it in every handler, and the one place someone forgets is
   * a save that silently goes through invalid.
   */
  const check = useCallback((form) => {
    const problems = validate(form) || [];
    setErrors(problems);

    if (problems.length === 0) return true;

    setShakeKey((k) => k + 1);
    setShaking(true);

    // ⚠️ Deferred a frame. The offending input may not carry `aria-invalid`
    // yet — `setErrors` above has not painted — and more importantly the
    // element may be inside a section that is only rendered once the error
    // exists. Focusing before that paint finds nothing and silently does
    // nothing, which looks exactly like "the first field was already focused".
    requestAnimationFrame(() => {
      const target = document.getElementById(fieldId(prefix, problems[0].field));
      if (!target) return;
      // `preventScroll` then an explicit scrollIntoView: focus()'s own scroll
      // jumps the field to the very top, under the sticky admin header, where
      // the header covers it. 'center' keeps it visible with its label.
      target.focus({ preventScroll: true });

      // ⚠️ OPTIONAL-CALLED, and not as defensive padding. jsdom implements no
      // `scrollIntoView` at all, so a bare call THROWS — inside a
      // requestAnimationFrame callback, where nothing catches it and the
      // failure surfaces as an unhandled error rather than as a failed
      // assertion. Focus had already moved by then, so every test asserting
      // focus still passed while an exception was being thrown on every run.
      // Anything added after this line would simply not have run.
      target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    });

    return false;
  }, [validate, prefix]);

  /**
   * Drop one field's error as soon as the owner edits it.
   *
   * ⚠️ Per FIELD, never the whole list. Clearing everything on the first
   * keystroke would wipe the marks off the other four invalid fields while
   * they are still invalid, and the banner's count would disagree with what is
   * on screen.
   *
   * ⚠️ And it clears rather than RE-VALIDATES. Re-running the validator on
   * every keystroke marks a field invalid halfway through typing a URL, which
   * is the behaviour everyone hates. The full check runs again on the next
   * SAVE, which is the moment it matters.
   */
  const clearField = useCallback((field) => {
    setErrors((prev) => {
      if (!prev.some((e) => e.field === field)) return prev;   // no needless render
      return prev.filter((e) => e.field !== field);
    });
  }, []);

  const reset = useCallback(() => setErrors([]), []);

  return {
    errors,
    errorFor: (field) => errorFor(errors, field),
    check,
    clearField,
    reset,
    shaking,
    shakeKey,
    // ⚠️ The class comes off on animationend, NOT on a timer. motion.css
    // collapses every animation to 0.01ms under reduced motion, and because
    // that is near-zero rather than `none` the event still fires — so this
    // works in both modes, where a hardcoded 400ms timeout would leave the
    // class on for 400ms of nothing.
    onShakeEnd: () => setShaking(false),
  };
}
