/* frontend/src/pages/__tests__/NotFoundPage.test.jsx
 *
 * PF-100. Rewritten with the page.
 *
 * ⚠️ THE OLD ASSERTION WOULD HAVE STAYED GREEN AGAINST THE NEW PAGE AND
 * MEANT NOTHING. It was `getByText('404')`, written when the numeral was
 * the heading. Had PF-100 shipped the ghost-numeral design that was
 * briefly approved, `getByText` would have matched the DECORATIVE span —
 * it ignores `aria-hidden`, which only `getByRole` respects — so a test
 * named "renders the 404 heading" would have passed while pointing at a
 * node no screen reader announces. Recorded because the trap survives the
 * design that triggered it: it is a property of `getByText`, not of the
 * ghost.
 *
 * ⚠️ Accessible-name matching differs between the two suites and the
 * SAME name is asserted in both. The DOM text is sentence case and
 * `.heading` uppercases it in CSS (the prototype's own idiom), so:
 *   - testing-library matches the DOM string in FULL and case-SENSITIVELY
 *     → 'Page not found'
 *   - Playwright matches by SUBSTRING, case-INSENSITIVELY, unless given
 *     `exact: true` → e2e passes `exact: true` deliberately
 * Asserting 'PAGE NOT FOUND' here would fail; asserting it there would
 * pass for the wrong reason.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';
import { NotFoundPage } from '../NotFoundPage';

/* Theme and Motion are REQUIRED — both throw outside their provider, by
   design (a missing theme is a bug worth surfacing). StarfieldCanvas
   calls useReducedMotion, so the ambient layer drags them in.
   No QueryClientProvider: this page fetches nothing. */
describe('NotFoundPage (PF-100)', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <ThemeProvider>
          <MotionProvider>
            <NotFoundPage />
          </MotionProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

  it('names the page in a real heading, not a decorative node', () => {
    renderPage();
    // getByRole, not getByText: the accessible name is the thing under
    // test, and only getByRole respects aria-hidden.
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
  });

  it('renders the ERROR 404 eyebrow', () => {
    renderPage();
    expect(screen.getByText('ERROR 404')).toBeInTheDocument();
  });

  it('renders an error message explaining the page is missing', () => {
    renderPage();
    expect(screen.getByText(/doesn’t exist/i)).toBeInTheDocument();
  });

  it('offers a home link and a Field Notes link, with their targets', () => {
    renderPage();

    const home = screen.getByRole('link', { name: '← BACK TO HOME' });
    expect(home).toHaveAttribute('href', '/');

    const blog = screen.getByRole('link', { name: 'FIELD NOTES →' });
    expect(blog).toHaveAttribute('href', '/blog');
  });

  /* ⚠️ AN ABSENCE GUARD, and the reason it is not vacuous.
   *
   * The giant translucent ghost `404` was approved on 2026-09-07 and
   * withdrawn the same session: it reinstates the featured card's ghost
   * `01`, which the owner removed on 2026-08-22 from the home teaser with
   * "/blog inherits the removal". BlogSection and BlogPage each guard that
   * absence; this is the third.
   *
   * The ELEMENT must be absent, not merely transparent — a zero-opacity
   * span still occupies the box and is still walked by anything reading
   * the DOM, which is the distinction the locked entry spells out.
   *
   * `queryAllByText` rather than a CSS-class check: CSS Modules rules are
   * invisible to Vitest (no stylesheet is ever applied), so a class-based
   * assertion here would test nothing.
   *
   * ⚠️ SCOPED TO THE <section>, NOT THE CONTAINER. CursorGlow and
   * GrainOverlay each render a legitimate `aria-hidden` div inside
   * PageShell, so a container-wide count would be asserting the ambient
   * layer is missing — a guard that fails for a reason unrelated to its
   * own name. Same family as counting every control in a landmark as a
   * proxy for one component.
   */
  it('renders no decorative 404 numeral — the removal is inherited', () => {
    const { container } = renderPage();
    const panel = container.querySelector('section');
    expect(panel).not.toBeNull();

    // A bare "404" standing alone would be the ghost. The eyebrow reads
    // "ERROR 404", which this full-string match does not touch.
    expect(screen.queryAllByText('404')).toHaveLength(0);

    // The element must be ABSENT, not merely transparent.
    expect(panel.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  /* ⚠️ THE TOKEN CHOICE IS THE WHOLE TICKET, AND NOTHING ELSE GUARDS IT.
   *
   * PF-91 measured three AA failures on this page, all from Phase 1
   * tokens: the numeral at `--border-bright` (1.91 DARK, the default
   * theme), the eyebrow at `--accent` (2.44 light) and the body at
   * `--text-body` (2.10 light). PF-100 fixes them by reading the Phase 2
   * tokens instead, not by re-tuning the Phase 1 ones — those have 15+
   * live admin consumers and belong to Sprint 14.
   *
   * A future edit reaching for `--accent` here would look completely
   * ordinary and would silently restore a 2.44. There is no other
   * assertion in the repo that would notice: CSS Modules rules are never
   * applied under Vitest (document.styleSheets.length === 0), so the
   * render tests above cannot see a colour at all.
   *
   * ⚠️ PARSED WITH POSTCSS, NOT SEARCHED AS TEXT. The module documents
   * exactly these three token names in prose, in the comments explaining
   * why they are gone — so a raw `not.toContain('--accent')` would match
   * the explanation and pass while asserting nothing. This is the
   * repo's most-repeated test trap and this file is a live instance of
   * its precondition.
   *
   * ⚠️ `--acc\b` does not match `--accent` or `--accInk`: the boundary
   * needs a non-word character after `acc`, which `e` and `I` are not.
   * That is what lets one regex separate the Phase 2 accent from the
   * Phase 1 one whose name contains it.
   */
  it('reads Phase 2 tokens only — no Phase 1 token survives', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(resolve(here, '../NotFoundPage.module.css'), 'utf8');

    // Declaration values only. Comments are not decls, so they cannot
    // satisfy or break either assertion.
    const values = [];
    postcss.parse(css).walkDecls((d) => values.push(d.value));
    const declared = values.join('\n');

    expect(declared).not.toMatch(/var\(\s*--(accent|text-body|border-bright)\b/);

    for (const token of ['--acc', '--strong', '--muted']) {
      expect(declared).toMatch(new RegExp(`var\\(\\s*${token}\\b`));
    }
  });
});
