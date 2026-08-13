// frontend/src/providers/ThemeProvider.jsx
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  THEME_KEY,
  readAppliedTheme,
  writeTheme,
  applyTheme,
} from '../utils/theme';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Read what PF-71's head script already applied. A lazy initialiser
  // so the DOM read happens once, not on every render.
  const [theme, setThemeState] = useState(readAppliedTheme);

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

  // ── Reconcile on mount ────────────────────────────────────────
  // If the head script failed — storage threw, script blocked by a
  // strict CSP — the attribute may not match what's persisted.
  // Correct it once, quietly.
  useEffect(() => {
    const stored = (() => {
      try { return localStorage.getItem(THEME_KEY); } catch { return null; }
    })();

    if (stored && stored !== theme) {
      const applied = applyTheme(stored);
      setThemeState(applied);
    }
    // Intentionally mount-only.
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
