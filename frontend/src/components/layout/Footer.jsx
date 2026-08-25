// frontend/src/components/layout/Footer.jsx
import { useLocation } from 'react-router-dom';
import { Reveal, Marquee } from '../motion';
import { sectionHref } from '../../utils/nav';
import logo from '../../assets/logo.png';
import styles from './Footer.module.css';

/**
 * Site footer — PF-88. Transcribed from
 * `docs/design/Portfolio Revolution.dc.html` lines 543-603.
 *
 * Replaces the Phase 1 footer (a branding block, a "Built with" line and
 * three icon links) wholesale, at the same path.
 *
 * ⚠️ Blog.dc.html has its OWN footer with a different copyright
 * (`· FIELD NOTES` where this one says `· DESIGNED & BUILT FROM
 * SCRATCH`). That is Sprint 13's and is deliberately not built here —
 * but the copy that differs is the single COPYRIGHT constant below and
 * the route already reaches this component, so the variant slots in
 * beside `isBlogPath()` rather than needing a rewrite.
 */

/* ⚠️ The trailing U+00A0 is LOAD-BEARING — it is the gap between the two
   repeats, and the prototype writes it as a literal `&nbsp;` (lines 546,
   547). A plain space is collapsed by white-space processing and the two
   copies butt together at the wrap. */
const MARQUEE_TEXT = "OPEN TO OPPORTUNITIES ✦ LET'S BUILD SOMETHING LOUD ✦ ";

/* ⚠️ "Field Notes", not "BLOG". The footer labels the section by its
   name where the header labels it by its id, and the prototype has it
   both ways deliberately (line 570 against line 63). Case differs too —
   the footer's links are title case, the header's uppercase. */
const NAV_LINKS = [
  { id: 'about',    label: 'About' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'blog',     label: 'Field Notes' },
  { id: 'contact',  label: 'Contact' },
];

/* Prototype lines 575-579, verbatim including the trailing ↗. The mail
   link carries no target/rel — it is not a document navigation. */
const ELSEWHERE_LINKS = [
  { href: 'https://github.com/Chami-02',                                  label: 'GitHub ↗',    external: true },
  { href: 'https://www.linkedin.com/in/chamikara-gallege-3b0861295/',     label: 'LinkedIn ↗',  external: true },
  { href: 'https://web.facebook.com/parindra.chameekara',                 label: 'Facebook ↗',  external: true },
  { href: 'https://www.instagram.com/__pc_02/',                           label: 'Instagram ↗', external: true },
  { href: 'mailto:parindrachameekara@gmail.com',                          label: 'Email ↗',     external: false },
];

const COPYRIGHT = '© 2026 PARINDRA GALLAGE · DESIGNED & BUILT FROM SCRATCH';

/**
 * @param {() => void} [onReplay]  raises App.jsx's replay counter. See
 *   the note on `.replay` below for why the button is home-page only.
 * @param {number} [replayCount]   that same counter, read back. See the
 *   note on the grid below — the footer has four reveal targets of its
 *   own, and they live outside HomePage's keyed subtree.
 */
export function Footer({ onReplay, replayCount = 0 }) {
  const { pathname } = useLocation();
  const onHome = pathname === '/';

  return (
    <footer className={styles.footer}>
      {/* The band's surface, borders and padding sit on Marquee's own
          clipping container rather than on its animated track, which
          Marquee owns. The track is the only thing inside it, so the
          painted result is identical — same move HeroSection made.

          ⚠️ NOT the hero's marquee. The hero's was slimmed 38% at the
          owner's request on 2026-08-17; this one keeps the prototype's
          own type scale and padding. Marquee hard-codes neither, so the
          band needed only its own module class.

          ⚠️ `copies={12}`, not the prototype's 2. One copy of this strip
          is 600px, and `marq` slides the track by only HALF its width
          per cycle — so the requirement is `copies ≥ 2 × band / copy`,
          which is 4.8 at 1440px and 8.5 at 2560px, NOT the intuitive
          `copy ≥ band`. Two copies left 840px of the band empty at the
          wrap, growing as the track slid. Twelve covers a band up to
          3600px. Owner-approved 2026-08-24; arithmetic, measurements and
          the even-count requirement are in Marquee.jsx. */}
      <Marquee duration={15} copies={12} className={styles.marqueeBand}>
        <span className={styles.marqueeText}>{MARQUEE_TEXT}</span>
      </Marquee>

      <div className={styles.inner}>
        {/* ⚠️ KEYED, and only this half of the footer is.
            The prototype's hideReveals() walks EVERY [data-reveal] in
            the document, and four of them are here — <Footer /> is a
            sibling of the routed page in App.jsx, so HomePage's own
            keyed subtree cannot reach them. Without this the four
            columns stay revealed through a replay and are already shown
            when the visitor scrolls back down, where the prototype
            re-animates them.

            The BOTTOM BAR is deliberately outside the key: it holds the
            replay button itself, and remounting the element that was
            just activated drops keyboard focus to <body> mid-sequence.
            Nothing in the bar is a reveal target, so it has nothing to
            reset. */}
        <div className={styles.grid} key={replayCount}>

          <Reveal className={styles.identity}>
            <div className={styles.brandRow}>
              {/* ⚠️ alt="" — decorative. The name and role render as real
                  text immediately to its right and it is not a link, so
                  describing it would announce the same thing twice. The
                  prototype's own alt is "Parindra Gallage"; this is the
                  same call PF-83 made for the splash logo, and it is the
                  FOURTH element that would otherwise carry that string. */}
              <img
                src={logo}
                alt=""
                width="52"
                height="52"
                className={styles.logo}
              />
              <span className={styles.brandText}>
                <span className={styles.name}>
                  Parindra <span className={styles.nameAccent}>Gallage</span>
                </span>
                <span className={styles.role}>FULL-STACK DEVELOPER</span>
              </span>
            </div>

            <p className={styles.bio}>
              Computer Science undergraduate at the University of Westminster,
              building scalable web applications — MERN, FastAPI, Docker,
              shipped with CI/CD.
            </p>

            <div className={styles.availability}>
              <span aria-hidden="true" className={styles.availabilityDot} />
              {/* data-ok is the prototype's own hook — applyTheme() (line
                  868) recolours every [data-ok] element per theme. Ported
                  as a theme-scoped CSS rule; see the module. */}
              <span data-ok="" className={styles.availabilityLabel}>
                AVAILABLE FOR WORK
              </span>
            </div>
          </Reveal>

          <Reveal delay={80} className={styles.column}>
            <span className={styles.columnHeading}>NAVIGATE</span>
            {NAV_LINKS.map(({ id, label }) => (
              <a
                key={id}
                href={sectionHref(pathname, id)}
                className={styles.link}
              >
                {label}
              </a>
            ))}
          </Reveal>

          <Reveal delay={140} className={styles.column}>
            <span className={styles.columnHeading}>ELSEWHERE</span>
            {ELSEWHERE_LINKS.map(({ href, label, external }) => (
              <a
                key={label}
                href={href}
                className={styles.link}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
              >
                {label}
              </a>
            ))}
          </Reveal>

          <Reveal delay={200} className={styles.status}>
            <span className={styles.columnHeading}>STATUS</span>
            <span className={styles.statusLines}>
              <span data-ok="" className={styles.statusDotOk}>●</span> CI pipeline green<br />
              <span className={styles.statusDotAcc}>●</span> Galle, Sri Lanka · UTC+5:30<br />
              <span className={styles.statusDotMuted}>●</span> Replies within 24h
            </span>
            <a href={sectionHref(pathname, 'contact')} className={styles.statusCta}>
              START A PROJECT →
            </a>
          </Reveal>

        </div>

        <div className={styles.bottomBar}>
          {/* ⚠️ Home page only, and the empty <span> is not padding — the
              bar is `1fr auto 1fr`, so with two children the copyright
              lands in column 1 and stops being centred. Off the home page
              there is no splash to replay: HomePage is the only route
              that mounts one, so a button here would be dead chrome of
              exactly the kind Step 3 removed from the links. */}
          {onHome ? (
            <button type="button" onClick={onReplay} className={styles.replay}>
              ↻ REPLAY INTRO
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <span className={styles.copyright}>{COPYRIGHT}</span>

          <a href={sectionHref(pathname, 'hero')} className={styles.scrollUp}>
            SCROLL BACK UP ↑
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
