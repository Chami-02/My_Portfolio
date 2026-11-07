/*
 * The site's glowing green "needs you" dot — owner decision 2026-09-16: green
 * (--ok), top-right, pulsing. PF-153 uses it on the Overview card and the sidebar
 * too. `kf-glowdot` is the GLOBAL carrier — the keyframe name cannot be written
 * inline any more than in a module — and the timing is longhands, never the
 * shorthand, which would reset the name. aria-hidden: a number beside it says
 * the same thing in words.
 */
export function UnreadDot({ style }) {
  return (
    <span
      aria-hidden="true"
      data-unread-dot=""
      className="kf-glowdot"
      style={{
        width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', display: 'block', flex: 'none',
        animationDuration: '2.4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        ...style,
      }}
    />
  );
}
