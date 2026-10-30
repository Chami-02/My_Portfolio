// frontend/src/hooks/useLogo.js
import logoDark  from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import { useTheme } from './useTheme';

/**
 * PF-134 — the site logo for the current theme: "PG" in an orbit, set in a
 * piece of the site's own sky (night in dark, warm paper in light). Every
 * logo on the site reads it, so the two files are the one place it lives.
 *
 * One <img> and a swapped src, rather than both images with CSS hiding one:
 * only the theme on screen is downloaded. There is no first-paint flash —
 * the head script sets data-theme before React, and ThemeProvider's
 * initial state reads it (PF-72).
 *
 * ⚠️ The files carry no rim: every frame on the site draws its own amber
 * ring. The favicon (public/favicon.svg) is the one copy WITH a rim,
 * because nothing frames a browser tab.
 */
export function useLogo() {
  const { isLight } = useTheme();
  return isLight ? logoLight : logoDark;
}
