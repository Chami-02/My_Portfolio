import { useState } from 'react';
import styles from './SectionLoadError.module.css';

/**
 * PF-144 (owner, 2026-11-03: "yes fix that too") — a home-page section whose
 * data did not load now SAYS so, with a way forward, instead of quietly
 * hiding its cards. REVERSES the PF-85 choice of a silent section.
 *
 * Small and calm on purpose: one section failing must not make the whole page
 * look broken, so this is a single line in the section's own space, not a
 * banner. `role="status"` (polite) — several sections can fail at once on a
 * bad connection, and a stack of interrupting alerts would be noise.
 *
 * The admin `LoadError`'s rule: a RETRY that fails again must SAY so, or
 * pressing it and seeing the same sentence reads as "the button does nothing".
 *
 * @param what   what did not load, for the sentence ("The projects")
 * @param retry  () => void — refetch every query the section needs
 * @param busy   true while that refetch runs
 */
export function SectionLoadError({ what, retry, busy }) {
  const [retried, setRetried] = useState(false);
  const still = retried && !busy;

  return (
    <div className={styles.box} role="status">
      {/* The red "!" every error carries (owner, 2026-11-03). */}
      <span className={styles.mark} aria-hidden="true">!</span>
      <p className={styles.text}>
        {still
          ? `${what} still didn’t load. Please try again in a minute.`
          : `${what} didn’t load. This is usually temporary.`}
      </p>
      <button
        type="button"
        className={styles.button}
        disabled={busy}
        onClick={() => { setRetried(true); retry(); }}
      >
        {busy ? 'TRYING AGAIN…' : 'TRY AGAIN'}
      </button>
    </div>
  );
}
