// frontend/src/components/motion/Marquee.jsx
import { useReducedMotion } from '../../hooks/useReducedMotion';
import styles from './Marquee.module.css';

/**
 * Infinite scrolling strip — PF-74.
 *
 * @param {number}  duration  seconds for one full cycle
 * @param {boolean} reverse   scroll right-to-left instead
 */
export default function Marquee({
  children,
  duration = 15,
  reverse = false,
  className = '',
  ...rest
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className={`${styles.marquee} ${className}`}
      // Decorative — the content is repeated and carries no
      // information a screen reader should announce twice.
      aria-hidden="true"
      {...rest}
    >
      <div
        className={styles.track}
        style={reduced ? undefined : {
          animationDuration:  `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {/* The -50% translate REQUIRES two copies. See the module CSS. */}
        <div className={styles.group}>{children}</div>
        <div className={styles.group}>{children}</div>
      </div>
    </div>
  );
}
