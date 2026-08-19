// frontend/src/components/layout/ThemeToggle.jsx
import { useTheme } from '../../hooks/useTheme';
import { toggleLabel, themeModeLabel } from '../../utils/theme';
import styles from './ThemeToggle.module.css';

/**
 * ThemeToggle — structure from PF-72, visual treatment from PF-79.
 *
 * PF-72 deliberately shipped this as a structural placeholder and
 * deferred the prototype's exact styling to the navbar rebuild (see
 * the note it left at the top of ThemeToggle.module.css). PF-79 is
 * that rebuild, so the markup now matches the prototype's toggle
 * (lines 69-72): a 30x15 track wrapping a 10px knob, then the label.
 *
 * The knob slide is CSS, driven off html[data-theme] rather than a
 * prop — see the module for why.
 */
export function ThemeToggle() {
  const { theme, isLight, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={styles.toggle}
      data-testid="theme-toggle"
      aria-pressed={isLight}
      aria-label={`Switch to ${toggleLabel(theme)} theme`}
      title={`Switch to ${toggleLabel(theme)} theme`}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.knob} data-theme-knob />
      </span>
      <span className={styles.label}>{themeModeLabel(theme)}</span>
    </button>
  );
}
