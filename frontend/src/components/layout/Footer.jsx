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
  { href: 'https://www.linkedin.com/in/chamikara-gallage-3b0861295/',     label: 'LinkedIn ↗',  external: true },
  { href: 'https://web.facebook.com/parindra.chameekara',                 label: 'Facebook ↗',  external: true },
  { href: 'https://www.instagram.com/__pc_02/',                           label: 'Instagram ↗', external: true },
  { href: 'mailto:parindrachameekara@gmail.com',                          label: 'Email ↗',     external: false },
];

const COPYRIGHT =
  '© 2026 PARINDRA GALLAGE · ALL RIGHTS RESERVED · DESIGNED & BUILT FROM SCRATCH';

export function Footer() {
  const { pathname } = useLocation();

  return (
    <footer className={styles.footer}>
      {/* ⚠️ THE HERO'S BAND, MINUS ITS TILT — owner-requested 2026-08-25
          in two passes.

          Pass 1: "exactly like the top one … reduce the speed and
          features exactly like the above one." Pass 2: "the banner shows
          the end of the web page and start of the footer so it should be
          full 100% horizontal and fit to footer" — so the rotation does
          NOT come across, and the wrapper that gave it clearance is gone
          with it. Full reasoning and the retired values are in the
          module.

          ⚠️ `copies={16}`, not the prototype's 2. `marq` slides the track
          by only HALF its width per cycle, so the requirement is
          `copies >= 2 x band / copy` — NOT the intuitive `copy >= band`.
          Dropping to the hero's type scale shrank one copy from ~600px
          to ~485px, which RAISES the count needed: 16 covers a band to
          ~3880px where 12 covered ~2900px. The even-count requirement
          and the full arithmetic are in Marquee.jsx.

          ⚠️ `duration={40}` is a LITERAL, not a shared constant, and
          deliberately: Marquee.test.jsx pins the two bands together by
          reading `duration={n}` out of both call sites as source, and a
          named import would slip straight past that regex while looking
          tidier. Both bands were slowed together — the prototype runs
          the footer at 15s and the hero at 26s; the footer was matched
          to 26 on 2026-08-25 and then both went to 40 the same day. */}
      <Marquee duration={40} copies={16} className={styles.marqueeBand}>
        <span className={styles.marqueeText}>{MARQUEE_TEXT}</span>
      </Marquee>

      <div className={styles.inner}>
        <div className={styles.grid}>

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

          {/* ⚠️ NAVIGATE and ELSEWHERE are wrapped, owner-requested
              2026-08-25 — "navigate and elsewhere section should be in
              the middle with a acceptable gap". The grid is three zones
              now, not four equal columns; this pair is the middle one.
              The wrapper is a plain div, not a Reveal — each column
              keeps its own entrance and its own stagger delay. */}
          <div className={styles.linkGroup}>
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
          </div>

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
          {/* ⚠️ ONE CENTRED LINE, not the prototype's `1fr auto 1fr`.
              Owner-requested 2026-08-25: REPLAY INTRO and SCROLL BACK
              UP are both removed — replaying the splash is not
              something a visitor wants mid-visit, and the page already
              has a floating scroll-to-top control. With both outer
              cells gone there is nothing left to balance, so the grid
              goes too rather than leaving two empty `1fr` columns
              holding a centred line that a plain block already
              centres. */}
          <span className={styles.copyright}>{COPYRIGHT}</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
