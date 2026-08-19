// frontend/src/components/layout/Navbar.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import logo from '../../assets/logo.png';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '#about', label: 'ABOUT' },
  { href: '#skills', label: 'SKILLS' },
  { href: '#projects', label: 'PROJECTS' },
  { href: '#blog', label: 'BLOG' },
];

/**
 * Navbar — PF-79. Full replacement of the Phase 1 component.
 *
 * Transcribed from the prototype's <header> (lines 56-82) and
 * bindScroll() (1041-1063), with one sanctioned visual deviation and
 * one genuine gap this project fills in:
 *
 *   - Smooth scroll: the prototype uses native instant anchor-jump.
 *     Explicitly asked and approved as a deviation. The mechanism is
 *     CSS, not JS — html { scroll-behavior: smooth } in tokens.css,
 *     plus --header-h / scroll-margin-top on the sections PF-80
 *     onward will build. CSS covers every source of anchor navigation
 *     (nav clicks, back/forward, a typed #hash), not just clicks on
 *     this navbar, and motion.css already neutralises it under
 *     reduced motion.
 *   - Mobile nav: confirmed absent from the prototype at every
 *     breakpoint. Visual treatment was already locked in CLAUDE.md;
 *     the 768px breakpoint, z-index 80 and interaction details are
 *     this ticket's own judgment calls.
 *
 * bindScroll()'s other two responsibilities are deliberately NOT
 * here. The reveal-sweep-on-scroll duplicates each Reveal's own
 * interval (PF-74/75), and the data-para parallax handling belongs to
 * PF-81 — no [data-para] element exists in the DOM until it lands.
 *
 * No active-link highlighting: the prototype has none (grepped for
 * isActive/activeSection, zero matches). Phase 1's navbar did have
 * it; dropping it is fidelity, not an omission.
 */
export function Navbar() {
  const progressRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let raf = null;

    /** Prototype bindScroll()'s onScroll, progress-bar portion only. */
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const sc = document.scrollingElement || document.documentElement;
        const y = window.scrollY || sc.scrollTop || document.body.scrollTop;
        const max =
          Math.max(sc.scrollHeight, document.body.scrollHeight) - window.innerHeight;
        if (progressRef.current) {
          progressRef.current.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // Matches the prototype's trailing this.onScroll() call: the bar
    // reflects reality from mount, not only after the first scroll
    // event. Matters when the browser restores a scroll position or
    // the URL carries a #hash — otherwise the bar sits at 0% over a
    // page that is already halfway down.
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Body scroll lock while the overlay is open. Restores the previous
  // value rather than clearing to '', so this never clobbers a lock
  // some other component set.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <a href="#hero" className={styles.brand}>
            <img
              src={logo}
              /* PF-83. Was "Parindra Gallage", identical to the hero
                 portrait's and the splash's — three images announcing
                 the same string. This one is the only link of the three,
                 so its text says where it goes. */
              alt="Parindra Gallage — back to top"
              width={44}
              height={44}
              className={styles.logo}
            />
            <span className={styles.brandText}>
              PARINDRA<span className={styles.brandDot}>.</span>DEV
            </span>
          </a>

          <nav className={styles.nav}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={styles.navLink}>
                {link.label}
              </a>
            ))}
            <a href="#contact" className={styles.contactPill}>
              CONTACT
            </a>
            <span aria-hidden="true" className={styles.divider} />
            <ThemeToggle />
            <Link to="/admin/login" className={styles.adminLink}>
              <span aria-hidden="true" className={styles.adminDot} />
              ADMIN
            </Link>
          </nav>

          <button
            type="button"
            className={styles.hamburger}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            data-open={mobileOpen || undefined}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={styles.progressTrack}>
          <div ref={progressRef} className={styles.progressFill} />
        </div>
      </header>

      {mobileOpen && <MobileOverlay onClose={closeMobile} />}
    </>
  );
}

/**
 * Full-screen mobile nav overlay — no prototype precedent.
 *
 * Ambient layer (canvas + grain) shows through by design: the
 * backdrop supplies a translucent surface, never a solid background.
 *
 * Focus moves to the first link on open, and PF-83 closed the loop
 * PF-79 left open: Tab / Shift+Tab are now bound to the overlay's own
 * first and last focusable element, and focus returns to the hamburger
 * when the overlay unmounts. Escape, backdrop-click and link-click
 * close were already correct in PF-79 and are untouched.
 */
function MobileOverlay({ onClose }) {
  const firstLinkRef = useRef(null);
  const overlayRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    // Captured here rather than as useRef(document.activeElement),
    // which would re-read the DOM on every render to use the first
    // render's value. Nothing moves focus between the hamburger's
    // onClick and this effect, so the reading is the same either way.
    triggerRef.current = document.activeElement;
    firstLinkRef.current?.focus();

    return () => {
      // Return focus to whatever opened the overlay — the hamburger —
      // rather than abandoning it on whichever link happened to be
      // focused when it closed, which would drop the user's Tab
      // position to the top of the document.
      //
      // Note what StrictMode does to this in dev: the simulated remount
      // runs this cleanup immediately after the mount above, so focus
      // goes first link → hamburger → first link. It settles on the
      // right element because the re-run re-focuses, which is exactly
      // why this is safe here and why the analogous setReady(true)
      // "safety net" in SplashProvider is not — that one had no second
      // run to correct it.
      triggerRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const root = overlayRef.current;
      if (!root) return;

      // Queried per keypress, not cached at mount. The overlay's
      // focusable set is static today, but a cached NodeList would go
      // stale the moment anything conditional lands in here, and the
      // failure would be a Tab that escapes the trap rather than an
      // error.
      const focusable = root.querySelectorAll('a[href], button:not([disabled])');
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Focus is not in the overlay at all — the user clicked the
      // browser chrome and tabbed back, or focus fell to <body>. A trap
      // that only wraps at its own edges leaks in that case, because
      // neither edge test matches and the default Tab walks the header
      // sitting behind the overlay. Pull it back in instead.
      if (!root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // On document, not on the overlay element. Both work while focus is
    // inside (keydown bubbles), but only this one sees the keypress in
    // the escaped-focus case handled above.
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    // The surface IS the backdrop: one element carrying the
    // translucent tone, the centring, and the click-to-dismiss.
    //
    // A separate backdrop layer underneath a full-size panel does not
    // work — whichever element is on top swallows every click, so the
    // backdrop only ever receives the ones that miss it, which on a
    // full-viewport panel is none. Letting clicks bubble to this root
    // and having the nav stop them is the version that actually
    // dismisses on a tap outside the menu.
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.overlayClose}
        aria-label="Close menu"
        onClick={onClose}
      >
        ×
      </button>

      {/* Clicks on the menu itself are not "outside" clicks. Each link
          still closes via its own handler — stopping the bubble here
          only prevents the theme toggle, and the gaps between items,
          from dismissing the menu. */}
      <nav className={styles.overlayNav} onClick={(e) => e.stopPropagation()}>
        {NAV_LINKS.map((link, i) => (
          <a
            key={link.href}
            href={link.href}
            ref={i === 0 ? firstLinkRef : undefined}
            className={styles.overlayLink}
            onClick={onClose}
          >
            {link.label}
          </a>
        ))}
        <a
          href="#contact"
          className={styles.overlayContactPill}
          onClick={onClose}
        >
          CONTACT
        </a>
        <ThemeToggle />
        <Link
          to="/admin/login"
          className={styles.overlayAdminLink}
          onClick={onClose}
        >
          ADMIN
        </Link>
      </nav>
    </div>
  );
}

export default Navbar;
