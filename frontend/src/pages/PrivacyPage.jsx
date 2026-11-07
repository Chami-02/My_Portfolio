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
import { usePageMeta } from '../hooks/usePageMeta';

const ADDRESS = 'pcgallege@gmail.com';

/**
 * PF-145 — what the site keeps about a visitor. PF-153 (owner, 2026-11-07):
 * written to the visitor, "you" always meaning them, and shaped like a
 * professional policy: the questions GDPR Articles 13–14 expect a notice to answer.
 *
 * ⚠️ These are PROMISES about behaviour, not copy. Changing what the counter
 * stores (backend visitController), what the contact form keeps, or which
 * outside service the site uses means changing this page in the same ticket.
 * The words are deliberately not admin-editable.
 */
export function PrivacyPage() {
  usePageMeta({
    title: 'Privacy',
    description: 'What happens to your information when you visit this website, and the choices you have.',
    path: '/privacy',
  });

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
          This page explains what happens to your information when you visit
          this website: what is collected, why, how long it is kept, and the
          choices you have.
        </p>

        <h2 className={styles.title}>Who runs this website</h2>
        <p className={styles.text}>
          This is the personal portfolio of Parindra Gallage, who is responsible
          for your information here. You can ask anything about this policy at{' '}
          <a className={styles.link} href={`mailto:${ADDRESS}`}>{ADDRESS}</a>.
        </p>

        <h2 className={styles.title}>What is collected when you visit</h2>
        <p className={styles.text}>
          Your visit is added to daily totals, such as “12 visitors from Sri
          Lanka today”. Each total is counted separately, so nothing records
          what you personally did on the site. The totals cover:
        </p>
        <ul className={styles.list}>
          <li>your approximate country and city, worked out from your IP address</li>
          <li>the pages you open, and the sections of the home page you reach</li>
          <li>the website you came from (its name only, not the full address)</li>
          <li>your type of device and browser, and the hour of the day</li>
          <li>your clicks on links such as email, CV and GitHub</li>
          <li>the blog posts you read</li>
        </ul>
        <p className={styles.text}>
          Your visit is counted once you have stayed about 10 seconds, opened a
          second page, clicked one of those links or read a post. A post counts
          as read once it has been on your screen for about 6 seconds, and only
          once a day for each post.
        </p>
        <p className={styles.text}>
          Some totals are public. The home page shows total visits, how many
          countries visitors came from, countries with at least 5 visits, the
          most viewed projects and posts, and total blog reads. The rest stay
          private.
        </p>

        <h2 className={styles.title}>How you are told apart from other visitors</h2>
        <p className={styles.text}>
          So that you are not counted twice in a day, your IP address and browser
          details are turned into a scrambled code, and your IP address into a
          second code used to limit fake visits from any one network. Both codes
          change every day and are deleted within 2 days. Your IP address is not
          saved as part of the count. While you are on the site, the first code
          is also kept for about 5 minutes after you open a page, to show how
          many people are here right now.
        </p>
        <p className={styles.text}>
          These numbers are approximate. For example, a large shared network may
          be undercounted, and your phone and laptop count as two visits.
        </p>

        <h2 className={styles.title}>Your choice not to be counted</h2>
        <p className={styles.text}>
          If your browser sends a “do not track” or Global Privacy Control
          signal, you are not counted at all. The site works exactly the same for
          you.
        </p>

        <h2 className={styles.title}>If you send a message</h2>
        <p className={styles.text}>
          When you use the contact form, your name, email address, message and
          approximate location are stored and emailed to the site owner, so that
          you can receive a reply. Any reply is emailed to you from this site’s
          address and kept with your message. Sending a message is your choice,
          and the rest of the site works without it.
        </p>

        <h2 className={styles.title}>Cookies and browser storage</h2>
        <p className={styles.text}>
          This site uses no cookies for visitors and no advertising or tracking
          scripts. Your browser remembers your light or dark theme and which
          posts you’ve opened this session. That stays on your device, and you
          can clear it at any time in your browser’s settings.
        </p>

        <h2 className={styles.title}>Why your information is used</h2>
        <ul className={styles.list}>
          <li>
            <strong className={styles.term}>Visitor totals and security:</strong>{' '}
            the legitimate interest in understanding how the site is used and
            keeping it safe, with as little information as possible.
          </li>
          <li>
            <strong className={styles.term}>Your message:</strong> to answer you,
            because you asked for contact.
          </li>
        </ul>
        <p className={styles.text}>
          Your information is never sold, never used for advertising, and never
          used to make automated decisions about you.
        </p>

        <h2 className={styles.title}>How long your information is kept</h2>
        <ul className={styles.list}>
          <li>Daily totals: with no end date, since they cannot identify you</li>
          <li>Scrambled visitor codes: deleted within 2 days</li>
          <li>Your IP address in the request limit: up to an hour</li>
          <li>Your message: until it is deleted, and it may also remain in private backups</li>
        </ul>

        <h2 className={styles.title}>Security</h2>
        <p className={styles.text}>
          Your connection to this site is encrypted. To stop abuse, your IP
          address is held for up to an hour as a request counter, then deleted
          automatically. The hosting service’s technical logs also record
          requests for a short time. No website can promise perfect security.
        </p>

        <h2 className={styles.title}>Services that handle your information</h2>
        <p className={styles.text}>
          The site relies on Vercel (hosting), MongoDB Atlas (database),
          Cloudinary (images), Google Fonts (fonts), and Resend and Gmail
          (message emails). Your browser or message reaches some of them
          directly, so they see your IP address and handle data under their own
          privacy policies. They may process it outside your country.
        </p>

        <h2 className={styles.title}>Your rights</h2>
        <p className={styles.text}>
          Depending on where you live, you may have the right to:
        </p>
        <ul className={styles.list}>
          <li>ask for a copy of the information held about you</li>
          <li>have it corrected or deleted</li>
          <li>object to how it is used, or ask for its use to be limited</li>
          <li>complain to your local data protection authority</li>
        </ul>
        <p className={styles.text}>
          To use these rights, email{' '}
          <a className={styles.link} href={`mailto:${ADDRESS}`}>{ADDRESS}</a>.
          You will get an answer within one month. This mainly applies to
          messages you have sent: visitor totals and scrambled codes cannot be
          traced back to you, so they cannot be looked up or removed for one
          person.
        </p>

        <h2 className={styles.title}>Children</h2>
        <p className={styles.text}>
          This site is not aimed at children under 16. If you are under 16,
          please do not send personal information through the contact form.
        </p>

        <h2 className={styles.title}>Changes to this policy</h2>
        <p className={styles.text}>
          If what the site collects changes, this page changes with it, and the
          date below shows the latest version.
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
