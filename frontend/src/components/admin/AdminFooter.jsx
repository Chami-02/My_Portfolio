// frontend/src/components/admin/AdminFooter.jsx
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';
import styles from './AdminFooter.module.css';

/**
 * AdminFooter — PF-107. Transcribed from Admin.dc.html:572-601.
 *
 * New: the shipped admin panel has never had a footer. It repeats the
 * two controls that matter most on a long editing page — get back to
 * the site, and sign out — at the bottom, where a header sticky at the
 * top of a 2,000px form is not where your hands are.
 *
 * ⚠️ `← BACK TO HOME PAGE` is a react-router <Link>, not an <a>. A
 * plain anchor is a full document load, which discards the TanStack
 * Query cache and re-fetches the two unoptimised hero images
 * (1.4MB + 2.3MB). `?nosplash=1` matches what Navbar sends from every
 * non-home route.
 *
 * ⚠️ There are now TWO "sign out" controls on the page, this one and
 * the header's. That is the prototype's own structure and is ordinary
 * top-and-bottom repetition, the same shape as the reading view's two
 * `← ALL POSTS` controls — not the one-name-two-links defect PF-99
 * renamed. E2E naming which one it means uses .first() / .last().
 */
export function AdminFooter({ email, counts, onSignOut }) {
  const footerCounts = [
    `${counts.projects} PROJECTS`,
    `${counts.skills} SKILLS`,
    `${counts.published} POSTS`,
    `${counts.unread} UNREAD`,
  ].join(' · ');

  return (
    <footer className={styles.footer}>
      <span aria-hidden="true" className={styles.hairline} />

      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <div className={styles.brandRow}>
            {/* alt="" — the name sits beside it as real text, so a
                description here would be read out twice. */}
            <img src={logo} alt="" width="42" height="42" className={styles.logo} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>
                Parindra <span className={styles.brandAccent}>Gallage</span>
              </span>
              <span className={styles.brandSub}>PORTFOLIO CMS</span>
            </span>
          </div>
          <p className={styles.description}>
            Content control room for parindra.dev — projects, skills, profile,
            writing and inbound messages.
          </p>
        </div>

        <div className={styles.sessionCol}>
          <span className={styles.sessionLabel}>SESSION</span>
          <span className={styles.sessionLine}>
            <span aria-hidden="true" className={styles.sessionDot} />
            {email ? `Signed in · ${email}` : 'Signed in'}
          </span>
          <span className={styles.sessionCounts}>{footerCounts}</span>
        </div>

        <div className={styles.actions}>
          <Link to="/?nosplash=1" className={styles.backLink}>
            ← BACK TO HOME PAGE
          </Link>
          {/* type="button" — not inside a form today, but a panel form
              growing to wrap the shell is exactly the accident that made
              AdminBlogPanel's "Yes, Remove" also save and close the post.
              A button with no type IS a submit button. */}
          <button type="button" onClick={onSignOut} className={styles.signOut}>
            ⏻ SIGN OUT
          </button>
        </div>
      </div>

      <div className={styles.legal}>
        <span className={styles.legalText}>
          © {new Date().getFullYear()} PARINDRA GALLAGE — PORTFOLIO CMS
        </span>
      </div>
    </footer>
  );
}
