import { useMe } from '../../hooks/useMe';
import a from '../../styles/admin.module.css';

/**
 * PF-133 — "your password appeared in a data leak". At every sign-in the
 * server asks Have I Been Pwned about the password just typed (in the
 * background, fails open); a hit sets a flag that `/auth/me` reports as
 * `passwordLeaked`. This banner shows on EVERY admin page until the
 * password changes (owner, 2026-10-29) — NIST SP 800-63B-4: no change on a
 * schedule, but change it on evidence of compromise.
 *
 * A warning, not a lock: the owner is signed in and can act at once.
 * `role="alert"`: unlike a save confirmation, this should interrupt.
 */
export function PasswordLeakBanner({ onChangePassword, className = '' }) {
  const { data: me } = useMe();
  if (!me?.passwordLeaked) return null;

  return (
    <div className={`${a.loadError} ${className}`.trim()} role="alert">
      <span aria-hidden="true" className={a.bannerDot} />
      <span className={a.loadErrorText}>
        YOUR PASSWORD APPEARED IN A KNOWN DATA LEAK. CHANGE IT NOW.
      </span>
      <button type="button" onClick={onChangePassword} className={a.bannerAction}>
        CHANGE PASSWORD
      </button>
    </div>
  );
}
