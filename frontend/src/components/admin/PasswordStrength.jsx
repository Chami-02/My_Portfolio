// frontend/src/components/admin/PasswordStrength.jsx
import styles from './PasswordStrength.module.css';

/**
 * PF-124 follow-up — the live strength meter under a new-password field, on
 * the Settings card and the forgot page. Purely presentational: the result
 * comes from `usePasswordStrength`.
 *
 * Four steps from zxcvbn's 0–4 score (0 and 1 are both "weak"). The words are
 * the point, the bar is a glance: the text is in an `aria-live="polite"`
 * region, so a screen reader hears "Strength: good. Add another word…" after
 * typing pauses, and colour is never the only signal.
 */
const LEVELS = [
  { label: 'Weak',   tone: 'weak' },
  { label: 'Weak',   tone: 'weak' },
  { label: 'Fair',   tone: 'fair' },
  { label: 'Good',   tone: 'fair' },
  { label: 'Strong', tone: 'strong' },
];

export function PasswordStrength({ result, id }) {
  if (!result) return null;
  const { label, tone } = LEVELS[result.score];
  const filled = Math.max(1, result.score);

  return (
    <div className={styles.meter} data-tone={tone}>
      <div className={styles.track} aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={styles.step} data-on={step <= filled || undefined} />
        ))}
      </div>
      <p className={styles.text} id={id} aria-live="polite">
        <span className={styles.label}>Strength: {label}.</span>
        {result.problem && <> {result.problem}</>}
      </p>
    </div>
  );
}
