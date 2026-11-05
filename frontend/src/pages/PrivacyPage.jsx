import { useEffect, useRef } from 'react';
import { Link, useNavigationType } from 'react-router-dom';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';
import { sectionHref } from '../utils/nav';
import styles from './PrivacyPage.module.css';

const ADDRESS = 'pcgallege@gmail.com';

/**
 * PF-145 — what the site keeps about a visitor, in the owner's approved words.
 *
 * ⚠️ These are PROMISES about behaviour, not copy. Changing what the counter
 * stores (backend visitController), what the contact form keeps, or which
 * outside service the site uses means changing this page in the same ticket.
 * The words are deliberately not admin-editable.
 */
export function PrivacyPage() {
  // Top of the page on arrival, but never on Back (BlogPage's rule): the
  // footer link that opens this page sits at the very bottom of another.
  const navigationType = useNavigationType();
  const didLandingScroll = useRef(false);
  useEffect(() => {
    if (didLandingScroll.current) return;
    didLandingScroll.current = true;
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigationType]);

  return (
    <PageShell>
      <StarfieldCanvas />
      <CursorGlow />

      <article className={styles.page}>
        <h1 className={styles.heading}>Privacy</h1>
        <p className={styles.lead}>
          This is my personal portfolio. I keep what I collect to a minimum, and
          this page explains all of it.
        </p>

        <h2 className={styles.title}>Visitor counts</h2>
        <p className={styles.text}>
          To see how the site is doing, I count visits as daily totals: how many
          visitors, which pages, country and city (approximate, worked out from
          your IP address), the site you came from, your type of device and
          browser, the hour of the day, and clicks on links like email, CV and
          GitHub. These are totals, like “12 visitors from Sri Lanka today”.
          Nothing records what any one person did. I keep the totals with no end
          date.
        </p>

        <h2 className={styles.title}>Telling visitors apart</h2>
        <p className={styles.text}>
          To avoid counting you twice in a day, your IP address and browser
          details are turned into a scrambled code. The code changes every day
          and is deleted within 2 days, and your IP address is not saved as part
          of the count. This means the numbers are approximate. If your browser
          sends a “do not track” or Global Privacy Control signal, you are not
          counted at all.
        </p>

        <h2 className={styles.title}>Cookies</h2>
        <p className={styles.text}>
          This site uses no cookies for visitors and no advertising or tracking
          scripts. Your browser remembers your light or dark theme and which
          posts you’ve opened this session. That stays on your device.
        </p>

        <h2 className={styles.title}>If you message me</h2>
        <p className={styles.text}>
          I keep your name, email address, message and approximate location, and
          they are emailed to me. They stay until I delete them, and may also be
          in my private backups. To have yours removed, email{' '}
          <a className={styles.link} href={`mailto:${ADDRESS}`}>{ADDRESS}</a>.
        </p>

        <h2 className={styles.title}>Security</h2>
        <p className={styles.text}>
          To stop abuse, your IP address is held for up to an hour as a request
          counter, then deleted automatically. The hosting service’s technical
          logs also record requests for a short time.
        </p>

        <h2 className={styles.title}>Services this site uses</h2>
        <p className={styles.text}>
          Vercel (hosting), MongoDB Atlas (database), Cloudinary (images), Google
          Fonts (fonts), and Resend and Gmail (message emails). Your browser or message
          reaches some of them directly, so they see your IP address and handle
          data under their own privacy policies.
        </p>

        <p className={styles.footnote}>
          Questions? Send an email to: <a className={styles.link} href={`mailto:${ADDRESS}`}>{ADDRESS}</a>
          {' · Or '}<Link className={styles.link} to={sectionHref('/privacy', 'contact')}>send a message</Link>
          <span className={styles.updated}>Last updated: November 2026</span>
        </p>
      </article>

      <GrainOverlay />
    </PageShell>
  );
}

export default PrivacyPage;
