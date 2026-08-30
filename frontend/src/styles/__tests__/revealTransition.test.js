// frontend/src/styles/__tests__/revealTransition.test.js
//
// PF-93, 2026-08-21. The standing rule, enforced repo-wide:
//
//   NEVER declare a `transition` on a Reveal-wrapped element.
//   Not gated. Not at all.
//
// `Reveal` puts its own class on the element it renders and drives the
// entrance with `transition`. One element has one `transition` property,
// so a section class declaring another does not merge with Reveal's — it
// replaces it outright, and the entrance animates on the hover values.
//
// ⚠️ Between 2026-08-17 and 2026-08-21 this file's rule was different: it
// said to GATE the hover transition behind `[data-reveal='in']`. That
// remedy does not work, and four elements shipped with it. `Reveal` sets
// data-reveal="in" from the IntersectionObserver callback at the moment
// the element INTERSECTS (Reveal.jsx:57) — the START of the entrance, not
// its end; it has to, because `.reveal[data-reveal='in']` is the state
// being transitioned TO. So the gate matched immediately and handed each
// element its hover transition for the whole entrance. Measured on the
// production build, before the fix:
//
//   About .statCard    opacity 1 at 0ms (no fade), slide done at 283ms
//   Skills .card       opacity 1 at 0ms,           slide done at 300ms
//   Hero .rolePill     opacity 1 at 0ms,           pop   done at 448ms
//   Hero .loudCta      opacity 1 at 0ms,           pop   done at 301ms
//   Projects .card     opacity 1 at 766ms, slide done at 732ms  ← never gated
//
// The last row is the control: it declares no transition and is correct.
//
// Deleting rather than gating is also what the prototype does. Its
// hideReveals() (Portfolio Revolution.dc.html:950) writes the transition
// as an INLINE style onto every [data-reveal] element and showEl() never
// clears it, so one declaration covers the entrance AND every later
// property change — including a :hover lift. Declaring none in CSS
// reproduces that exactly, because `.reveal` never leaves the element.
//
// Consequence to record rather than "fix": a hover `border-color`,
// `background` or `box-shadow` SNAPS, because only `opacity` and
// `transform` are in Reveal's list. That is the design's behaviour.
//
// Two guards. The first is structural — it reads the JSX to find out
// which classes are actually Reveal-wrapped, so it catches a NEW element
// added to any section, not just the four that were fixed. The second
// catches the specific dead pattern by name, so it cannot be reintroduced
// by someone working from a pre-PF-93 ticket.
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../..');

/** Every *.module.css under src/, as { path, css }. */
function modules(dir = src, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) modules(full, out);
    else if (entry.name.endsWith('.module.css')) {
      out.push({ path: full.slice(src.length + 1), css: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

/** Every *.jsx under src/components, excluding test files. */
function components(dir = join(src, 'components'), out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') components(full, out);
    } else if (entry.name.endsWith('.jsx')) {
      out.push({ path: full, rel: full.slice(src.length + 1), jsx: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

/**
 * Local class names passed to a <Reveal> in this file.
 *
 * Scans each `<Reveal` opening tag up to its first `>` — Reveal is
 * always used with a closing tag or self-closed, and none of its props
 * contain a bare `>` — then pulls every `styles.NAME` out of whatever
 * `className={…}` it carries. That covers the bare form
 * `className={styles.card}` and the template-literal form
 * `className={`${styles.a} ${styles.b}`}` alike, without needing a JSX
 * parser.
 */
function revealClasses(jsx) {
  const found = new Set();
  const tag = /<Reveal\b[\s\S]*?>/g;
  let m;
  while ((m = tag.exec(jsx)) !== null) {
    const cn = m[0].match(/className=\{([\s\S]*?)\}\s*(?:\n|\/?>|[a-zA-Z-]+=)/);
    const scan = cn ? cn[1] : '';
    for (const s of scan.matchAll(/styles\.([A-Za-z0-9_]+)/g)) found.add(s[1]);
  }
  return [...found];
}

/** Rules in `css` whose selector targets `.name` and declare a transition. */
function transitionRulesFor(css, name) {
  // (?![\w-]) so `.card` does not match `.cardPlaceholder` or `.card-x`.
  const targets = new RegExp(`\\.${name}(?![\\w-])`);
  const hits = [];
  postcss.parse(css).walkRules((rule) => {
    if (!targets.test(rule.selector)) return;
    rule.walkDecls(/^transition/, (d) => {
      hits.push(`${rule.selector} { ${d.prop}: ${d.value} }`);
    });
  });
  return hits;
}

describe('Reveal-wrapped elements never declare their own transition', () => {
  // The pairs this walks, so a failure names something real rather than
  // an empty set — and so a broken scanner shows up as 0 instead of
  // silently passing. A probe that finds nothing also reports "no
  // offenders"; the count is what tells the two apart.
  const pairs = [];
  for (const c of components()) {
    const names = revealClasses(c.jsx);
    if (!names.length) continue;
    const modulePath = c.path.replace(/\.jsx$/, '.module.css');
    let css;
    try {
      css = readFileSync(modulePath, 'utf8');
    } catch {
      continue; // a section with no module of its own
    }
    for (const name of names) pairs.push({ file: c.rel, name, css });
  }

  it('finds Reveal-wrapped classes to check in the first place', () => {
    // Guards the guard. If the JSX scan breaks, every assertion below
    // passes over an empty list. 20 is well under the ~25 <Reveal> sites
    // in components/sections, since several share a class.
    expect(pairs.length).toBeGreaterThan(20);
    expect(pairs.map((p) => p.name)).toContain('statCard');
    expect(pairs.map((p) => p.name)).toContain('rolePill');
    expect(pairs.map((p) => p.name)).toContain('loudCta');
  });

  it('declares no transition on any of them, at any selector', () => {
    const offenders = pairs.flatMap(({ file, name, css }) =>
      transitionRulesFor(css, name).map((r) => `${file}  ${r}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('the [data-reveal=in] gate is not reintroduced', () => {
  // `Reveal.module.css`'s own `.reveal[data-reveal='in']` is the reveal's
  // END STATE — opacity 1, transform none — not a gate. It is the one
  // legitimate use of the attribute in a selector, and the rule that
  // makes the attribute mean anything at all.
  const ALLOWED = ".reveal[data-reveal='in']";
  const GATE = /\[data-reveal\s*=\s*['"]?in['"]?\]/;

  it('has no [data-reveal=in] selector outside Reveal.module.css', () => {
    const offenders = [];
    for (const { path, css } of modules()) {
      postcss.parse(css).walkRules((rule) => {
        for (const sel of rule.selectors) {
          if (GATE.test(sel) && sel !== ALLOWED) offenders.push(`${path}  ${sel}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('still finds the one legitimate use, so the scan is proven live', () => {
    // Without this, deleting Reveal's end-state rule — or breaking the
    // module walk — would leave the guard above green while asserting
    // nothing. Same 0-vs-N reasoning as PF-83's reduced-motion probes.
    const seen = [];
    for (const { path, css } of modules()) {
      postcss.parse(css).walkRules((rule) => {
        for (const sel of rule.selectors) if (GATE.test(sel)) seen.push(`${path}  ${sel}`);
      });
    }
    expect(seen).toEqual([`components/motion/Reveal.module.css  ${ALLOWED}`]);
  });
});
