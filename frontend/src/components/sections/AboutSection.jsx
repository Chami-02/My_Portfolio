// frontend/src/components/sections/AboutSection.jsx
import { useEffect, useRef } from 'react';
import { Reveal, CountUp } from '../motion';
import { MailIcon } from '../icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAbout } from '../../hooks/useAbout';
import { statCards } from '../../utils/aboutStats';
import { computeParallaxTransform } from '../../utils/parallax';
import aboutPortrait from '../../assets/about-portrait.jpg';
import styles from './AboutSection.module.css';

/*
 * ── The `STATS` const was DELETED here ───────────────────────────────────
 *
 * It held three counting cards plus a hand-written static fourth, so editing a
 * stat in the admin panel changed nothing on this page. The cards come from
 * `About.stats` now, through `utils/aboutStats.js`, which also decides per ROW
 * whether a value counts (`'5+'`) or renders as a word (`'Continuous'`) — the
 * same two branches, chosen by the data rather than by position.
 *
 * ⚠️ The prototype's four delays are 200 / 250 / 300 / 350 (a 50ms stagger).
 * The const said 50 / 50 / 50 / 350, so the first three cards all landed at
 * once — `50` is the STEP between the export's values, not any one of them.
 * Corrected in aboutStats.js; the prototype wins.
 */

/**
 * About section — PF-81. Transcribed from
 * `docs/design/Portfolio Revolution.dc.html` lines 192-241.
 *
 * ⚠️ THE PARAGRAPH ABOVE THIS ONE USED TO SAY THE OPPOSITE, and the reversal
 * is the point of this file's current shape. PF-81 transcribed the prototype,
 * which hardcodes the bio and the stats, and recorded the consequence honestly:
 * "the CMS's About panel no longer drives the public page… it needs its own
 * ticket rather than a quiet re-wire here." This IS that ticket. The bio, the
 * stat cards, the portrait, the availability line and the email all read the
 * About document now; only the heading and the CTA labels are still literals.
 *
 * ⚠️ The prototype is still the authority for how they LOOK. Nothing about the
 * layout, the classes, the delays or the two number treatments changed — the
 * only change is where the words come from. A fidelity pass diffing this
 * against the frozen export will find the same markup with different content,
 * and the content is the owner's to set.
 *
 * First real use of CountUp anywhere on the page. No splash wiring is
 * needed for it or for Reveal: both call useSplashReady() internally
 * (PF-75/78), so every entrance and every count below is already held
 * behind the splash.
 */
// The prototype's line (Portfolio Revolution.dc.html), used when the
// About document has no availabilityNote.
const SEEKING_FALLBACK = 'Interested in Software Engineering Job opportunities and Open to Work ✔';

/*
 * The two paragraphs this page has always shown, kept as a FIRST-PAINT FALLBACK
 * only — the same pattern `ContactSection` and `Footer` use for the email and
 * the location. They are not a second source of truth: migration 008 wrote these
 * exact strings into `About.bio`, so the document is what renders, and editing a
 * paragraph in the admin panel changes this section.
 *
 * ⚠️ They are deliberately IDENTICAL to what the page showed before the wiring,
 * so a failed `/api/about` degrades to the old behaviour rather than to a blank
 * column.
 */
const BIO_FALLBACK = [
  "I'm a Computer Science undergraduate at the University of Westminster, "
  + 'passionate about building scalable web applications and continuously '
  + 'improving my backend and full-stack development skills. I enjoy turning '
  + 'ideas into real-world software using modern technologies and engineering '
  + 'best practices.',

  "I've contributed to projects ranging from full-stack web applications to "
  + 'REST APIs and enterprise-style systems such as ClearDrive.lk. My '
  + 'experience includes Python, Java, Node.js, FastAPI, JavaScript, React, '
  + 'Next.js, PostgreSQL, MongoDB, Docker, GitHub Actions, and Agile '
  + 'development using Jira.',
];

export function AboutSection() {
  // Shared cache entry with ContactSection's useAbout() — no extra request.
  const { data: about } = useAbout();
  const isAvailable = about?.availableForWork ?? true;
  // ⚠️ `Array.isArray`, NOT `?.length`. The two differ on exactly one case and
  // it is the one that matters: a bio the owner has deliberately emptied is
  // `[]`, and `?.length` would hand the fallback paragraphs straight back —
  // text they just deleted, reappearing, which reads as the panel refusing to
  // save. `undefined` (query in flight, or a document written before the field
  // existed) still gets the fallback, which is what it is for.
  const bio   = Array.isArray(about?.bio) ? about.bio : BIO_FALLBACK;
  const cards = statCards(about);

  return (
    <section id="about" className={styles.about}>
      <div className={styles.inner}>
        <Reveal type="up" className={styles.eyebrow}>
          <span className={styles.eyebrowLabel}>01 / ABOUT</span>
          <span aria-hidden="true" className={styles.eyebrowLine} />
        </Reveal>

        <div className={styles.grid}>
          <Reveal type="left" className={styles.portraitCard}>
            <AboutPortrait avatar={about?.avatar} />
          </Reveal>

          <div>
            <Reveal as="h2" type="up" className={styles.heading}>
              Who <span className={styles.outlined}>I am</span>
            </Reveal>

            {/* ⚠️ The CLASS differs by position, and it is not decoration.
                `.bodySecond` composes `.body` and overrides margin-bottom to
                20px against 18px — the prototype's own values on lines 211 and
                212, transcribed as found rather than rounded to one number.
                Every paragraph after the first takes the 20px, so adding a
                third in the panel matches the second rather than the first.

                ⚠️ The delays stay the prototype's 80 and 140 for the first two.
                A third paragraph continues at +60, which is the step between
                them — the same reasoning as the stat cards, and it is written
                out here because "carry on the stagger" is exactly the judgement
                that got the stat delays wrong when it was left implicit. */}
            {bio.map((paragraph, i) => (
              <Reveal
                // Index is the key on purpose: a paragraph has no id, its text
                // is the thing being edited, and keying on the text would
                // remount the element on every keystroke in the panel's preview.
                key={i}
                as="p"
                type="up"
                delay={80 + (i * 60)}
                className={i === 0 ? styles.body : styles.bodySecond}
              >
                {paragraph}
              </Reveal>
            ))}

            {/* Owner decision 2026-09-16: the first field of this section
                to read the API. Shown only while available; the sentence
                is the panel's "Availability note", falling back to the
                transcribed copy when the note is empty. When the toggle is
                off the line is hidden — it is a sentence, not a badge, and
                "Currently building" as a paragraph reads wrong. */}
            {isAvailable && (
              <Reveal as="p" type="up" delay={180} className={styles.seeking}>
                {about?.availabilityNote || SEEKING_FALLBACK}
              </Reveal>
            )}

            <div className={styles.statGrid}>
              {cards.map((stat) => (
                <Reveal
                  key={stat.key}
                  type="up"
                  delay={stat.delay}
                  className={styles.statCard}
                >
                  {/* ⚠️ TWO DIFFERENT CLASSES, not one with a modifier.
                      `.statNumber` is 38px/1; `.statNumberStatic` is 26px/1.42
                      and uppercases — the prototype sizes a word differently
                      from a numeral (lines 216 vs 227). Rendering "Continuous"
                      at 38px overflows the card at the narrow end of the
                      auto-fit grid. */}
                  {stat.numeric ? (
                    <p className={styles.statNumber}>
                      <CountUp
                        to={stat.count}
                        suffix={stat.suffix}
                        decimals={stat.decimals}
                      />
                    </p>
                  ) : (
                    <p className={styles.statNumberStatic}>{stat.text}</p>
                  )}
                  <p className={styles.statLabel}>{stat.label}</p>
                </Reveal>
              ))}
            </div>

            <Reveal type="up" delay={380} className={styles.ctaRow}>
              <a href="#projects" className={styles.ctaPrimary}>
                SEE MY WORK →
              </a>
              {/* ⚠️ PF-112 — the address comes from the About document now, so it is
              editable in the admin panel and changes here, in Contact and in the
              footer together.

              The note that used to sit here said this was "the real address …
              not a placeholder to swap out", which was true of the literal and
              is now misleading: the literal is only a first-paint fallback, kept
              deliberately equal to what the page has always shown so a failed
              fetch degrades to the old behaviour rather than to a blank. */}
              <a
                href={`mailto:${about?.email || 'parindrachameekara@gmail.com'}`}
                className={styles.ctaSecondary}
              >
                {/* Owner-requested 2026-08-29. The prototype's label is
                    bare text; the envelope is an addition, and
                    `.ctaSecondary` already carries the inline-flex row
                    and 10px gap it needs, so no CSS changed here. */}
                <MailIcon />
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
function AboutPortrait({ avatar }) {
  const imgRef = useRef(null);
  const reduced = useReducedMotion();
  const uploaded = avatar?.url || null;

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
        // ⚠️ PF-112 — the uploaded portrait, with the BUNDLED asset as fallback.
        // `avatar.url` is only ever set alongside a stored publicId, so a crash
        // between upload and save reads as "no portrait" and the site shows the
        // shipped photograph rather than a broken image.
        //
        // ⚠️ NO CSS CHANGES GO WITH THIS. `.portraitImg` already declares
        // `aspect-ratio: 3/4` and `object-fit: cover`, so any upload is cropped
        // to the frame without help. See the note in the stylesheet about
        // `object-position`.
        src={uploaded || aboutPortrait}
        // ⚠️ The alt text has to follow the SOURCE. The bundled photograph's
        // description names the green Mini in it; reusing that sentence for an
        // arbitrary upload would describe a picture that is not there, which is
        // worse than a generic alt because a screen-reader user has no way to
        // tell it is wrong. The generic wording matches the hero portrait's.
        alt={uploaded
          ? 'Portrait of Parindra Gallage'
          : 'Parindra Gallage leaning against a classic green Mini'}
        className={styles.portraitImg}
        style={{ transform: 'scale(1.02)' }}
      />
      <div aria-hidden="true" className={styles.portraitFade} />
      {/* ⚠️ `.portraitSweep` was the next sibling and is GONE
          (owner-requested, 2026-09-07). It never painted until PF-101
          corrected the `sweep` keyframe hours earlier; the owner saw it
          for the first time and asked for its removal. The ELEMENT is
          removed, not just its animation. `.portraitFade` above is a
          DIFFERENT child and stays — see the module for both notes. */}
      {/* The prototype's "GALLE, SRI LANKA — SEEING THE STACK" caption
          (line 205) was removed 2026-08-18 at the owner's request. The
          ELEMENT is gone, not just its text — an empty positioned div
          would leave a stray box in the frame's bottom-left. `.portraitFade`
          stays: it is a separate element that softens the photo's bottom
          edge into the frame, and it predates the caption rather than
          existing to serve it. */}
    </div>
  );
}

export default AboutSection;
