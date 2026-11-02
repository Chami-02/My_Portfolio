import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Reveal } from '../components/motion';
import { useCertificates } from '../hooks/useEntries';
import { formatMonthYear } from '../utils/monthYear';
import styles from './CertificatesPage.module.css';

/**
 * PF-143 — /certificates and /certificates/:slug.
 *
 * The grid is picture cards like the reference site the owner chose
 * (supunsathsara.com/certifications): picture, a VIEW label (owner, 2026-11-02: was VIEW CERTIFICATE), title, issuer.
 * A card opens the BIG VIEW, and beats the reference in four ways the owner
 * agreed to:
 *   • the big view is a URL (/certificates/<slug>), so a certificate can be
 *     shared and the browser's Back closes it;
 *   • ← → and Esc on the keyboard, focus kept inside while it is open;
 *   • the next and previous pictures are fetched ahead, so stepping through
 *     never shows an empty frame (the reference does);
 *   • filter pills by TAG (owner, 2026-11-02): ALL, then every tag a published
 *     certificate carries. ONE pill at a time — a certificate has exactly one
 *     tag, so another pill simply switches; the picked one again, ALL, or a
 *     tap on the page's BACKGROUND shows them all. Kept in the URL (`?tag=`).
 *     Tags are BEHIND THE SCENES: they drive the pills, and are never printed
 *     on a card or in the big view. (A search can come once the list grows.)
 *
 * The ambient layer (starfield, cursor glow, grain) is /blog's, in the same
 * order (owner, 2026-11-02: "same effects same theme" as every other page).
 * Every word on it is fixed (owner, 2026-11-02 — no "Section text" card).
 */
export function CertificatesPage() {
  const { slug } = useParams();
  const query = useCertificates();
  const { data: certificates = [], isLoading } = query;
  const failed = query.isError && query.data === undefined;

  const [searchParams, setSearchParams] = useSearchParams();
  const picked = searchParams.get('tag') ?? '';

  // Arriving here starts at the top; Back restores where the reader was.
  const location = useLocation();
  const didLandingScroll = useRef(false);
  useEffect(() => {
    if (didLandingScroll.current) return;
    didLandingScroll.current = true;
    if (location.state?.fromGrid) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.state]);

  // Case-insensitive, because a tag can arrive from a hand-typed URL.
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const isPicked = (t) => picked !== '' && same(picked, t);
  const allTags = [...new Set(certificates.flatMap((c) => c.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const shown = picked ? certificates.filter((c) => (c.tags ?? []).some(isPicked)) : certificates;

  /** One pill at a time: another switches, the picked one (or null = ALL) clears. */
  const pickTag = (tag) => {
    const next = tag === null || isPicked(tag) ? '' : tag;
    setSearchParams(next ? { tag: next } : {}, { replace: true });
  };

  // A tap on the page's BACKGROUND shows them all again (owner, 2026-11-02):
  // anywhere in this page that is not a control, a link or the big view. One
  // document listener, reading the latest state through a ref.
  const pageRef = useRef(null);
  const reset = useRef(null);
  useEffect(() => { reset.current = picked ? () => pickTag(null) : null; });
  useEffect(() => {
    const onClick = (e) => {
      if (!reset.current || !pageRef.current?.contains(e.target)) return;
      if (e.target.closest('a, button, input, select, textarea, label, [role="dialog"]')) return;
      reset.current();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <PageShell>
      {/* Ambient first: a section that establishes its own stacking context
          sits at the same z-tier as a z-index:0 fixed canvas, and CSS breaks
          that tie by DOM order. */}
      <StarfieldCanvas />
      <CursorGlow />

      <ErrorBoundary>
        <div ref={pageRef}>
          <section className={styles.header}>
            <div className={styles.inner}>
              <Reveal as="h1" type="up" className={styles.heading}>
                Certificates
              </Reveal>
              <Reveal as="p" type="up" delay={60} className={styles.deck}>
                Courses and exams I have passed. Open one to see it full size, and check it with the issuer.
              </Reveal>
              {certificates.length > 0 && (
                <Reveal type="up" delay={120} className={styles.statRow}>
                  <span className={styles.countPill}>
                    <span aria-hidden="true" className={styles.countDot} />
                    {shown.length < certificates.length && `${shown.length} OF `}
                    {certificates.length} {certificates.length === 1 ? 'CERTIFICATE' : 'CERTIFICATES'}
                  </span>
                </Reveal>
              )}
              {allTags.length > 0 && (
                <div className={styles.filters} role="group" aria-label="Filter by tag">
                  {[null, ...allTags].map((tag) => {
                    const on = tag === null ? picked === '' : isPicked(tag);
                    return (
                      <button
                        key={tag ?? 'all'}
                        type="button"
                        className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                        aria-pressed={on}
                        onClick={() => pickTag(tag)}
                      >
                        {tag ?? 'ALL'}
                      </button>
                    );
                  })}
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
                          <span aria-hidden="true" className={styles.cardLabel}>VIEW</span>
                          {c.pinned && <PinBadge />}
                        </span>
                        {/* The card's lower half — the details, on their own surface. */}
                        <span className={styles.cardBody}>
                          <span className={styles.cardTitle}>{c.title}</span>
                          <span className={styles.cardMeta}>
                            {[c.issuer, formatMonthYear(c.issued)].filter(Boolean).join(' · ')}
                          </span>
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
            />
          )}
        </div>
      </ErrorBoundary>

      {/* Last. z-index 70 sits over the page; the big view (z 90) sits over it. */}
      <GrainOverlay />
    </PageShell>
  );
}

/**
 * The small pin in a pinned card's top-left corner (owner, 2026-11-02) — the
 * same 📌 the admin panel uses ("that looks so cool"). Only
 * here — never on the home list. `role="img"` + a label, so a screen reader
 * hears "Pinned" with the card.
 */
function PinBadge() {
  return (
    <span className={styles.pin} role="img" aria-label="Pinned">
      📌
    </span>
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
function CertificateView({ slug, list }) {
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
                {/* Owner, 2026-11-02: the owner's own words, under the details. */}
                {cert.description && <p className={styles.viewDescription}>{cert.description}</p>}
              </div>
              {cert.verifyUrl && (
                <a
                  className={styles.verify}
                  href={cert.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`VERIFY ${cert.title} (opens in a new tab)`}
                >
                  VERIFY ↗
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
