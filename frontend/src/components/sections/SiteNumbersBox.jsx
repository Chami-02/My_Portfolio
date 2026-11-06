// frontend/src/components/sections/SiteNumbersBox.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteNumbers } from '../../hooks/useSiteNumbers';
import { SectionLoadError } from '../common/SectionLoadError';
import { countryLabel } from '../../utils/audienceStats';
import { shortCount, updatedText } from '../../utils/siteNumbers';
import { loadFailed } from '../../utils/queryState';
import styles from './SiteNumbersBox.module.css';

function Stat({ value, label, tone }) {
  return (
    <div className={`${styles.number} ${tone}`}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{shortCount(value)}</dd>
    </div>
  );
}

function TopList({ title, items, to, empty, tone }) {
  return (
    <div className={tone}>
      <p className={styles.partTitle}>{title}</p>
      {items.length === 0 ? (
        <p className={styles.quiet}>{empty}</p>
      ) : (
        <ol className={styles.top}>
          {items.map(({ slug, title: name }, i) => (
            <li key={slug}>
              <Link className={styles.topLink} to={`${to}/${slug}`}>
                <span className={styles.rank} aria-hidden="true">{i + 1}</span>
                <span className={styles.topTitle}>{name}</span>
                <span className={styles.go} aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The age is worked out at render, so an open tab must render again to stay true. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * PF-150 (owner, 2026-11-06): the public totals, where the terminal was. Real
 * numbers from day one, however small. Follows the theme.
 *
 * Reads its own query and shows its own loading and failed states, so the
 * project card beside it never waits for it or fails with it.
 */
export function SiteNumbersBox() {
  const query = useSiteNumbers();
  const { data, refetch, isFetching } = query;
  const failed = loadFailed(query);
  const now = useMinuteClock();

  return (
    <section className={styles.box} aria-label="Site numbers">
      <div className={styles.head}>
        <span className={styles.name}>SITE NUMBERS</span>
        {data && (
          <span className={styles.fresh}>
            <span className={styles.dot} aria-hidden="true" />
            {updatedText(data.updatedAt, now)}
          </span>
        )}
      </div>

      {failed && (
        <div className={styles.failed}>
          <SectionLoadError what="The site numbers" retry={refetch} busy={isFetching} />
        </div>
      )}

      {data && (
        <>
          <dl className={styles.numbers}>
            <Stat value={data.visits} label="VISITS" tone={styles.toneVisits} />
            <Stat value={data.countriesReached} label="COUNTRIES" tone={styles.toneCountries} />
            <Stat value={data.blogReads} label="BLOG READS" tone={styles.toneReads} />
          </dl>

          <div className={styles.parts}>
            {data.topCountries.length > 0 && (
              <div className={styles.toneCountries}>
                <p className={styles.partTitle}>TOP COUNTRIES</p>
                <ul className={styles.countries}>
                  {data.topCountries.map((code) => (
                    <li key={code} className={styles.country}>{countryLabel(code)}</li>
                  ))}
                </ul>
              </div>
            )}
            <TopList
              title="MOST VIEWED PROJECTS"
              items={data.topProjects}
              to="/projects"
              empty="No project views counted yet."
              tone={styles.toneProjects}
            />
            <TopList
              title="MOST READ POSTS"
              items={data.topPosts}
              to="/blog"
              empty="No reads counted yet."
              tone={styles.toneReads}
            />
          </div>
        </>
      )}
    </section>
  );
}

export default SiteNumbersBox;
