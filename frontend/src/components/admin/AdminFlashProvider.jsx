// frontend/src/components/admin/AdminFlashProvider.jsx
import { useCallback, useMemo, useState } from 'react';
import { AdminFlashContext } from './AdminFlashContext';

/**
 * PF-107. Holds the one flash message the admin shell renders.
 *
 * This file exports a COMPONENT AND NOTHING ELSE — see
 * AdminFlashContext.js for why that matters to CI.
 *
 * The message is deliberately not auto-dismissed on a timer. The
 * inline "✓ Saved successfully" this replaces cleared itself after
 * 3 seconds, which meant a save you looked away from left no trace
 * that it had happened. The banner carries its own dismiss control
 * instead, and any new message replaces the previous one.
 */
export function AdminFlashProvider({ children }) {
  const [flash, setFlash] = useState(null);

  const showFlash    = useCallback((message) => setFlash(message || null), []);
  const dismissFlash = useCallback(() => setFlash(null), []);

  // Memoised so every consumer does not re-render whenever the shell
  // does. `flash` is the only value that actually changes.
  const value = useMemo(
    () => ({ flash, showFlash, dismissFlash }),
    [flash, showFlash, dismissFlash],
  );

  return (
    <AdminFlashContext.Provider value={value}>
      {children}
    </AdminFlashContext.Provider>
  );
}
