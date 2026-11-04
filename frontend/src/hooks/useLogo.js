// frontend/src/hooks/useLogo.js
import logo from '../assets/logo.webp';

/**
 * The site logo, one file in both themes (PF-146, owner: the photo logo is
 * back, zoomed so the head sits in the middle of the circle; it replaces
 * PF-134's Orbit PG). Every logo on the site reads it, so this is the one
 * place it lives. The browser-tab icons in public/ are cut from the same crop.
 */
export function useLogo() {
  return logo;
}
