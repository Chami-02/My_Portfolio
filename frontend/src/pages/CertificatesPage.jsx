import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Reveal } from '../components/motion';
import { useAbout } from '../hooks/useAbout';
import { useCertificates } from '../hooks/useEntries';
import { sectionText } from '../utils/sectionText';
import { formatMonthYear } from '../utils/monthYear';
import styles from './CertificatesPage.module.css';

/**
 * PF-143 — /certificates and /certificates/:slug.
 *
 * The grid is picture cards like the reference site the owner chose
 * (supunsathsara.com/certifications): picture, VIEW CERTIFICATE, title, issuer.
 * A card opens the BIG VIEW, and beats the reference in four ways the owner
 * agreed to:
 *   • the big view is a URL (/certificates/<slug>), so a certificate can be
 *     shared and the browser's Back closes it;
 *   • ← → and Esc on the keyboard, focus kept inside while it is open;
 *   • the next and previous pictures are fetched ahead, so stepping through
 *     never shows an empty frame (the reference does);
 *   • a filter by issuer once there are two or more issuers.
 */
export function CertificatesPage() {
  const { slug } = useParams();
  const { data: about } = useAbout();
  const query = useCertificates();
  const { data: certificates = [], isLoading } = query;
  const failed = query.isError && query.data === undefined;

  const [searchParams, setSearchParams] = useSearchParams();
  const issuer = searchParams.get('issuer') || '';

  // Arriving here starts at the top; Back restores where the reader was.
  const location = useLocation();
  const didLandingScroll = useRef(false);
  useEffect(() => {
    if (didLandingScroll.current) return;
    didLandingScroll.current = true;
    if (location.state?.fromGrid) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.state]);

  const issuers = [...new Set(certificates.map((c) => c.issuer).filter(Boolean))];
  const shown = issuer ? certificates.filter((c) => c.issuer === issuer) : certificates;
  const cardLabel = sectionText(about, 'certificatesCardLabel');

  const setIssuer = (value) => setSearchParams(value ? { issuer: value } : {}, { replace: true });

  return (
    <>
      <section className={styles.header}>
        <div className={styles.inner}>
          <Reveal as="h1" type="up" className={styles.heading}>
            {sectionText(about, 'certificatesPageHeading')}
          </Reveal>
          <Reveal as="p" type="up" delay={60} className={styles.deck}>
            {sectionText(about, 'certificatesPageIntro')}
          </Reveal>
          {certificates.length > 0 && (
            <Reveal type="up" delay={120} className={styles.statRow}>
              <span className={styles.countPill}>
                <span aria-hidden="true" className={styles.countDot} />
                {certificates.length} {certificates.length === 1 ? 'CERTIFICATE' : 'CERTIFICATES'}
              </span>
            </Reveal>
          )}
          {issuers.length > 1 && (
            <div className={styles.filters} role="group" aria-label="Filter by issuer">
              {['', ...issuers].map((name) => (
                <button
                  key={name || 'all'}
                  type="button"
                  className={name === issuer ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={name === issuer}
                  onClick={() => setIssuer(name)}
                >
                  {name || 'ALL'}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.cards}>
        <div className={styles.inner}>
          {failed ? (
            <p className={styles.message}>
              The certificates could not load.{' '}
              <button type="button" className={styles.retry} onClick={() => query.refetch()}>
                TRY AGAIN
              </button>
            </p>
          ) : isLoading ? null : shown.length === 0 ? (
            <p className={styles.message}>No certificates to show yet.</p>
          ) : (
            <ul className={styles.grid}>
              {shown.map((c, i) => (
                <Reveal as="li" key={c._id} type="up" delay={Math.min(i, 8) * 50} className={styles.card}>
                  <Link
                    className={styles.cardLink}
                    to={{ pathname: `/certificates/${c.slug}`, search: location.search }}
                    state={{ fromGrid: true }}
                  >
                    <span className={styles.frame}>
                      {c.image?.url ? (
                        <img className={styles.picture} src={c.image.url} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span aria-hidden="true" className={styles.noPicture}>{c.issuer || c.title}</span>
                      )}
                      <span aria-hidden="true" className={styles.cardLabel}>{cardLabel}</span>
                    </span>
                    <span className={styles.cardTitle}>{c.title}</span>
                    <span className={styles.cardMeta}>
                      {[c.issuer, formatMonthYear(c.issued)].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      {slug && !isLoading && !failed && (
        <CertificateView
          slug={slug}
          list={shown.some((c) => c.slug === slug) ? shown : certificates}
          verifyLabel={sectionText(about, 'certificatesVerify')}
        />
      )}
    </>
  );
}

/**
 * The big view. A modal dialog driven by the URL.
 *
 * ⚠️ The overlay ROOT is the backdrop (CLAUDE.md: two stacked full-size layers
 * — only the top one gets clicks). A click on the root itself closes; a click
 * inside the panel does not.
 *
 * Closing goes BACK when the view was opened from the grid (so history holds
 * no dead entry and Back after close leaves the page), and REPLACES with the
 * grid on a direct visit (a shared link) so Back does not reopen it. Stepping
 * with ← → REPLACES too: Back always closes the view, it never steps back
 * through every certificate looked at.
 */
function CertificateView({ slug, list, verifyLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  const index = list.findIndex((c) => c.slug === slug);
  const cert = index >= 0 ? list[index] : null;
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  const go = (c) => navigate(
    { pathname: `/certificates/${c.slug}`, search: location.search },
    { replace: true, state: location.state },
  );
  const close = () => {
    if (location.state?.fromGrid) navigate(-1);
    else navigate({ pathname: '/certificates', search: location.search }, { replace: true });
  };

  // Keyboard: Esc closes, ← → step, Tab stays inside the dialog.
  // The listener is added once; it reads the latest values through a ref,
  // refreshed after every render.
  const keys = useRef(null);
  useEffect(() => { keys.current = { close, prev, next, go }; });
  useEffect(() => {
    const onKey = (e) => {
      const k = keys.current;
      if (!k) return;
      if (e.key === 'Escape') { e.preventDefault(); k.close(); }
      else if (e.key === 'ArrowLeft' && k.prev) { e.preventDefault(); k.go(k.prev); }
      else if (e.key === 'ArrowRight' && k.next) { e.preventDefault(); k.go(k.next); }
      else if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('a[href], button:not([disabled])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Open: the page behind stops scrolling, focus moves in; closed: both undone.
  useEffect(() => {
    const opener = document.activeElement;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root.style.overflow = before;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Fetch the neighbours' pictures ahead, so ← → never shows an empty frame.
  useEffect(() => {
    [prev, next].forEach((c) => {
      if (c?.image?.url) { const img = new Image(); img.src = c.image.url; }
    });
  }, [prev, next]);

  const titleId = 'certificate-view-title';

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.panelBar}>
          {cert && list.length > 1 && (
            <span className={styles.counter} aria-live="polite">{index + 1} / {list.length}</span>
          )}
          <span className={styles.spacer} />
          <button ref={closeRef} type="button" className={styles.close} onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {!cert ? (
          <div className={styles.notFound}>
            <h2 id={titleId} className={styles.viewTitle}>Certificate not found</h2>
            <p className={styles.viewMeta}>It may have been removed, or the link is mistyped.</p>
          </div>
        ) : (
          <>
            <div className={styles.viewFrame}>
              {cert.image?.url ? (
                <img
                  key={cert._id}
                  className={styles.viewPicture}
                  src={cert.image.url}
                  alt={`${cert.title} certificate`}
                />
              ) : (
                <span aria-hidden="true" className={styles.noPicture}>{cert.issuer || cert.title}</span>
              )}
            </div>

            <div className={styles.viewBody}>
              <div className={styles.viewText}>
                <h2 id={titleId} className={styles.viewTitle}>{cert.title}</h2>
                <p className={styles.viewMeta}>
                  {[
                    cert.issuer,
                    cert.issued && `ISSUED ${formatMonthYear(cert.issued)}`,
                    cert.expires && `EXPIRES ${formatMonthYear(cert.expires)}`,
                  ].filter(Boolean).join(' · ')}
                </p>
                {cert.credentialId && (
                  <p className={styles.viewMeta}>CREDENTIAL ID · <span className={styles.credential}>{cert.credentialId}</span></p>
                )}
              </div>
              {cert.verifyUrl && (
                <a
                  className={styles.verify}
                  href={cert.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${verifyLabel} ${cert.title} (opens in a new tab)`}
                >
                  {verifyLabel} ↗
                </a>
              )}
            </div>

            {list.length > 1 && (
              <div className={styles.stepRow}>
                <button type="button" className={styles.step} disabled={!prev} onClick={() => prev && go(prev)}
                  aria-label={prev ? `Previous: ${prev.title}` : 'Previous'}>
                  ← PREV
                </button>
                <button type="button" className={styles.step} disabled={!next} onClick={() => next && go(next)}
                  aria-label={next ? `Next: ${next.title}` : 'Next'}>
                  NEXT →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CertificatesPage;
