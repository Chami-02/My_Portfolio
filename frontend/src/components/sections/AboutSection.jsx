// frontend/src/components/sections/AboutSection.jsx
import { useEffect, useRef } from 'react';
import { Reveal, CountUp } from '../motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { computeParallaxTransform } from '../../utils/parallax';
import aboutPortrait from '../../assets/about-portrait.png';
import styles from './AboutSection.module.css';

/**
 * The three counting stat cards — prototype lines 216-227. The fourth
 * card in that grid is not here on purpose: "Continuous / LEARNING" has
 * no data-count and is plain static text, so it is rendered explicitly
 * below rather than forced through CountUp with a sentinel value.
 *
 * Note two cards both count to 5. That is the prototype's, not a
 * copy-paste slip on the way over.
 */
const STATS = [
  { count: 5,  suffix: '+', label: 'PROJECTS BUILT', delay: 50 },
  { count: 10, suffix: '+', label: 'TECHNOLOGIES',   delay: 50 },
  { count: 5,  suffix: '+', label: 'GITHUB REPOS',   delay: 50 },
];

/**
 * About section — PF-81. Transcribed from
 * `docs/design/Portfolio Revolution.dc.html` lines 192-241.
 *
 * Replaces the Phase 1 AboutSection at this same path. The Phase 1
 * version read its bio, stats and résumé link from the API via
 * useAbout(); the prototype hardcodes all of that, so this does too and
 * the CMS's About panel no longer drives the public page. That is a
 * content-source regression, not a design one — flagged in the hand-off,
 * and it needs its own ticket rather than a quiet re-wire here, because
 * the prototype's copy and the API's shape do not line up field for field.
 *
 * First real use of CountUp anywhere on the page. No splash wiring is
 * needed for it or for Reveal: both call useSplashReady() internally
 * (PF-75/78), so every entrance and every count below is already held
 * behind the splash.
 */
export function AboutSection() {
  return (
    <section id="about" className={styles.about}>
      <div className={styles.inner}>
        <Reveal type="up" className={styles.eyebrow}>
          <span className={styles.eyebrowLabel}>01 / ABOUT</span>
          <span aria-hidden="true" className={styles.eyebrowLine} />
        </Reveal>

        <div className={styles.grid}>
          <Reveal type="left" className={styles.portraitCard}>
            <AboutPortrait />
          </Reveal>

          <div>
            <Reveal as="h2" type="up" className={styles.heading}>
              Who <span className={styles.outlined}>I am</span>
            </Reveal>

            <Reveal as="p" type="up" delay={80} className={styles.body}>
              I&apos;m a Computer Science undergraduate at the University of
              Westminster, passionate about building scalable web applications
              and continuously improving my backend and full-stack development
              skills. I enjoy turning ideas into real-world software using
              modern technologies and engineering best practices.
            </Reveal>

            <Reveal as="p" type="up" delay={140} className={styles.bodySecond}>
              I&apos;ve contributed to projects ranging from full-stack web
              applications to REST APIs and enterprise-style systems such as
              ClearDrive.lk. My experience includes Python, Java, Node.js, FastAPI,
              JavaScript, React, Next.js, PostgreSQL, MongoDB,  Docker, GitHub Actions,
              and Agile development using Jira.
            </Reveal>

            <Reveal as="p" type="up" delay={180} className={styles.seeking}>
              Interested in Software Engineering Job opportunities and Open to Work ✔
            </Reveal>

            <div className={styles.statGrid}>
              {STATS.map((stat) => (
                <Reveal
                  key={stat.label}
                  type="up"
                  delay={stat.delay}
                  className={styles.statCard}
                >
                  <p className={styles.statNumber}>
                    <CountUp to={stat.count} suffix={stat.suffix} />
                  </p>
                  <p className={styles.statLabel}>{stat.label}</p>
                </Reveal>
              ))}

              <Reveal type="up" delay={350} className={styles.statCard}>
                <p className={styles.statNumberStatic}>Continuous</p>
                <p className={styles.statLabel}>LEARNING</p>
              </Reveal>
            </div>

            <Reveal type="up" delay={380} className={styles.ctaRow}>
              <a href="#projects" className={styles.ctaPrimary}>
                SEE MY WORK →
              </a>
              {/* The real address, transcribed from the prototype and
                  matching this repo's own commit author — not a
                  placeholder to swap out. */}
              <a
                href="mailto:parindrachameekara@gmail.com"
                className={styles.ctaSecondary}
              >
                EMAIL ME
              </a>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The portrait card and its parallax — prototype line 202,
 * `data-para="0.05"`.
 *
 * Its own scroll listener rather than a shared one, matching the hero's
 * precedent (PF-80): the arithmetic is worth sharing, the subscription is
 * not. Two elements on the whole page carry data-para.
 *
 * Gates on reduced motion, where the portrait tilt in the hero does not.
 * That is a category difference, not an inconsistency: parallax exists to
 * move an element at a rate deliberately mismatched from the scroll
 * driving it, and the mismatch is the named vestibular trigger. A 1:1
 * pointer follow is not.
 */
function AboutPortrait() {
  const imgRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;

    const el = imgRef.current;
    if (!el) return undefined;

    let raf = null;
    const onScroll = () => {
      if (raf) return;                       // coalesce into one frame
      raf = requestAnimationFrame(() => {
        raf = null;
        el.style.transform = computeParallaxTransform(el, 0.05);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Matching the prototype's trailing this.onScroll(). Without it a
    // reload that restores mid-page scroll leaves the portrait unshifted
    // until the reader moves.
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div className={styles.portraitFrame}>
      {/* scale(1.02) inline, not in the module — see .portraitImg's
          comment. Overwritten by the parallax transform on the first
          frame under full motion; the resting value under reduced
          motion. */}
      <img
        ref={imgRef}
        src={aboutPortrait}
        alt="Parindra Gallage in the visor"
        className={styles.portraitImg}
        style={{ transform: 'scale(1.02)' }}
      />
      <div aria-hidden="true" className={styles.portraitFade} />
      <div aria-hidden="true" className={styles.portraitSweep} />
      <div className={styles.portraitCaption}>
        GALLE, SRI LANKA — SEEING THE STACK
      </div>
    </div>
  );
}

export default AboutSection;
