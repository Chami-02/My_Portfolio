// frontend/src/components/layout/ThemeToggle.jsx
import { useTheme } from '../../hooks/useTheme';
import { toggleLabel } from '../../utils/theme';
import styles from './ThemeToggle.module.css';

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
      <span className={styles.knob} data-theme-knob aria-hidden="true" />
      <span className={styles.label}>{toggleLabel(theme)}</span>
    </button>
  );
}
