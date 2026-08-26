// frontend/src/components/sections/HeroSection.jsx
import { useEffect, useRef } from 'react';
import { Reveal, Marquee } from '../motion';
import heroImg from '../../assets/hero-ai.png';
import styles from './HeroSection.module.css';

/**
 * The eight floating tech chips — Portfolio Revolution.dc.html lines
 * 152-183. Position, float duration, float offset, dot shape, dot colour
 * and border tone are all per-chip in the prototype, so each carries its
 * own modifier class; only `delay` is passed through JS, because Reveal
 * takes it as a prop.
 *
 * Note React and FastAPI carry an accent-toned border where the other
 * six use the neutral line tone. Easy to read as a copy-paste slip in
 * the prototype and it is not — they are the two chips nearest the
 * portrait's accent glow. Transcribed as found.
 */
const CHIPS = [
  { label: 'React',      delay: 700,  cls: 'chipReact' },
  { label: 'Node.js',    delay: 800,  cls: 'chipNode' },
  { label: 'Docker',     delay: 900,  cls: 'chipDocker' },
  { label: 'MongoDB',    delay: 980,  cls: 'chipMongo' },
  { label: 'Python',     delay: 1040, cls: 'chipPython' },
  { label: 'PostgreSQL', delay: 1100, cls: 'chipPostgres' },
  { label: 'Git',        delay: 1160, cls: 'chipGit' },
  { label: 'FastAPI',    delay: 1220, cls: 'chipFastapi' },
  // Owner-requested, 2026-08-17. Not in the prototype's eight. Slotted
  // into the free gap on the left flank between React (top 16%) and
  // PostgreSQL (~top 57%), and continues the reveal stagger rather than
  // restarting it.
  { label: 'Next.js',    delay: 1280, cls: 'chipNext' },
  // Owner-requested, 2026-08-17. Sits below Docker on the right flank.
  { label: 'Java',       delay: 1340, cls: 'chipJava' },
];

/** Lines 100-108. Each pill's lead dot pulses at its own rate. */
const ROLE_PILLS = [
  { text: 'Full-Stack Web Developer',  delay: 200, cls: 'rolePillDotA' },
  { text: 'Cloud & DevOps Enthusiast', delay: 280, cls: 'rolePillDotB' },
  { text: 'Continuous Learner',        delay: 360, cls: 'rolePillDotC' },
];

// Line 189. The trailing non-breaking space is the prototype's, and it
// is load-bearing: it holds the gap between the end of one copy and the
// start of the next, so the loop has no visible seam.
const MARQUEE_TEXT =
  'MERN Stack ✦ React ✦ Node.js ✦ Python ✦ Java ✦ PostgreSQL ✦ Express ✦ ' +
  'MongoDB ✦ FastAPI ✦ Docker ✦ CI/CD ✦ Jira ✦ Linux ✦ REST APIs ✦ ';

/**
 * Hero section + marquee strip — PF-80. Transcribed from
 * `docs/design/Portfolio Revolution.dc.html` lines 83-191.
 *
 * First real use of Reveal (20 instances) and Marquee anywhere on the
 * page. Splash-gating needs no wiring here: Reveal calls
 * useSplashReady() internally (PF-75/78), so every entrance below is
 * held behind the splash for free.
 *
 * The marquee is a SIBLING of <section>, not a child — the prototype has
 * it after the closing tag (line 187), and the section is a
 * min-height:100vh flex-centre box that would swallow it. Hence the
 * fragment.
 *
 * The prototype's typeLoop()/ROLES/{{ typed }} typewriter is live in its
 * logic block but never rendered in this markup — grep confirms zero
 * references to `typed` between lines 83 and 191. The three static role
 * pills are the real on-screen content. Not building a typewriter.
 */
export function HeroSection() {
  return (
    <>
      <section id="hero" className={styles.hero}>
        {/* The prototype's parallax grid layer (line 84) was here — a
            74px accent lattice on a data-para="0.12" element. Removed
            2026-08-18 at the owner's request, with every other section
            background, so the StarfieldCanvas reads through the hero.

            The whole COMPONENT went, not just its background-image. The
            grid was the element's only visual content, so leaving it
            would have kept an invisible div running a scroll listener
            and a requestAnimationFrame write per frame for something
            nobody can see. computeParallaxTransform() itself stays —
            AboutSection's portrait still uses it at 0.05. */}
        <div className={styles.inner}>
          <div>
            <Reveal type="up" className={styles.badge}>
              <span aria-hidden="true" className={styles.badgeDot} />
              <span className={styles.badgeText}>OPEN TO OPPORTUNITIES</span>
            </Reveal>

            <Reveal as="p" type="up" delay={60} className={styles.eyebrow}>
              HEY — I AM
            </Reveal>

            <Reveal as="h1" type="up" delay={120} className={styles.heading}>
              <span className={styles.headingLine}>Parindra</span>
              <span className={styles.headingAccent}>Gallage</span>
            </Reveal>

            <div className={styles.pillRow}>
              {ROLE_PILLS.map((pill) => (
                <Reveal
                  key={pill.text}
                  as="span"
                  type="pop"
                  delay={pill.delay}
                  className={styles.rolePill}
                >
                  <span
                    aria-hidden="true"
                    className={`${styles.rolePillDot} ${styles[pill.cls]}`}
                  />
                  {pill.text}
                </Reveal>
              ))}

              {/* Owner-requested, 2026-08-17. Not in the prototype.
                  Styled as the OPEN TO OPPORTUNITIES badge — same border,
                  tint, glow shadow and lead dot — and it keeps the pill's
                  glowpulse outline breathing. Only the dot's own pulse is
                  dropped, which is why this does not reuse .badgeDot.

                  An <a>, not a <button>: it moves the reader to another
                  place in the document, which is what a link is for, and
                  it matches the two CTAs below. That also buys the native
                  smooth scroll (and its reduced-motion override), keyboard
                  activation and open-in-new-tab for free, none of which a
                  <button> + scrollTo would carry. Presents and behaves as
                  a button either way. */}
              <Reveal
                as="a"
                href="#contact"
                type="pop"
                delay={50}
                className={styles.loudCta}
              >
                <span aria-hidden="true" className={styles.loudCtaDot} />
                <span className={styles.loudCtaText}>Let's build something LOUD!</span>
              </Reveal>
            </div>

            {/* delay 260 sits between the 2nd and 3rd pill's 280 and 360.
                Non-monotonic in DOM order and transcribed exactly — the
                paragraph is meant to arrive while the pills are still
                landing, not after them. Not a typo to "fix". */}
            <Reveal as="p" type="up" delay={260} className={styles.body}>
              I’m a Computer Science undergraduate and Full-Stack Developer passionate about building modern, 
              scalable web applications.
            </Reveal>

            <Reveal type="up" delay={320} className={styles.ctaRow}>
              <a href="#projects" className={styles.ctaPrimary}>
                VIEW MY WORK →
              </a>
              {/* The prototype's data-cv hook rewrites this href to a
                  localStorage résumé data-URL when one exists, falling back
                  to #contact. That bridge is an admin-panel concern and
                  belongs with the résumé ticket, not here — the fallback
                  href is the transcribed default either way. */}
              <a href="#contact" className={styles.ctaSecondary}>
                DOWNLOAD CV
              </a>
            </Reveal>
          </div>

          <HeroPortrait />
        </div>

        <div aria-hidden="true" className={styles.scrollIndicator}>
          <span className={styles.scrollLabel}>SCROLL</span>
          <span className={styles.scrollLine} />
        </div>
      </section>

      <div className={styles.marqueeWrap}>
        {/* `copies={6}`, not the prototype's 2 (lines 188-189). One
            copy is 1297px against a 1484px band, and `marq` slides the
            track by only HALF its width per cycle, so the requirement
            is `copies ≥ 2 × band / copy` — two left 187px of the band
            empty at the wrap. Six covers a band up to 3891px. The
            footer's band has the same defect, worse. Pre-existing since
            PF-80, fixed with the footer's on 2026-08-24,
            owner-approved. Arithmetic and measurements in Marquee.jsx.

            ⚠️ NOT part of this hero's 2026-08-17 slimming deviation —
            that one is font-size and padding, and lives in the module. */}
        <Marquee duration={40} copies={6} className={styles.marqueeInner}>
          <span className={styles.marqueeText}>{MARQUEE_TEXT}</span>
        </Marquee>
      </div>
    </>
  );
}

/**
 * Portrait stage — lines 125-184. Carries the tilt half of the
 * prototype's bindPointer(); the glow half became CursorGlow in PF-77.
 *
 * Not gated on reduced motion — see HeroParallaxGrid's note. The .35s
 * smoothing on each update is a plain CSS transition, which motion.css
 * already collapses globally.
 */
function HeroPortrait() {
  const hostRef = useRef(null);
  const innerRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner) return undefined;

    const onMove = (e) => {
      // Normalised against the WHOLE window, not the stage's own box, so
      // tilt sensitivity scales with viewport size; only the centring
      // term reads the stage. Transcribed from lines 1078-1082.
      const r = host.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
      inner.style.transform =
        `rotateY(${(nx * 7).toFixed(2)}deg) rotateX(${(-ny * 5).toFixed(2)}deg) ` +
        `translate3d(${(nx * 14).toFixed(1)}px,${(ny * 8).toFixed(1)}px,0)`;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div ref={hostRef} className={styles.portraitStage}>
      <span aria-hidden="true" className={styles.portraitGlow} />
      <span aria-hidden="true" className={styles.portraitRingDashed} />
      <span aria-hidden="true" className={styles.portraitRingSolid} />

      {/* Light-theme-only plate behind the portrait. CSS-only: the
          prototype's applyTheme() writes this element's opacity from JS
          (line 861), but its own stylesheet already carries
          html[data-theme="light"] [data-lightplate]{opacity:1} (line 18),
          so the write is redundant — same value, same moment.
          The attribute is what the light-theme rule matches on, and that
          rule lives in tokens.css, not this component's module. Remove
          the attribute and the plate silently never appears in light
          theme, with nothing wrong in either file on its own. */}
      <span aria-hidden="true" data-lightplate="" className={styles.lightPlate} />

      <Reveal type="rise" delay={180} className={styles.portraitFrame}>
        <div ref={innerRef} className={styles.portraitInner}>
          {/* PF-83. Was "Parindra Gallage" — the same string the navbar
              logo and the splash both carried. The alternative
              considered was alt="" on the reasoning that the <h1> beside
              it already announces the name, so the image adds no new
              information. Described instead, for two reasons: the
              portrait is this section's primary visual content rather
              than an ornament, and AboutSection's portrait has read
              as a description since PF-81, so describing
              is already this repo's answer for a portrait. Worth a pass
              with a real screen reader at some point; it is a judgment
              call, not a settled fact. */}
          <img
            src={heroImg}
            alt="Portrait of Parindra Gallage"
            className={styles.portraitImg}
          />
        </div>
      </Reveal>

      {/* Four ambient drift blobs. These live INSIDE the portrait stage
          in the prototype (lines 138-141), not in the section
          background, and blobC sits at z-index 4 — above the portrait
          frame's 3 — so it drifts in front of the image while the other
          three stay behind it. Moving them out to the section, or
          flattening the z-index, loses that depth. */}
      <span aria-hidden="true" className={`${styles.blob} ${styles.blobA}`} />
      <span aria-hidden="true" className={`${styles.blob} ${styles.blobB}`} />
      <span aria-hidden="true" className={`${styles.blob} ${styles.blobC}`} />
      <span aria-hidden="true" className={`${styles.blob} ${styles.blobD}`} />

      {CHIPS.map((chip) => (
        <Reveal
          key={chip.label}
          type="pop"
          delay={chip.delay}
          className={`${styles.chip} ${styles[chip.cls]}`}
        >
          <span aria-hidden="true" className={styles.chipDot} />
          <span className={styles.chipLabel}>{chip.label}</span>
        </Reveal>
      ))}
    </div>
  );
}

export default HeroSection;
