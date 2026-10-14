// frontend/src/components/admin/AdminFlashContext.js
import { createContext } from 'react';

/**
 * PF-107. The admin shell's saved-flash banner, transcribed from
 * Admin.dc.html:172 — a panel saves, the banner appears above the
 * content, the panel does not have to render it itself.
 *
 * ⚠️ The context lives in its OWN module, separate from its provider.
 * A context exported alongside its provider trips
 * `react-refresh/only-export-components`, which CI runs with
 * --max-warnings=0. That has cost a lint cycle three times in this
 * repo; ThemeContext, MotionContext and SplashContext are all split
 * the same way.
 *
 * ⚠️ FAILS OPEN, like SplashProvider and unlike Theme/Motion. The
 * default is a working no-op rather than `null` plus a throw, because
 * a panel rendered outside the shell — which is exactly what every
 * panel unit test does — is the normal case here, not a bug. A missing
 * theme is worth surfacing; a missing flash banner is not.
 */
export const AdminFlashContext = createContext({
  flash:        null,
  showFlash:    () => {},
  dismissFlash: () => {},
});
