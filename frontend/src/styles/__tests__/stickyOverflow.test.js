// frontend/src/styles/__tests__/stickyOverflow.test.js
//
// The standing rule this file enforces, repo-wide:
//
//   NEVER declare `overflow-x: hidden` (or any non-visible `overflow`)
//   on `body`. Use `overflow-x: clip`.
//
// ── WHY, AND WHY A TEST RATHER THAN A COMMENT ───────────────────────────────
//
// `overflow-x: hidden` on <body> makes the body a SCROLL CONTAINER. The body
// box is exactly as tall as its content, so it never actually scrolls — and a
// `position: sticky` descendant sticks relative to its nearest scrollport,
// which is now that never-scrolling body. The sticky element therefore scrolls
// away with the page and nothing anywhere reports an error.
//
// Measured on /admin (1702x952, About tab) before the fix:
//
//   scrollY 1200   admin header  top = -1200   (should be 0)
//   scrollY 1200   admin sidebar top = -1133   (should be 67)
//
// Both are `position: sticky` in AdminLayout.module.css, both had been inert
// since the day they were written, and the public site never showed it because
// its navbar is `position: fixed`. These are the only two `sticky` rules in the
// repo, so the defect had no second witness.
//
// `overflow: clip` clips identically and does NOT establish a scroll container,
// so sticky works. Re-measured after: header top = 0, and
// `document.scrollWidth === clientWidth` still holds on /, /blog and /admin, so
// the horizontal-overflow suppression the rule exists for is intact.
//
// ⚠️ `html` is deliberately NOT covered by this rule and keeps `hidden`. The
// root element's overflow PROPAGATES TO THE VIEWPORT, which is already the
// scroll container, so it costs nothing and has the wider browser support.
//
// ⚠️ PARSED WITH POSTCSS, not matched against raw text. Every one of these
// stylesheets documents the retired `hidden` value in prose right where the
// rule lives — this file's own subject matter guarantees it — so a string
// search would match the COMMENT and pass while asserting nothing. That is the
// documented false-positive that eight test files in this repo carry a
// workaround for.
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = resolve(here, '..');

/** Every global stylesheet — CSS Modules cannot target `body` meaningfully. */
const SHEETS = readdirSync(stylesDir)
  .filter((f) => f.endsWith('.css') && !f.endsWith('.module.css'))
  .map((f) => ({ name: f, css: readFileSync(join(stylesDir, f), 'utf8') }));

/**
 * Every `overflow*` declaration whose selector targets `body`.
 *
 * Returns `{ sheet, selector, prop, value }` rows, so a failure names the file
 * and the selector rather than just asserting a boolean.
 */
function bodyOverflowDeclarations() {
  const found = [];

  for (const { name, css } of SHEETS) {
    postcss.parse(css).walkRules((rule) => {
      // `html, body { … }` counts — split and test each selector on its own.
      const targetsBody = rule.selectors.some((sel) => /(^|[\s,>+~])body\b/.test(sel.trim()));
      if (!targetsBody) return;

      rule.walkDecls(/^overflow(-x|-y)?$/, (decl) => {
        found.push({
          sheet: name,
          selector: rule.selector,
          prop: decl.prop,
          value: decl.value.trim(),
        });
      });
    });
  }

  return found;
}

describe('body overflow and position: sticky', () => {
  it('finds the body overflow declarations at all', () => {
    // ⚠️ The control. Every assertion below is "none of them is `hidden`",
    // which a selector matching NOTHING also satisfies — a vacuous pass that
    // looks identical to a clean one. This is the only check here that fails
    // if the walker breaks.
    const decls = bodyOverflowDeclarations();
    expect(decls.length).toBeGreaterThan(0);
  });

  it('never declares a non-visible overflow on body', () => {
    const offenders = bodyOverflowDeclarations()
      .filter(({ value }) => /\b(hidden|auto|scroll)\b/.test(value));

    expect(
      offenders,
      'A non-visible `overflow` on body makes it a scroll container, which ' +
      'silently disables `position: sticky` on EVERY descendant — the admin ' +
      'header and sidebar both scrolled away for three sprints because of it. ' +
      'Use `overflow-x: clip`, which clips without creating a scrollport.',
    ).toEqual([]);
  });

  it('does clip the horizontal overflow, in every sheet that sets it', () => {
    // The other half. Deleting the declaration outright would also pass the
    // assertion above, and would let the starfield canvas and the marquees
    // produce a horizontal scrollbar on every page.
    const decls = bodyOverflowDeclarations().filter((d) => d.prop === 'overflow-x');

    expect(decls.length).toBeGreaterThan(0);
    decls.forEach(({ sheet, selector, value }) => {
      expect(value, `${sheet} — ${selector}`).toBe('clip');
    });
  });
});

describe('PageShell — the same landmine, one component over', () => {
  // HomePage, BlogPage, BlogPostPage, NotFoundPage and AdminLoginPage all render
  // inside this wrapper, so a non-visible overflow here disables `sticky` across
  // five of the site's six surfaces.
  //
  // ⚠️ Nothing inside it uses sticky today, which is the whole point of pinning
  // it now: the identical declaration on `body` sat harmless-looking for three
  // sprints because the only two sticky elements in the repo happened to be the
  // ones it broke. A guard that waits for a second victim is not a guard.
  //
  // ⚠️ Deliberately scoped to THIS module by name rather than swept across every
  // *.module.css. Plenty of components need `overflow: hidden` legitimately —
  // the marquee bands, the project cards, the blog featured card — and a blanket
  // ban would be wrong for all of them.
  const css = readFileSync(
    resolve(here, '../../components/ambient/PageShell.module.css'),
    'utf8',
  );

  const shell = {};
  postcss.parse(css).walkRules('.shell', (rule) => {
    rule.walkDecls((decl) => { shell[decl.prop] = decl.value.trim(); });
  });

  it('still clips the horizontal overflow', () => {
    expect(shell.position).toBe('relative');     // proves the rule was found
    expect(shell['overflow-x']).toBe('clip');
  });

  it('declares no scrollport-creating overflow', () => {
    ['overflow', 'overflow-x', 'overflow-y'].forEach((prop) => {
      if (shell[prop] === undefined) return;
      expect(shell[prop], `.shell { ${prop} }`).not.toMatch(/\b(hidden|auto|scroll)\b/);
    });
  });
});

describe('the admin shell is the reason the rule exists', () => {
  const adminCss = readFileSync(
    resolve(here, '../../components/admin/AdminLayout.module.css'),
    'utf8',
  );

  const rulesFor = (selector) => {
    const matches = [];
    postcss.parse(adminCss).walkRules((rule) => {
      if (rule.selectors.some((s) => s.trim() === selector)) matches.push(rule);
    });
    return matches;
  };

  const declared = (selector, prop) => {
    const values = [];
    rulesFor(selector).forEach((rule) => {
      rule.walkDecls(prop, (decl) => values.push(decl.value.trim()));
    });
    return values;
  };

  it('sticks the header to the top', () => {
    expect(declared('.header', 'position')).toContain('sticky');
  });

  it('puts the sticky on .sidebarInner, never on the rail itself', () => {
    // ⚠️ The RAIL must not be sticky. An <aside> that is both the painted rail
    // and the sticky box cannot be full-height AND travel — sizing it to its
    // own content is what left the rail ending 1061px short of the bottom of
    // the About panel, which is the defect the owner reported.
    expect(declared('.sidebarInner', 'position')).toContain('sticky');
    expect(declared('.sidebar', 'position')).toEqual([]);
  });

  it('does not pin the grid children to the top of the row', () => {
    // `align-items: start` on .body sizes the rail to its content instead of to
    // the row. Removing it is what lets the rail run the panel's full depth.
    expect(declared('.body', 'align-items')).toEqual([]);
  });

  it('resets both boxes on the mobile strip', () => {
    // Below 899px the sidebar is a horizontal scrolling strip. Resetting only
    // .sidebar would leave a viewport-tall sticky column inside a ~60px strip.
    const mobile = adminCss.slice(adminCss.indexOf('@media (max-width: 899px)'));
    const parsed = postcss.parse(mobile);

    const position = [];
    parsed.walkRules((rule) => {
      if (!rule.selectors.some((s) => s.trim() === '.sidebarInner')) return;
      rule.walkDecls('position', (d) => position.push(d.value.trim()));
    });

    expect(position).toContain('static');
  });
});
