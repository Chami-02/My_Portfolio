import { useLogo } from '../../hooks/useLogo';
import styles from './BrandMark.module.css';

/**
 * The floating logo with its pulsing ring — Admin.dc.html:55-57.
 *
 * PF-130. The sign-in card had it alone; the loading screen wears it too,
 * so it lives here and both compose it. Its stylesheet sits in the MAIN
 * bundle (App's Suspense fallback renders it), which is why it is not
 * composed from AdminLoginPage.module.css: that would pull the whole
 * login sheet back into main and undo part of PF-127.
 *
 * `alt` is the caller's: the login card names the owner, the loading
 * screen passes "" because its label already says everything.
 */
export function BrandMark({ alt }) {
  const logo = useLogo();
  return (
    <span className={styles.wrap}>
      <span aria-hidden="true" className={styles.ring} />
      <img src={logo} alt={alt} width="54" height="54" className={styles.logo} />
    </span>
  );
}
