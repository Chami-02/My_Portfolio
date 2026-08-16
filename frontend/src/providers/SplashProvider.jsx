// frontend/src/providers/SplashProvider.jsx
import { useMemo, useState } from 'react';
import { SplashContext } from './SplashContext';

/**
 * Splash-readiness provider — PF-75.
 *
 * Ships as a no-op: ready starts true, nothing calls setReady(false).
 * Every Reveal and CountUp fires exactly as it did before this ticket.
 *
 * PF-78 is what gives it teeth — the real splash calls setReady(false)
 * before its sequence starts and setReady(true) when it begins its exit
 * transform, closing the gap that let above-the-fold reveals fire while
 * still hidden behind the overlay.
 */
export function SplashProvider({ children }) {
  const [ready, setReady] = useState(true);
  const value = useMemo(() => ({ ready, setReady }), [ready]);

  return (
    <SplashContext.Provider value={value}>{children}</SplashContext.Provider>
  );
}
