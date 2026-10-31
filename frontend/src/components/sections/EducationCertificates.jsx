import { Link } from 'react-router-dom';
import { Reveal } from '../motion';
import { useAbout } from '../../hooks/useAbout';
import { useCertificates, useEducation } from '../../hooks/useEntries';
import { sectionText } from '../../utils/sectionText';
import { dateRange, splitMonthYear } from '../../utils/monthYear';
import styles from './EducationCertificates.module.css';

/** "BSc (Hons), Computer Science" — degree and field, either alone, or ''. */
const title = (e) => (e.degree && e.fieldOfStudy && !e.degree.includes(e.fieldOfStudy)
  ? `${e.degree}, ${e.fieldOfStudy}`
  : e.degree || e.fieldOfStudy || '');

/** The school's name — a link to its own site when it has one (owner, 2026-10-31). */
function School({ entry: e }) {
  if (!e.website) return e.school;
  return (
    <a className={styles.schoolLink} href={e.website} target="_blank" rel="noopener noreferrer"
      aria-label={`${e.school} (opens in a new tab)`}>
      {e.school}
    </a>
  );
}

/** How many certificates the home page lists before VIEW ALL (owner, 2026-10-30). */
export const HOME_CERTIFICATES = 6;

/**
 * PF-143 — Education + Certificates, the row under the About photo and its
 * buttons. TEXT ONLY (owner, 2026-10-30): the pictures live on /certificates.
 *
 * Two columns — Education as a timeline on the left, certificates as rows on
 * the right — that stack on narrow screens. Not in the prototype (frozen
 * before this existed); the layout was chosen by the owner from three samples.
 *
 * ⚠️ A column with nothing published renders NOTHING — no heading over an
 * empty list. A failed load is the same as an empty one on the public page
 * (the other sections' rule: the visitor gets no error box). The VIEW ALL link
 * shows whenever the certificates column does — always, not only past six
 * (owner): it is the way to the pictures, the verify buttons and the links.
 */
export function EducationCertificates() {
  const { data: about } = useAbout();
  const { data: education = [] } = useEducation();
  const { data: certificates = [] } = useCertificates();

  if (education.length === 0 && certificates.length === 0) return null;

  const verify = sectionText(about, 'certificatesVerify');

  return (
    <div className={styles.row}>
      {education.length > 0 && (
        <div className={styles.column}>
          <Reveal as="h3" type="up" className={styles.heading}>
            Education
          </Reveal>
          <ol className={styles.timeline}>
            {education.map((e, i) => (
              <Reveal as="li" key={e._id} type="up" delay={60 + i * 60} className={styles.step}>
                <span aria-hidden="true" className={styles.dot} />
                <div className={styles.head}>
                  {e.logo?.url && (e.website ? (
                    // The same link as the school's name, so it is hidden from
                    // keyboard and screen reader — the name is the one they use.
                    <a className={styles.logo} href={e.website} target="_blank" rel="noopener noreferrer"
                      aria-hidden="true" tabIndex={-1}>
                      <img src={e.logo.url} alt="" width="40" height="40" loading="lazy" decoding="async" />
                    </a>
                  ) : (
                    // Decorative: the school's name is right beside it as text.
                    <span className={styles.logo} aria-hidden="true">
                      <img src={e.logo.url} alt="" width="40" height="40" loading="lazy" decoding="async" />
                    </span>
                  ))}
                  <div className={styles.headText}>
                    {/* The degree is optional (owner, 2026-10-31): without
                        one, the school is the entry's title line. */}
                    {title(e) ? (
                      <>
                        <p className={styles.degree}>{title(e)}</p>
                        <p className={styles.school}><School entry={e} /></p>
                      </>
                    ) : (
                      <p className={styles.degree}><School entry={e} /></p>
                    )}
                  </div>
                </div>
                <p className={styles.meta}>
                  {[dateRange(e.start, e.end), e.grade].filter(Boolean).join(' · ')}
                </p>
                {e.description && <p className={styles.note}>{e.description}</p>}
                {e.activities && <p className={styles.note}>{e.activities}</p>}
              </Reveal>
            ))}
          </ol>
        </div>
      )}

      {certificates.length > 0 && (
        <div className={styles.column}>
          <Reveal as="h3" type="up" className={styles.heading}>
            {sectionText(about, 'certificatesHeading')}
          </Reveal>
          <ul className={styles.certs}>
            {certificates.slice(0, HOME_CERTIFICATES).map((c, i) => (
              <Reveal as="li" key={c._id} type="up" delay={60 + i * 60} className={styles.cert}>
                <span aria-hidden="true" className={styles.tick}>✓</span>
                <span className={styles.certBody}>
                  <Link className={styles.certTitle} to={`/certificates/${c.slug}`}>{c.title}</Link>
                  <span className={styles.meta}>
                    {[c.issuer, splitMonthYear(c.issued).year].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {c.verifyUrl && (
                  <a
                    className={styles.link}
                    href={c.verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${verify} ${c.title} (opens in a new tab)`}
                  >
                    {verify} ↗
                  </a>
                )}
              </Reveal>
            ))}
          </ul>
          <Reveal type="up" delay={120}>
            <Link className={styles.viewAll} to="/certificates">
              {sectionText(about, 'certificatesViewAll')} →
            </Link>
          </Reveal>
        </div>
      )}
    </div>
  );
}

export default EducationCertificates;
