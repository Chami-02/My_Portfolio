// frontend/src/components/sections/__tests__/SkillsSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import postcss from 'postcss';
import { MotionProvider } from '../../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace. Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot
// redefine it — the same reason pages/__tests__/HomePage.test.jsx mocks
// its sections this way. Hoisted above the SkillsSection import by
// Vitest, so the component picks up the mock.
const useSkills = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useSkills', () => ({ useSkills }));

const { SkillsSection } = await import('../SkillsSection');

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../SkillsSection.module.css'), 'utf8');

/** The declaration block of a single rule, by exact selector. */
function ruleBody(selector) {
  const i = css.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule for "${selector}"`);
  return css.slice(i, css.indexOf('}', i));
}

function mockMatchMedia(matches) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

/** The stylesheet with comments stripped — this file documents several
 *  class names in prose, and a `not.toContain` against the raw text
 *  would match the comment describing the thing rather than the thing. */
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

const withMotion = (ui) => <MotionProvider>{ui}</MotionProvider>;

/**
 * Element lookup by CSS-Module local name, matched EXACTLY.
 *
 * The other section tests use `[class*="name"]`, which works only
 * because none of their local names is a prefix of another. Two here
 * are: `pill`/`pillRow` and `card`/`cardPlaceholder`. A substring match
 * quietly reports 31 pills where there are 26, and counts the five
 * loading placeholders as real cards — both failures look like a
 * component bug rather than a selector bug.
 *
 * Neither can this hardcode one scoping template. Vitest emits
 * `_pill_f5cf21`; vite.config.js's own dev template is
 * `SkillsSection-module__pill`. Both are unwrapped to `pill`, so the
 * tests survive a change to either.
 */
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _pill_f5cf21
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__pill
  return named ? named[1] : token;
}

const has = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (root, name) =>
  [...root.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick = (root, name) => pickAll(root, name)[0] ?? null;

/** Nearest ancestor carrying the module class `name`. */
function closestLocal(el, name) {
  let node = el;
  while (node && !has(node, name)) node = node.parentElement;
  return node;
}

/**
 * The prototype's exact pill sequence, lines 253-307. Deliberately
 * written out in full rather than derived from the fixture: this is the
 * target the seed's `order` values were corrected against in PF-82, and
 * a test that derives it from the same data it checks proves nothing.
 */
const EXPECTED = {
  LANGUAGES: ['JavaScript', 'Python', 'HTML5', 'CSS3', 'Java'],
  FRONTEND:  ['React', 'Vite', 'Tailwind CSS', 'React Router', 'Next.js'],
  BACKEND:   ['FastAPI', 'Node.js', 'Express.js', 'REST APIs', 'JWT Authentication'],
  DATABASE:  ['PostgreSQL', 'MongoDB', 'Redis', 'Mongoose', 'SQLAlchemy'],
  DEVOPS:    ['Docker', 'Git', 'GitHub', 'GitHub Actions', 'Linux CLI', 'Jira'],
};

const CATEGORY_OF = {
  LANGUAGES: 'language',
  FRONTEND:  'frontend',
  BACKEND:   'backend',
  DATABASE:  'database',
  DEVOPS:    'devops',
};

/**
 * The 26 seeded skills, deliberately SHUFFLED relative to `order` and
 * relative to the prototype's sequence. The API already sorts by order
 * (skillController.js), so a fixture arriving pre-sorted would let a
 * component that never sorts at all pass every ordering assertion here.
 */
const SKILLS = (() => {
  let n = 0;
  const flat = Object.entries(EXPECTED).flatMap(([label, names]) =>
    names.map((name) => ({
      _id: String(++n),
      name,
      category: CATEGORY_OF[label],
      level: 'intermediate',
      order: n,
    })),
  );
  // Reverse, so every category's pills arrive in exactly wrong order.
  // Frozen so that an in-place sort of the hook's own array THROWS here
  // rather than passing quietly. That is not belt-and-braces: this
  // fixture is module state shared by every test in the file, so a
  // component that sorted its input would sort SKILLS during the first
  // test and leave it already-sorted for the dedicated mutation check
  // further down — which then has nothing left to detect and reports
  // PASS. Found by mutation testing, not by reading. Freezing turns
  // every render in this file into a guard instead of just the one.
  return Object.freeze(flat.reverse());
})();

const loaded = (data = SKILLS) => ({ data, isLoading: false, isError: false, error: null });

/** Pill text in DOM order, for the card carrying `label`. */
function pillsUnder(label) {
  const card = closestLocal(screen.getByText(label), 'card');
  return pickAll(card, 'pill').map((p) => p.textContent);
}

describe('SkillsSection (PF-82)', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    useSkills.mockReturnValue(loaded());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('grouping and order', () => {
    // The whole point of the ticket. The 26 names always matched the
    // prototype; only the within-category order did not, which a count
    // check cannot see.
    it.each(Object.entries(EXPECTED))(
      'renders %s in the prototype\'s exact order',
      (label, names) => {
        render(withMotion(<SkillsSection />));
        expect(pillsUnder(label)).toEqual(names);
      },
    );

    it('renders the five category cards in the prototype\'s order', () => {
      const { container } = render(withMotion(<SkillsSection />));
      const labels = pickAll(container, 'categoryLabel').map((el) => el.textContent);
      expect(labels).toEqual(Object.keys(EXPECTED));
    });

    it('renders all 26 skills and no more', () => {
      const { container } = render(withMotion(<SkillsSection />));
      expect(pickAll(container, 'pill')).toHaveLength(26);
    });

    // `other` is the Skill enum's 6th value and the prototype has no card
    // for it. A skill filed there must render nowhere rather than
    // appearing in an invented card or being appended to another.
    it('never renders the "other" category', () => {
      useSkills.mockReturnValue(
        loaded([
          ...SKILLS,
          { _id: 'x', name: 'Fortran', category: 'other', level: 'beginner', order: 99 },
        ]),
      );
      const { container } = render(withMotion(<SkillsSection />));
      expect(screen.queryByText('Fortran')).toBeNull();
      expect(screen.queryByText('OTHER')).toBeNull();
      expect(pickAll(container, 'pill')).toHaveLength(26);
    });

    // A category the API returns nothing for still gets its card, so the
    // grid keeps five columns. Dropping it would let a data edit change
    // the layout.
    it('keeps a card for a category with no skills', () => {
      useSkills.mockReturnValue(loaded(SKILLS.filter((s) => s.category !== 'devops')));
      const { container } = render(withMotion(<SkillsSection />));
      expect(pickAll(container, 'categoryLabel')).toHaveLength(5);
      expect(screen.getByText('DEVOPS')).toBeInTheDocument();
      expect(pillsUnder('DEVOPS')).toEqual([]);
    });

    // Sorting a fresh array is safe; sorting the query's own array is
    // not. TanStack Query hands back the cached reference, and mutating
    // it reorders every other consumer's data with no re-render.
    //
    // Uses an UNFROZEN copy on purpose. The frozen module fixture above
    // already makes an in-place sort throw; this covers the case where
    // that freeze is later removed, by checking the observable property
    // directly rather than relying on the throw.
    it('does not mutate the array useSkills() returned', () => {
      const data = SKILLS.map((s) => ({ ...s }));
      const snapshot = data.map((s) => s.name);
      useSkills.mockReturnValue(loaded(data));
      render(withMotion(<SkillsSection />));
      expect(data.map((s) => s.name)).toEqual(snapshot);
    });
  });

  describe('structure', () => {
    it('renders the numbered eyebrow and its decorative rule', () => {
      const { container } = render(withMotion(<SkillsSection />));
      expect(screen.getByText('02 / SKILLS')).toBeInTheDocument();
      expect(pick(container, 'eyebrowLine')).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders the heading as an h2 with only "Toolkit" outlined', () => {
      const { container } = render(withMotion(<SkillsSection />));
      const h2 = container.querySelector('h2');
      expect(h2).toBeInTheDocument();
      expect(h2.textContent).toBe('The Toolkit');
      expect(pick(h2, 'outlined').textContent).toBe('Toolkit');
    });

    it('anchors the section at #skills for the navbar link', () => {
      const { container } = render(withMotion(<SkillsSection />));
      expect(container.querySelector('section#skills')).toBeInTheDocument();
    });

    // The prototype wraps only the card (line 253); the pills arrive with
    // it as one unit. Wrapping each pill would stagger 26 entrances where
    // the design has five.
    it('wraps cards in Reveal but never individual pills', () => {
      const { container } = render(withMotion(<SkillsSection />));
      expect(pickAll(container, 'card').every((c) => c.hasAttribute('data-reveal'))).toBe(true);
      expect(pickAll(container, 'pill').some((p) => p.hasAttribute('data-reveal'))).toBe(false);
    });

    // 60/120/180/240/300, the prototype's data-delay values. Reveal
    // writes them inline as transitionDelay, so this is one of the few
    // style assertions jsdom can actually make — it is a JS write, not a
    // stylesheet rule.
    it('staggers the five cards at the prototype\'s delays', () => {
      const { container } = render(withMotion(<SkillsSection />));
      expect(pickAll(container, 'card').map((c) => c.style.transitionDelay))
        .toEqual(['60ms', '120ms', '180ms', '240ms', '300ms']);
    });
  });

  describe('async states', () => {
    it('renders five empty placeholders while loading, and no pills', () => {
      useSkills.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
      const { container } = render(withMotion(<SkillsSection />));

      expect(pickAll(container, 'cardPlaceholder')).toHaveLength(5);
      expect(pickAll(container, 'pill')).toHaveLength(0);
      // The heading is not gated on the data — it is static copy.
      expect(screen.getByText('02 / SKILLS')).toBeInTheDocument();
    });

    it('hides the placeholders from assistive tech', () => {
      useSkills.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
      const { container } = render(withMotion(<SkillsSection />));
      expect(pickAll(container, 'cardPlaceholder')
        .every((el) => el.getAttribute('aria-hidden') === 'true')).toBe(true);
    });

    // Owner decision, 2026-08-18: NOT `return null`. The navbar links to
    // #skills, so removing the section turns that link into a dead anchor
    // with no feedback. The shell and heading stay; only the grid goes.
    it('keeps the section and its #skills anchor on error, dropping only the grid', () => {
      useSkills.mockReturnValue({
        data: undefined, isLoading: false, isError: true, error: new Error('network'),
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { container } = render(withMotion(<SkillsSection />));

      expect(container.querySelector('section#skills')).toBeInTheDocument();
      expect(screen.getByText('02 / SKILLS')).toBeInTheDocument();
      expect(container.querySelector('h2').textContent).toBe('The Toolkit');
      expect(pick(container, 'grid')).toBeNull();
      expect(pickAll(container, 'card')).toHaveLength(0);
    });

    it('logs the real cause on error rather than swallowing it', () => {
      const err = new Error('network');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      useSkills.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: err });

      render(withMotion(<SkillsSection />));

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('useSkills'), err);
    });

    // Logged from an effect keyed on the error, not from the render body.
    // A render-phase log repeats on every unrelated re-render.
    it('does not re-log on a re-render with the same error', () => {
      const err = new Error('network');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      useSkills.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: err });

      const { rerender } = render(withMotion(<SkillsSection />));
      const afterFirst = spy.mock.calls.length;
      rerender(withMotion(<SkillsSection />));

      expect(spy.mock.calls.length).toBe(afterFirst);
    });
  });

  // CSS Modules are stubbed under Vitest (vite.config.js sets no
  // test.css), so nothing in the stylesheet is ever applied to an element
  // here. These assert the file as text — a getComputedStyle assertion
  // would pass or fail for the wrong reason.
  describe('stylesheet', () => {
    // A bare `.skills` ties with global.css:338's `[id] { scroll-margin-top:
    // 5rem }` at (0,1,0) and loses on stylesheet order, computing 80px for
    // a 71px header. Third section to need this; jsdom cannot catch it.
    it('qualifies the section selector so [id] cannot win the cascade', () => {
      expect(css).toContain('\nsection.skills {');
      expect(ruleBody('section.skills')).toContain('scroll-margin-top: var(--header-h)');
    });


    // Owner-requested, 2026-08-18: every section wash was removed so the
    // StarfieldCanvas reads through the whole page. Asserted as absent
    // because the PROTOTYPE STILL HAS IT — a later fidelity pass diffing
    // the two would read this as a missing transcription and paint it
    // back, which is precisely the regression worth catching. The cards keep their own
    // rgba(var(--srf),.52) surface — only the SECTION went transparent.
    it('paints no section background, so the starfield reads through', () => {
      // Comments stripped: the rule DOCUMENTS the removed prototype
      // gradient in place, so a raw check matches the note explaining the
      // absence rather than an actual declaration.
      const rule = ruleBody('section.skills').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(rule).not.toContain('background');
      expect(rule).not.toContain('gradient');
    });

    it('composes the extracted patterns rather than redeclaring them', () => {
      ['section-eyebrow', 'section-eyebrow-label', 'section-eyebrow-line', 'outline-text']
        .forEach((name) => {
          expect(css).toContain(`composes: ${name} from '../../styles/patterns.module.css'`);
        });
      expect(cssRules).not.toContain('-webkit-text-stroke');
    });

    // The prototype's Skills eyebrow is 14px (line 246); About's is 38px.
    // PF-82 pulled the property out of the shared class because the two
    // disagree, so this section must declare its own or the gap collapses.
    it('declares its own 14px eyebrow gap', () => {
      expect(ruleBody('.eyebrow')).toContain('margin-bottom: 14px');
    });

    it('keeps the card\'s own surface, which the wash removal must not touch', () => {
      expect(ruleBody('.card')).toContain('background: rgba(var(--srf), .52)');
    });

    /**
     * PF-93, 2026-08-21 — the inverse of the guard that stood here, and
     * the point at which the 2026-08-18 hover deviation is withdrawn
     * (owner sign-off 2026-08-21).
     *
     * It used to assert that `.card[data-reveal='in']` EXISTS. Two
     * things were wrong with that:
     *
     *   1. The gate does not work. Reveal sets data-reveal="in" from the
     *      IntersectionObserver callback at the entrance's START
     *      (Reveal.jsx:57), so it matched immediately and the card
     *      animated its entrance on the 0.25s hover transition —
     *      measured, opacity 1 at 0ms and the slide done at 300ms
     *      instead of ~1050ms.
     *   2. The deviation it protected was based on a misreading. The
     *      prototype's markup declares no transition on this card, but
     *      hideReveals() writes one inline on every [data-reveal]
     *      element and never clears it, so the card hover-eases at 1.05s
     *      on the rendered page. The About/Skills inconsistency the
     *      deviation existed to resolve never existed on screen.
     *
     * postcss, not ruleBody(): the replacement comment in the module
     * names "transition" and ".card[data-reveal='in']" while explaining
     * the deletion, so raw text matches the prose and asserts nothing.
     */
    it('declares no transition on .card, at any selector', () => {
      const offenders = [];
      postcss.parse(css).walkRules((rule) => {
        if (!/\.card(?![\w-])/.test(rule.selector)) return;
        rule.walkDecls(/^transition/, (d) => {
          offenders.push(`${rule.selector} { ${d.prop}: ${d.value} }`);
        });
      });
      expect(offenders).toEqual([]);
    });

    // The hover END STATE stays — the prototype's line 253. Asserted so
    // the deletion above cannot be over-applied into removing the lift.
    it('keeps the hover end state the transition used to animate', () => {
      const hover = ruleBody('.card:hover');
      expect(hover).toContain('border-color: var(--acc');
      expect(hover).toContain('transform: translateY(-6px)');
      expect(hover).toContain('box-shadow: 0 24px 50px rgba(var(--shd), .5)');
    });

    // The pill is NOT a Reveal, so nothing competes and the prototype's
    // own transition is transcribed bare (line 255).
    it('declares the pill transition bare, since no Reveal owns it', () => {
      expect(ruleBody('.pill'))
        .toContain('transition: background .25s, color .25s, border-color .25s, transform .25s');
    });

    // Without a height the placeholder collapses to its 48px of padding
    // and the grid jumps taller the instant real content lands.
    it('gives the loading placeholder a height so the grid cannot jump', () => {
      const placeholder = ruleBody('.cardPlaceholder');
      expect(placeholder).toContain('composes: card');
      expect(placeholder).toMatch(/min-height:\s*\d+px/);
    });

    // First section of the sprint with no @keyframes at all — every
    // effect is a hover transition. A `composes: kf-*` here would mean
    // something was transcribed that the prototype does not have.
    it('needs no keyframe carrier, unlike every earlier section', () => {
      expect(cssRules).not.toContain('composes: kf-');
      expect(cssRules).not.toMatch(/animation(-name)?:/);
    });
  });
});
