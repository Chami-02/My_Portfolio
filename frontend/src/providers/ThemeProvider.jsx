// frontend/src/providers/ThemeProvider.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  THEME_KEY,
  normalise,
  readAppliedTheme,
  writeTheme,
  applyTheme,
} from '../utils/theme';
import { ThemeContext } from './ThemeContext';

export function ThemeProvider({ children }) {
  // Resolve the initial theme once, in a lazy initialiser — the reads
  // happen on mount, not on every render.
  //
  // Normally PF-71's head script has already applied the persisted
  // theme and the page has painted with it, so the attribute is the
  // right source. But if that script failed — storage threw, a strict
  // CSP blocked it — the attribute is stale and storage is the truth.
  // Resolving both here rather than correcting later in an effect means
  // the first render is already right; a setState in an effect would
  // paint the wrong theme and then repaint.
  const [theme, setThemeState] = useState(() => {
    const stored = (() => {
      try { return localStorage.getItem(THEME_KEY); } catch { return null; }
    })();

    return stored ? normalise(stored) : readAppliedTheme();
  });

  /** Apply + persist. The path a user toggle takes. */
  const setTheme = useCallback((next) => {
    const applied = applyTheme(next);
    writeTheme(applied);
    setThemeState(applied);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  // ── Cross-tab sync ────────────────────────────────────────────
  // Applies WITHOUT persisting. Writing here would make each tab
  // trigger the other's handler in an infinite loop — the storage
  // event doesn't fire in the originating tab, but it does fire in
  // every other one, including the one that just echoed.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_KEY) return;
      const applied = applyTheme(e.newValue);
      setThemeState(applied);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Reconcile the DOM on mount ────────────────────────────────
  // State is already correct from the initialiser; the attribute may
  // not be, if the head script never ran. Push it out once. This is an
  // effect syncing React state to an external system (the DOM), which
  // is exactly what effects are for — no setState involved.
  useEffect(() => {
    applyTheme(theme);
    // Intentionally mount-only — later changes apply via setTheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    theme,
    isLight: theme === 'light',
    setTheme,
    toggle,
  }), [theme, setTheme, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
