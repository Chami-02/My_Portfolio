// frontend/src/providers/MotionProvider.jsx
import { createContext, useEffect, useMemo, useState } from 'react';
import {
  prefersReducedMotion,
  applyMotionPreference,
  subscribeToMotionPreference,
} from '../utils/motion';

export const MotionContext = createContext(null);

export function MotionProvider({ children }) {
  // Lazy initialiser — the matchMedia read happens once, not on
  // every render.
  const [reduced, setReduced] = useState(prefersReducedMotion);

  // Apply on mount and whenever the preference changes.
  useEffect(() => {
    applyMotionPreference(reduced);
  }, [reduced]);

  // The user can change this in OS settings with the page open.
  useEffect(() => {
    return subscribeToMotionPreference(setReduced);
  }, []);

  const value = useMemo(() => ({ reduced }), [reduced]);

  return (
    <MotionContext.Provider value={value}>
      {children}
    </MotionContext.Provider>
  );
}
