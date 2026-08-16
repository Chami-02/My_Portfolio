// frontend/src/providers/SplashContext.js
//
// Same split as ThemeContext/MotionContext: the context lives apart from
// the provider so React Fast Refresh can hot-swap SplashProvider.jsx,
// and so eslint-plugin-react-refresh stays quiet.
import { createContext } from 'react';

/**
 * Splash-readiness context — PF-75 (scaffold), given teeth by PF-78.
 *
 * Defaults to { ready: true }, not null. ThemeContext and MotionContext
 * default to null and their hooks throw outside a provider, deliberately
 * — a missing theme or motion preference is a real bug worth surfacing
 * loudly. A missing SplashProvider is different: it means "there is no
 * splash on this page," which is the normal case for Admin and Blog.
 * Every existing Reveal/CountUp usage and test predates this ticket and
 * renders with no SplashProvider — defaulting to ready:true keeps all of
 * them behaviourally identical to before this ticket landed.
 */
export const SplashContext = createContext({ ready: true });
