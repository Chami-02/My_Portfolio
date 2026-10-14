// frontend/src/components/sections/SkillsSection.jsx
import { useEffect, useMemo } from 'react';
import { Reveal } from '../motion';
import { useSkills } from '../../hooks/useSkills';
import { useSkillCategories } from '../../hooks/useSkillCategories';
import { LEVELS, levelRank } from '../../utils/skillForm';
import styles from './SkillsSection.module.css';

/**
 * How many loading placeholders to show. The section list is not known yet
 * while it loads; five is how many boxes the page has always opened with, so
 * the grid holds its usual height and does not jump.
 */
const PLACEHOLDER_COUNT = 5;

/**
 * A skill's level as three dots, filled to its rank — PF-114, owner-requested
 * 2026-10-05, NO prototype source. The admin panel has always required a level
 * and nothing public read it; the owner's words were that it was "useless to
 * add" otherwise.
 *
 * `aria-hidden`: the dots are a picture of a word the pill also carries as
 * visually hidden text, so a screen reader hears "React, intermediate" once
 * rather than a row of unlabelled shapes.
 *
 * ⚠️ An unknown level renders NOTHING — rank 0, no dots — rather than three
 * empty dots, which would claim a level of zero the data never said.
 */
function LevelDots({ level }) {
  const rank = levelRank(level);
  if (!rank) return null;
  return (
    <span className={styles.dots} aria-hidden="true">
      {LEVELS.map((l, i) => (
        <span key={l} className={i < rank ? styles.dotOn : styles.dotOff} />
      ))}
    </span>
  );
}

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
  const skillsQuery = useSkills();
  const categoriesQuery = useSkillCategories();
  const { data: skills } = skillsQuery;
  const { data: categories } = categoriesQuery;
  const isLoading = skillsQuery.isLoading || categoriesQuery.isLoading;
  const isError = skillsQuery.isError || categoriesQuery.isError;
  const error = skillsQuery.error || categoriesQuery.error;

  // PF-114 — the boxes are the OWNER'S sections, in the owner's order, and a
  // box exists only while its section holds at least one skill.
  //
  // ⚠️ This REVERSES PF-82, which seeded a fixed five and rendered a card even
  // when it was empty so a data change could not reflow the grid. With
  // owner-created sections a fixed list cannot exist, and the owner decided
  // (2026-10-05) that an empty section stays hidden — a section still being
  // set up must not show visitors an empty box.
  const grouped = useMemo(() => {
    if (!skills || !categories) return null;
    return categories
      .slice()                                   // never sort the cached array
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((cat) => ({
        key:   cat.key,
        label: cat.label,
        // Copied before sorting, so the array TanStack Query caches is never
        // mutated. `order` sorts WITHIN a box.
        items: skills.filter((s) => s.category === cat.key).sort((x, y) => x.order - y.order),
      }))
      .filter((g) => g.items.length > 0);
  }, [skills, categories]);

  // Logged from an effect, not from render. A render-phase console.error
  // fires again on every unrelated re-render — a theme toggle, a parent
  // state change — and turns one failed fetch into a console full of
  // duplicates. Keyed on the error itself so it logs once per failure.
  useEffect(() => {
    if (isError) console.error('SkillsSection: loading skills failed', error);
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

        {/* PF-114 — the key to the dots, so one dot is not a guess. aria-hidden:
            each pill already SAYS its level to a screen reader. Revealed with
            the first card (same 60ms), and so carries no transition of its own
            (the PF-93 rule). */}
        {showGrid && (
          <Reveal type="up" delay={60} className={styles.legend} aria-hidden="true">
            {LEVELS.map((l) => (
              <span key={l} className={styles.legendItem}>
                <LevelDots level={l} />
                {l}
              </span>
            ))}
          </Reveal>
        )}

        {showGrid && (
          <div className={styles.grid}>
            {hasData
              ? grouped.map((group, i) => (
                  // 60 + i*60 → 60/120/180/240/300…, the prototype's
                  // data-delay values exactly for the first five. Note the
                  // first card and the h2 above deliberately share 60.
                  <Reveal
                    key={group.key}
                    type="up"
                    delay={60 + i * 60}
                    className={styles.card}
                  >
                    <p className={styles.categoryLabel}>{group.label.toUpperCase()}</p>
                    <div className={styles.pillRow}>
                      {group.items.map((skill) => (
                        <span key={skill._id} className={styles.pill}>
                          {skill.name}
                          <LevelDots level={skill.level} />
                          {levelRank(skill.level) > 0 && (
                            <span className={styles.srOnly}>, {skill.level}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </Reveal>
                ))
              // Bare divs, not Reveals: a placeholder that animates in
              // and then gets replaced animates the same grid slot twice.
              // aria-hidden because there is nothing here to announce.
              : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
                  <div
                    key={i}
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
