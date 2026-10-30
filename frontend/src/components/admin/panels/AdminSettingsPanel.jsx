// frontend/src/components/admin/panels/AdminSettingsPanel.jsx
import { useMe } from '../../../hooks/useMe';
import { SettingsPasswordCard } from './SettingsPasswordCard';
import { SettingsSessionsCard } from './SettingsSessionsCard';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

/**
 * AdminSettingsPanel — PF-131. The admin's account, security, branding and
 * data, as opposed to About, which is what the site SAYS (owner, 2026-10-13).
 * The prototype has no Settings; the layout is owner-approved 2026-10-27.
 *
 * ⚠️ Only BUILT cards. Sign-in history (PF-133, a second part INSIDE the
 * Sessions card — owner, 2026-10-29) is built; backup (PF-135) arrives when
 * it is. The owner chose this over greyed-out "coming soon" cards: nothing on
 * screen claims a feature that does not exist yet. There is no logo card:
 * PF-134 ships the logo as files, not an upload (owner, 2026-10-30).
 *
 * The Account card is read-only and reads the `/auth/me` entry the shell has
 * already fetched — no request of its own, so nothing to lose and no
 * LoadError: a failed `/auth/me` ends the session (ProtectedRoute redirects)
 * rather than leaving a panel up. The Password card (PF-124) is the first
 * with a form, and registers with the unsaved-changes guard itself. The
 * Sessions card (PF-132) fetches its own list and has its own LoadError.
 */
export function AdminSettingsPanel() {
  const { data: me } = useMe();

  return (
    <div className={a.stack}>
      <section className={a.panel} aria-labelledby="settings-account-title">
        <h2 className={a.panelTitle} id="settings-account-title">Account</h2>
        {/* Nothing address-shaped until /auth/me answers — a placeholder
            address would be the defect the shell's header already avoids. */}
        {me && <AccountFacts me={me} />}
      </section>

      <SettingsPasswordCard />

      <SettingsSessionsCard />
    </div>
  );
}

const METHOD_LABELS = { password: 'Password', google: 'Google' };

function AccountFacts({ me }) {
  // `addresses` arrived with PF-131; a backend from before it sends only the
  // primary, which is still a true (if shorter) answer.
  const addresses = me.addresses ?? [{ address: me.email, primary: true, google: false }];
  const methods = ['Password', ...(addresses.some((x) => x.google) ? ['Google'] : [])];

  return (
    <>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt className={a.labelLead}>Signed in as</dt>
          <dd className={styles.value}>{me.signedInAs ?? me.email}</dd>
        </div>

        {/* PF-131 (owner): HOW this login signed in. A session from before the
            method was recorded says nothing rather than guessing. */}
        {METHOD_LABELS[me.signedInWith] && (
          <div className={styles.fact}>
            <dt className={a.labelLead}>Signed in with</dt>
            <dd className={styles.value}>{METHOD_LABELS[me.signedInWith]}</dd>
          </div>
        )}

        <div className={styles.fact}>
          <dt className={a.labelLead}>Login addresses</dt>
          <dd>
            <ul className={styles.addresses}>
              {addresses.map(({ address, primary, google }) => (
                <li key={address} className={styles.address}>
                  <span className={styles.value}>{address}</span>
                  {primary && <span className={a.badge}>PRIMARY</span>}
                  {google && <span className={a.badgeOk}>GOOGLE LINKED</span>}
                </li>
              ))}
            </ul>
          </dd>
        </div>

        <div className={styles.fact}>
          <dt className={a.labelLead}>Sign-in methods</dt>
          <dd className={styles.value}>{methods.join(' · ')}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        Every address signs in to this one account, with the same password.
      </p>
    </>
  );
}
