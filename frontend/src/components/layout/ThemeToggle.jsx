// frontend/src/components/layout/ThemeToggle.jsx
import { useTheme } from '../../hooks/useTheme';
import { toggleLabel } from '../../utils/theme';
import styles from './ThemeToggle.module.css';

/**
 * ThemeToggle — structure from PF-72, visuals from PF-79, icon
 * treatment from the 2026-08-22 owner-requested navbar rework.
 *
 * ⚠️ SANCTIONED DEVIATION. The prototype (lines 69-72) renders a 30x15
 * track with a 10px knob plus a "LIGHT MODE" / "DARK MODE" caption.
 * That is replaced here by a 44x44 icon button. docs/design/ is frozen
 * as of 2026-08-22, so the prototype no longer shows the site's real
 * header — CLAUDE.md's Locked decisions is the record that this is
 * intentional, not an un-transcribed value.
 *
 * The icon shows the DESTINATION, not the current state:
 *
 *     light theme → MOON   (clicking goes to dark)
 *     dark  theme → SUN    (clicking goes to light)
 *
 * which is the same direction `toggleLabel()` has always pointed, so
 * the icon and the accessible name agree rather than contradict.
 *
 * ⚠️ No `aria-pressed`. A button whose accessible name is already the
 * action ("Switch to dark theme") plus a pressed state announces an
 * action AND a state pointing opposite directions. Name-changes-on-
 * activate and aria-pressed are alternative patterns for the same
 * thing; running both is the bug. The name is the one kept.
 *
 * ⚠️ 44x44 is chosen to EQUAL the logo, not to be generous. The header's
 * height is set by its tallest child, the logo is 44px, and
 * 12 + 44 + 12 + 2 + 1 = 71 = --header-h, which every section's
 * scroll-margin-top reads. A 48px target would move --header-h and
 * therefore every anchor jump on the site. Re-measure before enlarging.
 */
export function ThemeToggle() {
  const { theme, isLight, toggle } = useTheme();
  const label = `Switch to ${toggleLabel(theme)} theme`;

  return (
    <button
      type="button"
      onClick={toggle}
      className={styles.toggle}
      data-testid="theme-toggle"
      aria-label={label}
      title={label}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

/*
 * The two icon shapes have NO design source — the prototype has no icon
 * here at all. Crescent moon and sun-with-rays is the conventional
 * pairing and is what was chosen; it is owner-decidable rather than
 * settled, and swapping either shape changes nothing else in this file.
 *
 * Sized 18px with stroke-width 1.75 per the request. `aria-hidden` on
 * both: the button's own aria-label is the accessible name, and an
 * exposed <svg> would give it a second one.
 */

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

function SunIcon() {
  return (
    <svg {...ICON_PROPS} className={styles.icon} data-theme-icon="sun">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.6M12 19v2.6M4.4 4.4l1.9 1.9M17.7 17.7l1.9 1.9M2.4 12h2.6M19 12h2.6M4.4 19.6l1.9-1.9M17.7 6.3l1.9-1.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS} className={styles.icon} data-theme-icon="moon">
      <path d="M20.5 14.4A8.6 8.6 0 1 1 9.6 3.5a6.9 6.9 0 0 0 10.9 10.9Z" />
    </svg>
  );
}
