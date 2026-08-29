// frontend/src/components/icons/BrandIcons.jsx
/**
 * Brand and action glyphs — owner-requested 2026-08-29.
 *
 * ⚠️ NO PROTOTYPE SOURCE. `docs/design/*.dc.html` puts no icon on any of
 * these links; every one is a bare text label, three of them with a
 * trailing "→" / "↗" / "↓" character. So this whole module is a
 * sanctioned deviation, recorded in CLAUDE.md's Locked decisions, and a
 * fidelity pass diffing against the export WILL flag every call site.
 *
 * ── Why inline SVG rather than `public/icons.svg` ────────────────────
 * That sprite exists and has ZERO consumers (checked, not assumed). It
 * is also unusable here: every path in it is `fill="#08060d"` or
 * `stroke="#aa3bff"` — hardcoded, so a symbol would stay near-black on a
 * near-black dark theme and would not follow a link's hover colour. The
 * repo's own precedent is ThemeToggle.jsx: inline <svg>, `currentColor`,
 * `aria-hidden`. That is what these follow.
 *
 * ── currentColor is the whole of the theming ─────────────────────────
 * Every icon inherits `color` from its link, so it tracks the theme, the
 * hover state and the PF-91 contrast work for free — no theme-scoped
 * rule, and no chance of the brown-smudge trap that a hardcoded accent
 * causes in light theme (see ScrollToTop's glow in CLAUDE.md).
 *
 * ── aria-hidden on all of them, without exception ────────────────────
 * Each icon sits beside a text label that already names the destination
 * ("GITHUB", "LinkedIn ↗"). An exposed <svg> would give every one of
 * these links a duplicated accessible name. Same call PF-83 made for the
 * splash and footer logos.
 *
 * `flexShrink: 0` is inline rather than in a module: these render into
 * five different modules' flex rows, and a shrunk-to-nothing icon is a
 * silent failure — the link still reads correctly with the glyph
 * squashed to 0px wide.
 */

/** Shared across every glyph. Filled marks, so no stroke props. */
const base = (size) => ({
  width: size,
  height: size,
  fill: 'currentColor',
  focusable: 'false',
  'aria-hidden': 'true',
  style: { flexShrink: 0 },
});

/**
 * Envelope — the international mail glyph (Material Design's `email`,
 * public domain). Not a brand mark: it fronts `mailto:` links in About,
 * Contact and the footer.
 */
export function MailIcon({ size = 16, className }) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

/** GitHub's official Octocat mark. 16-unit viewBox — the mark's own. */
export function GitHubIcon({ size = 16, className }) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** LinkedIn's official "in" mark. */
export function LinkedInIcon({ size = 16, className }) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.36 4.26 5.44v6.3zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Facebook's official "f" mark. */
export function FacebookIcon({ size = 16, className }) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
    </svg>
  );
}

/** Instagram's official glyph — three subpaths, one <path> each. */
export function InstagramIcon({ size = 16, className }) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.39A5.85 5.85 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.39 2.12a5.85 5.85 0 0 0 2.12 1.39c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.12-1.39a5.85 5.85 0 0 0 1.39-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.85 5.85 0 0 0-1.39-2.12A5.85 5.85 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z" />
      <path d="M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8" />
      <path d="M18.41 4.15a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88" />
    </svg>
  );
}
