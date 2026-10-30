// frontend/src/components/admin/panels/AdminSettingsPanel.jsx
import { useState } from 'react';
import { useMe } from '../../../hooks/useMe';
import { SettingsPasswordCard } from './SettingsPasswordCard';
import { SettingsSessionsCard } from './SettingsSessionsCard';
import { SettingsBackupCard }   from './SettingsBackupCard';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

/**
 * AdminSettingsPanel — PF-131. The admin's account, security, branding and
 * data, as opposed to About, which is what the site SAYS (owner, 2026-10-13).
 * The prototype has no Settings; the layout is owner-approved 2026-10-27.
 *
 * ⚠️ Only BUILT cards. Sign-in history (PF-133) is a second part INSIDE the
 * Sessions card (owner, 2026-10-29); Backup (PF-135) is the last card. The
 * owner chose this over greyed-out "coming soon" cards: nothing on
 * screen claims a feature that does not exist yet. There is no logo card:
 * PF-134 ships the logo as files, not an upload (owner, 2026-10-30).
 *
 * The Account card is read-only and reads the `/auth/me` entry the shell has
 * already fetched — no request of its own, so nothing to lose and no
 * LoadError: a failed `/auth/me` ends the session (ProtectedRoute redirects)
 * rather than leaving a panel up. The Password card (PF-124) is the first
 * with a form, and registers with the unsaved-changes guard itself. The
 * Sessions card (PF-132) fetches its own list and has its own LoadError.
 * The Backup card (PF-135) fetches only when asked, behind the password.
 */
export function AdminSettingsPanel() {
  const { data: me } = useMe();
  const [folded, setFolded] = useState(true);

  return (
    <div className={a.stack}>
      {/* FOLDS like every Settings card (owner, 2026-10-30), with the same
          classes. Folded, it still says which address this login used — the
          one fact worth seeing at a glance (as Password shows LAST CHANGED). */}
      <section className={a.panel} aria-labelledby="settings-account-title">
        <div className={styles.disclosureHead}>
          <h2 className={a.panelTitle} id="settings-account-title">Account</h2>
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={!folded}
            aria-controls="settings-account-body"
            onClick={() => setFolded((f) => !f)}
          >
            VIEW DETAILS
            <span className={styles.chevron} aria-hidden="true">▾</span>
          </button>
        </div>
        {/* Nothing address-shaped until /auth/me answers — a placeholder
            address would be the defect the shell's header already avoids. */}
        {/* Folded only: opened, the same fact heads the details below. */}
        {me && folded && <p className={styles.lastChanged}>SIGNED IN AS {me.signedInAs ?? me.email}</p>}
        <div
          id="settings-account-body"
          className={`${styles.collapse} ${folded ? '' : styles.collapseOpen}`}
          inert={folded}
        >
          <div className={styles.collapseInner}>
            <div className={styles.foldBody}>
              {me && <AccountFacts me={me} />}
            </div>
          </div>
        </div>
      </section>

      <SettingsPasswordCard />

      <SettingsSessionsCard />

      <SettingsBackupCard />
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
