// frontend/src/styles/__tests__/cutover.test.js
//
// PF-89 — the guard that outlives the deletions.
//
// ⚠️ Cross-cutting on purpose, and it breaks the per-module __tests__
// convention deliberately. It belongs to no single module — the modules it
// is about were deleted. `styles/__tests__/revealTransition.test.js` (PF-93)
// and `styles/__tests__/mobile.test.js` (PF-88) set that precedent; this is
// the third, and CLAUDE.md says to follow it rather than invent a top-level
// `src/__tests__/`.
//
// WHY A TEST AT ALL, for code that is gone:
//
// CLAUDE.md documents at length that a green suite ACTIVELY HIDES dead code —
// a module's own test keeps reporting PASS forever after its last consumer
// disappears, because the test imports the module directly. `useTypewriter`
// sat there with four passing tests and zero consumers from PF-80 to PF-89,
// and three separate dead-code sweeps walked past it for exactly that reason.
//
// The mirror-image hazard is what this file covers: nothing anywhere fails if
// someone REINTRODUCES one of these. A new `useInView` import compiles, runs,
// and quietly reopens a decision nobody remembers making — the Phase 2
// sections use `Reveal`, whose IntersectionObserver is gated on splash
// readiness, and `useInView`'s was not.
//
// The `[id]` assertion is here for the same reason in reverse: the rule's
// return would be silent, because every Phase 2 section outranks it at
// (0,1,1) and its only other anchor target sits at document position 0 where
// `scroll-margin-top` is unreachable. Silent either way is precisely when a
// test is worth having.
import { describe, it, expect } from 'vitest';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `import.meta.url`, not `__dirname` — this file is ESM, and eslint's
// browser globals for src/** give it no `__dirname` to lean on. Vitest
// happens to supply one at runtime, so the lint error is the only signal.
// Matches revealTransition.test.js and mobile.test.js.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.resolve(HERE, '../..');
const E2E  = path.resolve(HERE, '../../../e2e');

/** Modules deleted by PF-89, with the ticket that orphaned each. */
const DELETED = [
  { file: 'hooks/useTypewriter.js',            id: 'useTypewriter',  orphanedBy: 'PF-80' },
  { file: 'hooks/useInView.js',                id: 'useInView',      orphanedBy: 'PF-85/86/87' },
  { file: 'components/common/TerminalWindow.jsx', id: 'TerminalWindow', orphanedBy: 'PF-80' },
];

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, acc);
    else if (exts.includes(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

/** Strip comments before searching. Every file below documents the very
 *  identifiers this test forbids, in prose, at the place the code used to
 *  be — so a raw-text scan matches the explanation and reports PASS. That
 *  failure shape (a test that passes while asserting nothing) is the one
 *  CLAUDE.md calls the worst possible, and it has bitten eight test files
 *  in this repo already. */
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('PF-89 cutover — deleted Phase 1 scaffolding stays deleted', () => {
  const files = [...walk(SRC, ['.js', '.jsx']), ...walk(E2E, ['.js'])];

  it('scanned a plausible number of files', () => {
    // A scanner that globs nothing reports "no offenders" in exactly the
    // same words as a clean tree. Same self-check as revealTransition's
    // ">20 pairs" assertion, and for the same reason.
    expect(files.length).toBeGreaterThan(80);
  });

  it.each(DELETED)('$file is gone (orphaned by $orphanedBy)', ({ file }) => {
    expect(fs.existsSync(path.join(SRC, file))).toBe(false);
  });

  it.each(DELETED)('nothing imports $id', ({ id }) => {
    const offenders = files.filter((f) => {
      const src = strip(fs.readFileSync(f, 'utf8'));
      // An import of the module by path, in any of the three forms this
      // codebase uses: static import, dynamic import(), and require().
      return new RegExp(
        `(from\\s*['"][^'"]*${id}['"])|(import\\s*\\(\\s*['"][^'"]*${id}['"])|(require\\s*\\(\\s*['"][^'"]*${id}['"])`,
      ).test(src);
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('useTypewriter\'s test file went with the hook', () => {
    // Deleting a module and keeping its test is how dead code stays
    // looking alive. The test count going DOWN is the intended result.
    expect(fs.existsSync(path.join(SRC, 'hooks/__tests__/useTypewriter.test.js'))).toBe(false);
  });
});

describe('PF-89 cutover — the [id] scroll-margin rule stays deleted', () => {
  const global = strip(fs.readFileSync(path.join(SRC, 'styles/global.css'), 'utf8'));

  it('global.css declares no blanket [id] scroll-margin-top', () => {
    // It was `[id] { scroll-margin-top: 5rem }` — (0,1,0), an exact tie with
    // any single-class section rule, so it won on emission order and
    // computed 80px against a 71px header. Every Phase 2 section now
    // qualifies its selector as `section.x` (0,1,1) and outranks it.
    expect(global).not.toMatch(/\[id\]\s*\{[^}]*scroll-margin/);
    expect(global).not.toMatch(/scroll-margin-top:\s*5rem/);
  });

  it('the six Phase 2 sections each set their own, qualified by element', () => {
    const sections = {
      hero: 'HeroSection', about: 'AboutSection', skills: 'SkillsSection',
      projects: 'ProjectsSection', blog: 'BlogSection', contact: 'ContactSection',
    };
    for (const [id, mod] of Object.entries(sections)) {
      const css = strip(
        fs.readFileSync(path.join(SRC, `components/sections/${mod}.module.css`), 'utf8'),
      );
      // `section.hero`, not `.hero` — the qualified form is the whole fix.
      expect(css, `${mod} must qualify with the element name`)
        .toMatch(new RegExp(`section\\.${id}\\s*\\{[^}]*scroll-margin-top:\\s*var\\(--header-h\\)`));
    }
  });
});
