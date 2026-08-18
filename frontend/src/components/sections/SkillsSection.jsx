// frontend/src/components/sections/SkillsSection.jsx
import { useEffect, useMemo } from 'react';
import { Reveal } from '../motion';
import { useSkills } from '../../hooks/useSkills';
import styles from './SkillsSection.module.css';

/**
 * Category render order and display labels, transcribed from the
 * prototype (lines 253-307). Deliberately a hardcoded list rather than
 * something derived from the data: the order the five cards appear in is
 * a design decision, and deriving it from whatever categories happen to
 * come back would let a single admin edit silently reshuffle the
 * section. `order` sorts WITHIN a card; this sorts the cards themselves.
 *
 * The Skill schema's sixth enum value, `other`, is absent on purpose.
 * The prototype has no card for it, so a skill filed under it renders
 * nowhere — that is the intended behaviour, not a gap.
 */
const CATEGORY_ORDER = ['language', 'frontend', 'backend', 'database', 'devops'];

const CATEGORY_LABELS = {
  language: 'LANGUAGES',
  frontend: 'FRONTEND',
  backend:  'BACKEND',
  database: 'DATABASE',
  devops:   'DEVOPS',
};

/**
 * Skills — PF-82. Full replacement of the Phase 1 component.
 *
 * The first genuinely async section of the Phase 2 rebuild: Hero and
 * About render instantly because their content is JSX, and both were
 * transcribed off the API deliberately (see CLAUDE.md's About entry).
 * This one is wired to `useSkills()` from the start — the Skill schema
 * already carries the prototype's 26 names, its 5 categories and an
 * `order` field, so hardcoding here would have created a third section
 * the admin CMS cannot drive, for no gain.
 *
 * Loading and error states have zero prototype precedent — it never
 * fetches anything — so both are decided here rather than transcribed.
 */
export function SkillsSection() {
  const { data: skills, isLoading, isError, error } = useSkills();

  const grouped = useMemo(() => {
    if (!skills) return null;

    // Seeded into fixed keys rather than accumulated, so a category with
    // no skills still yields an empty array and its card still renders.
    // Dropping the card instead would reflow the grid from 5 columns to
    // 4 on a data change, which is a layout decision the data should not
    // get to make.
    const byCategory = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, []]));

    skills.forEach((skill) => {
      // Unknown or `other` categories fall through — see CATEGORY_ORDER.
      if (byCategory[skill.category]) byCategory[skill.category].push(skill);
    });

    // Safe to sort in place: these arrays were built here, so this never
    // mutates the array TanStack Query is caching. The API already sorts
    // by `order` (skillController.js), which makes this belt-and-braces
    // for the case an admin reorders skills between fetches.
    Object.values(byCategory).forEach((arr) => arr.sort((a, b) => a.order - b.order));

    return byCategory;
  }, [skills]);

  // Logged from an effect, not from render. A render-phase console.error
  // fires again on every unrelated re-render — a theme toggle, a parent
  // state change — and turns one failed fetch into a console full of
  // duplicates. Keyed on the error itself so it logs once per failure.
  useEffect(() => {
    if (isError) console.error('SkillsSection: useSkills() failed', error);
  }, [isError, error]);

  // No visible failure UI, deliberately. One section failing to load
  // should not announce the whole site as broken on a portfolio page —
  // but the section, its heading and its `#skills` anchor stay, because
  // the navbar links to it (Navbar.jsx:10) and returning null here would
  // turn that link into a dead anchor with no feedback at all. Only the
  // card grid goes; the cause is in the console.
  const showGrid = !isError;
  const hasData  = !isLoading && grouped;

  return (
    <section id="skills" className={styles.skills}>
      <div className={styles.inner}>
        <Reveal type="up" className={styles.eyebrow}>
          <span className={styles.eyebrowLabel}>02 / SKILLS</span>
          <span aria-hidden="true" className={styles.eyebrowLine} />
        </Reveal>

        <Reveal as="h2" type="up" delay={60} className={styles.heading}>
          The <span className={styles.outlined}>Toolkit</span>
        </Reveal>

        {showGrid && (
          <div className={styles.grid}>
            {hasData
              ? CATEGORY_ORDER.map((cat, i) => (
                  // 60 + i*60 → 60/120/180/240/300, the prototype's
                  // data-delay values exactly. Note the first card and
                  // the h2 above deliberately share 60.
                  <Reveal
                    key={cat}
                    type="up"
                    delay={60 + i * 60}
                    className={styles.card}
                  >
                    <p className={styles.categoryLabel}>{CATEGORY_LABELS[cat]}</p>
                    <div className={styles.pillRow}>
                      {grouped[cat].map((skill) => (
                        <span key={skill._id} className={styles.pill}>
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  </Reveal>
                ))
              // Bare divs, not Reveals: a placeholder that animates in
              // and then gets replaced animates the same grid slot twice.
              // aria-hidden because there is nothing here to announce.
              : CATEGORY_ORDER.map((cat) => (
                  <div
                    key={cat}
                    className={styles.cardPlaceholder}
                    aria-hidden="true"
                  />
                ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default SkillsSection;
