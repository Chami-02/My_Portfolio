// frontend/src/utils/theme.js
//
// Theme reading, writing and application — PF-72.
//
// Deliberately React-free so it can be unit-tested directly and
// reused by the head script's logic if that ever needs to change.

export const THEME_KEY = 'pg-theme';
export const THEMES    = ['dark', 'light'];
export const DEFAULT_THEME = 'dark';

/** Anything that isn't a known theme becomes the default. */
export function normalise(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}

/**
 * Read the persisted theme.
 *
 * localStorage throws in Safari private mode and under some privacy
 * settings. Never let that break the app — fall back to the default.
 */
export function readTheme() {
  try {
    return normalise(localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persist. Silently no-ops if storage is unavailable. */
export function writeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, normalise(theme));
  } catch {
    // Storage blocked — the theme still applies for this session.
  }
}

/**
 * Read what PF-71's head script already applied to <html>.
 *
 * This is the correct source for initial state: the guard has run,
 * the attribute is set, and the page has already painted with it.
 * Re-deriving from localStorage would risk disagreeing with what
 * the user can already see.
 */
export function readAppliedTheme() {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return normalise(document.documentElement.getAttribute('data-theme'));
}

/**
 * Apply a theme to the document.
 *
 * ⚠️ Sets ONE attribute and nothing else. Never write --acc or any
 * other custom property inline on <html> — an inline value beats the
 * theme block in tokens.css and turns every future token edit into
 * dead code. See the note at the bottom of tokens.css.
 */
export function applyTheme(theme) {
  const next = normalise(theme);
  document.documentElement.setAttribute('data-theme', next);
  return next;
}

/** Label for the toggle — names the mode you would switch TO. */
export function toggleLabel(theme) {
  return theme === 'light' ? 'Dark' : 'Light';
}

/**
 * The toggle's own visible caption, verbatim from the prototype's
 * themeLabel (line 1113): `theme === 'light' ? 'DARK MODE' : 'LIGHT MODE'`.
 *
 * Separate from toggleLabel() because the two feed different places.
 * This one is rendered text and must match the design exactly;
 * toggleLabel() composes into the aria-label ("Switch to Light
 * theme"), where shouting reads badly and "MODE" is redundant.
 */
export function themeModeLabel(theme) {
  return `${toggleLabel(theme).toUpperCase()} MODE`;
}
