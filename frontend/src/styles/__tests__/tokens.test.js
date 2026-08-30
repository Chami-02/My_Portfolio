// frontend/src/styles/__tests__/tokens.test.js
import { readFileSync } from 'fs';
import postcss from 'postcss';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css  = readFileSync(resolve(here, '../tokens.css'), 'utf8');

const FLAT = [
  '--acc', '--acc2', '--acc2rgb', '--accInk',
  '--bg', '--text', '--strong', '--muted', '--muted2', '--faint', '--thumb',
  '--navy', '--ink', '--grey',
  '--ok', '--danger',
];

const TRIPLETS = ['--gnd', '--srf', '--ln', '--ftr', '--shd'];

// Everything that must be redefined for the light theme
const LIGHT_OVERRIDES = [
  '--acc', '--acc2', '--acc2rgb', '--accInk',
  '--bg', '--text', '--strong', '--muted', '--muted2', '--faint', '--thumb',
  '--gnd', '--srf', '--ln', '--ftr', '--shd',
  '--ok', '--danger',
];

const lightBlock = css.slice(css.indexOf('html[data-theme="light"]'));

describe('Design tokens (PF-67)', () => {

  it.each(FLAT)('defines %s in the dark theme', (token) => {
    expect(css).toMatch(new RegExp(`${token}\\s*:`));
  });

  it.each(TRIPLETS)('defines %s in the dark theme', (token) => {
    expect(css).toMatch(new RegExp(`${token}\\s*:`));
  });

  it.each(LIGHT_OVERRIDES)('overrides %s in the light theme', (token) => {
    expect(lightBlock).toMatch(new RegExp(`${token}\\s*:`));
  });

  // The critical one — a triplet written as hex breaks every
  // translucent surface, and rgba(#hex, .5) fails silently.
  it.each(TRIPLETS)('%s is a bare R,G,B triplet, not a hex', (token) => {
    const matches = [...css.matchAll(new RegExp(`${token}\\s*:\\s*([^;]+);`, 'g'))];

    expect(matches.length).toBeGreaterThan(0);

    for (const [, value] of matches) {
      expect(value.trim()).not.toMatch(/^#/);
      expect(value.trim()).toMatch(/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/);
    }
  });

  it('warms the light-theme whites rather than using pure white', () => {
    expect(lightBlock).toMatch(/--gnd:\s*251,\s*248,\s*243/);
    expect(lightBlock).toMatch(/--srf:\s*254,\s*252,\s*248/);
  });

  it('deepens the light accent and flips the ink', () => {
    expect(lightBlock).toMatch(/--acc:\s*#7E4800/i);
    expect(lightBlock).toMatch(/--accInk:\s*#ffffff/i);
  });

  it('publishes --header-h for sections to offset their anchor jumps (PF-79)', () => {
    // 12px padding + 44px logo + 12px padding + 2px progress track +
    // 1px bottom border. Confirmed against the rendered header's
    // getBoundingClientRect().height in Chromium — the border is the
    // easy pixel to lose, and a --header-h that is short by one lands
    // every section heading a hair under the fixed header with no
    // error to show for it.
    expect(css).toMatch(/--header-h:\s*71px/);
  });

  /* ── The Phase 1 light-theme bridge is GONE — PF-89 (2026-08-26) ────
   * Three guards went with it: that the block existed, that it covered
   * all three sections, and that it mapped onto Phase 2 tokens. All
   * three asserted the shape of a rule that no longer exists.
   *
   * ⚠️ THE FOURTH ONE STAYS, and the PF-89 ticket was wrong to bundle it
   * with the other three. It never asserted anything ABOUT the bridge —
   * it asserts that tokens.css's `html[data-theme="light"]` block does
   * NOT redefine Phase 1's property names. That hazard is untouched by
   * the bridge's removal, because /admin still reads global.css's `:root`
   * for every one of them. Anyone "simplifying" the removed bridge by
   * hoisting its declarations into the unscoped light block would put
   * near-paper text on the admin panels' un-flipped dark surfaces — the
   * identical bug, moved to a page with no test coverage.
   *
   * If anything, it is worth MORE now: PF-89 measured /admin and
   * /admin/login rendering at 1.11:1 in light theme already, because
   * `--bg` is the one Phase 1 name tokens.css also declares, so the
   * ground under those pages flips while the ink on it does not.
   */
  describe('Phase 1 tokens are never redefined unscoped (protects /admin)', () => {
    // Comments stripped. tokens.css now documents the REMOVED bridge in
    // prose, naming every one of these properties, so a raw-text search
    // matches the epitaph instead of a declaration and reports PASS.
    // See CLAUDE.md's Silent-failures entry on comment-matching.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

    it('the light theme block redefines no Phase 1 property name', () => {
      const unscoped = stripped.match(/html\[data-theme="light"\]\s*\{[\s\S]*?\n\}/);
      expect(unscoped).not.toBeNull();
      ['--text-primary', '--text-body', '--text-muted', '--bg-surface', '--accent', '--border']
        .forEach((t) => expect(unscoped[0]).not.toContain(t));
    });

    it('no bridge rule survives anywhere in the file', () => {
      expect(stripped).not.toMatch(/html\[data-theme="light"\]\s*#(projects|blog|contact)/);
    });
  });

  describe('Focus indicators (PF-83)', () => {
    /**
     * ⚠️ Comments stripped, and here that is not a precaution — the
     * block's own prose contains "border-radius", "999px", "4px",
     * ":focus" and the word "input" while explaining what it must NOT
     * do. Every negative assertion below would match the explanation
     * instead of the rule and report PASS. See CLAUDE.md's
     * Silent-failures entry on raw-text CSS assertions matching
     * comments.
     */
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const start = stripped.indexOf('a:focus-visible');
    const rule = start === -1
      ? ''
      : stripped.slice(start, stripped.indexOf('}', start) + 1);

    it('declares the rule at all', () => {
      // Guards the slice itself. Every other test here reads `rule`, and
      // an empty string satisfies all four negative assertions below — so
      // deleting the block outright would turn those green rather than red.
      expect(start).toBeGreaterThan(-1);
      expect(rule).not.toBe('');
    });

    it('rings links, buttons and anything explicitly tabbable', () => {
      expect(rule).toContain('a:focus-visible');
      expect(rule).toContain('button:focus-visible');
      expect(rule).toContain('[tabindex]');
      expect(rule).toContain(':focus-visible');
    });

    /**
     * PF-91. A negative tabindex means "programmatically focusable,
     * NEVER a tab stop", so such an element is only ever focused as a
     * scroll/reading-position target — <main>, focused by the skip link,
     * is the one case in this repo. A bare `[tabindex]:focus-visible`
     * matches it and drew a 2px accent ring around the ENTIRE page the
     * moment the skip link was activated.
     *
     * ⚠️ The obvious-looking cause is wrong and worth recording: the
     * ring is NOT because :focus-visible fails to distinguish
     * programmatic focus. Chromium keys the heuristic on the most recent
     * input MODALITY, and the link is activated with Enter — so a
     * programmatic .focus() following a keypress does match. Measured in
     * Chromium: main.matches(':focus-visible') === true.
     */
    it('excludes tabindex="-1" so the skip link does not ring the whole page', () => {
      expect(rule).toContain('[tabindex]:not([tabindex="-1"]):focus-visible');
      // the ring rule itself must never reach for outline:none
      expect(rule).not.toMatch(/outline:\s*none/);
    });

    /**
     * PF-91. Excluding tabindex="-1" above stops OUR ring, not
     * Chromium's: measured, <main> then took `outline: auto 1px
     * rgb(0, 95, 204)`, the UA default, so the skip link drew a blue box
     * around the whole page. Only an explicit suppression removes it.
     *
     * This is the repo's first `outline: none` and the selector is what
     * keeps it safe — it must stay pinned to <main>, which a negative
     * tabindex keeps out of the tab order entirely. A widened selector
     * would start stripping indicators off real controls, silently.
     */
    it('suppresses the UA ring on <main> ONLY, never on a control', () => {
      const decls = stripped.replace(/\s+/g, ' ');

      // Exactly ONE suppression in the whole file...
      const all = decls.match(/outline:\s*(none|0)\b/g) || [];
      expect(all).toHaveLength(1);

      // ...and it belongs to exactly this selector. Extracting the
      // selector is what makes this un-foolable: a `not.toMatch` for
      // element names is not, because `main` contains an `a` and a
      // naive /(a|button|...)/ alternation matches its own rule. That
      // false positive is how this guard was written the first time.
      const owner = decls.match(/([^{};]+)\{[^{}]*outline:\s*(?:none|0)\b/);
      expect(owner).not.toBeNull();
      expect(owner[1].trim()).toBe('main[tabindex="-1"]:focus');
    });

    it('draws an accent outline offset outward', () => {
      expect(rule).toContain('outline: 2px solid var(--acc)');
      expect(rule).toContain('outline-offset: 3px');
    });

    /**
     * The load-bearing negative. The ticket's sketch carried
     * `border-radius: 4px` in this rule. Outlines already follow the
     * element's own border curve in every current engine, so a radius
     * here does not shape the ring — it overwrites the ELEMENT's radius
     * while focused. The navbar CONTACT pill and both hero CTAs are
     * `border-radius: 999px`, so 4px visibly squares them off the moment
     * they take keyboard focus, and only then. Nothing errors, and a
     * mouse user never sees it.
     */
    it('never sets border-radius, which would square off the 999px pills', () => {
      expect(rule).not.toContain('border-radius');
    });

    /**
     * Contact's three inputs are the prototype's ONLY focus styling
     * (lines 518/522/527) and use a border-color shift. Sprint 12 should
     * transcribe that; a global ring reaching form controls now would
     * either fight it or silently pre-empt it.
     */
    it('leaves form controls to Sprint 12 rather than claiming them', () => {
      expect(rule).not.toMatch(/\b(input|textarea|select):focus/);
    });

    it('uses :focus-visible so a mouse click leaves no ring behind', () => {
      // A bare `a:focus` selector in this rule would ring every clicked
      // link. Checked against the stripped text, so the phrase
      // ":focus-visible, not :focus" in the comment cannot satisfy it.
      expect(rule).not.toMatch(/(^|[^-])\ba:focus\s*[,{]/);
      expect(rule).not.toMatch(/\bbutton:focus\s*[,{]/);
    });
  });


  /*
   * ── PF-91 · --ok and --danger ──────────────────────────────────────
   *
   * Both were declared in PF-67 and read by NOTHING but Tailwind's alias
   * for three sprints, while four sites hardcoded the same pair of hexes
   * — and two of those shipped a light-theme failure the token would
   * have prevented. PF-91 gave them their first consumers.
   *
   * --ok's light value is #0B6446, not the prototype's #0E7A55, and the
   * framing matters: applyTheme() line 868 ALREADY recolours [data-ok]
   * from #34d399 to #0E7A55 in light. The design saw this and moved the
   * value; it just landed short — 3.67 on the AVAILABLE FOR WORK badge,
   * 4.43 on the status dot, against 4.5. This extends a fix the design
   * started rather than correcting an oversight.
   *
   * --danger is UNCHANGED. #B4231F is the prototype's own light value
   * and measures 5.88 on the Contact form; it was failing only because
   * the literal #f87171 bypassed it.
   */
  describe('status tokens (PF-91)', () => {
    const valuesOf = (name) => {
      const out = [];
      postcss.parse(css).walkDecls(name, (d) => out.push(d.value.trim()));
      return out;
    };

    it('declares --ok once per theme, with DIFFERENT values', () => {
      const ok = valuesOf('--ok');
      expect(ok).toEqual(['#34d399', '#0B6446']);
    });

    it('keeps --danger on the prototype\'s own pair', () => {
      expect(valuesOf('--danger')).toEqual(['#f87171', '#B4231F']);
    });

    it('does not leave --ok light on #0E7A55, which measured 3.67', () => {
      // The design's own value, and short of AA on the badge. Pinned so
      // a fidelity pass "restoring" it fails loudly rather than
      // reintroducing the failure it looks like it is fixing.
      expect(valuesOf('--ok')).not.toContain('#0E7A55');
    });
  });

});
