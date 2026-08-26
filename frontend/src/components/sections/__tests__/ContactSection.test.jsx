// frontend/src/components/sections/__tests__/ContactSection.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import postcss from 'postcss';
import { MotionProvider } from '../../../providers/MotionProvider';

// vi.mock, not vi.spyOn on the module namespace — Vite's SSR transform
// defines each export as a getter-only property, so spyOn cannot
// redefine it. Hoisted above the ContactSection import by Vitest.
const useAbout = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useAbout', () => ({ useAbout }));

const submit = vi.hoisted(() => vi.fn());
vi.mock('../../../services/contactService', () => ({ contactService: { submit } }));

const { ContactSection } = await import('../ContactSection');

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '../ContactSection.module.css');
const css = readFileSync(cssPath, 'utf8');

/**
 * ⚠️ Every CSS assertion in this file goes through postcss, never a
 * regex over the raw text. This module documents the removed section
 * wash, the transparent-outline reasoning, the two literal status hexes
 * and the PF-93 no-transition rule IN PROSE — so a
 * `not.toContain('background')`, a `toContain('outline: none')` or a
 * `not.toContain('transition')` against the source string matches the
 * comment explaining the rule rather than the rule itself. That trap has
 * produced blind guards in this repo five separate times, every one
 * caught by mutation rather than by reading. Parsing is immune rather
 * than defended: a comment is a distinct node type that a declaration
 * walk never visits.
 */
const root = postcss.parse(css);

/** Declarations of one rule, by exact selector, as { prop: value }. */
function decls(selector) {
  let found = null;
  root.walkRules((rule) => {
    if (rule.selector === selector) {
      found = {};
      rule.walkDecls((d) => { found[d.prop] = d.value; });
    }
  });
  if (!found) throw new Error(`no rule for "${selector}"`);
  return found;
}

/** Every selector in the file, so an assertion can prove an absence. */
const selectors = (() => {
  const out = [];
  root.walkRules((rule) => out.push(...rule.selectors));
  return out;
})();

/** Every `transition*` declaration in the file, with its selector. */
const transitions = (() => {
  const out = [];
  root.walkRules((rule) => {
    rule.walkDecls(/^transition/, (d) =>
      out.push({ selector: rule.selector, prop: d.prop, value: d.value }));
  });
  return out;
})();

/** Every `outline*` declaration in the file, with its selector. */
const outlines = (() => {
  const out = [];
  root.walkRules((rule) => {
    rule.walkDecls(/^outline/, (d) =>
      out.push({ selector: rule.selector, prop: d.prop, value: d.value }));
  });
  return out;
})();

// ── DOM lookup by CSS-Module local name, matched EXACTLY ──────────────
// Step 9 of the ticket calls this out and it is not hypothetical here:
// `[class*="input"]` would also match `nameEmailRow` is false, but
// `[class*="field"]` DOES match `fieldLabel`, `[class*="ctaRow"]`
// matches nothing else only by luck, and `[class*="location"]` is fine
// while `[class*="link"]` would sweep up `emailLink`, `cvLink` and
// `socialLink` together. Every one of those collisions reads as a
// component bug rather than a selector bug.
function localName(token) {
  const scoped = /^_(.+)_[^_]+$/.exec(token);   // Vitest:   _input_1c471b
  if (scoped) return scoped[1];
  const named = /__(.+)$/.exec(token);          // Vite dev: File-module__input
  return named ? named[1] : token;
}
const has = (el, name) => [...el.classList].some((c) => localName(c) === name);
const pickAll = (r, name) => [...r.querySelectorAll('[class]')].filter((el) => has(el, name));
const pick = (r, name) => pickAll(r, name)[0] ?? null;

const aboutOk = (hasResume) => ({
  data: { hasResume }, isLoading: false, isError: false, error: null,
});

function mockMatchMedia(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  })));
}

function renderSection() {
  return render(<MotionProvider><ContactSection /></MotionProvider>);
}

beforeEach(() => {
  mockMatchMedia(false);
  useAbout.mockReturnValue(aboutOk(false));
  submit.mockReset();
  submit.mockResolvedValue({ status: 'success' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ══ 1 · the scroll-margin-top fix ══════════════════════════════════════
describe('section anchor (Step 9 #1)', () => {
  /**
   * The live bug this ticket exists to fix. `global.css:338` carries
   * `[id] { scroll-margin-top: 5rem }` at (0,1,0) — identical to a bare
   * class — so a `.contact` rule ties and loses on stylesheet order,
   * computing 80px against a 71px header. Contact is the section where
   * that has actually been shipping since PF-80, because it stayed
   * Phase 1 and never declared the property at all.
   */
  it('qualifies the section selector with the element name', () => {
    expect(selectors).toContain('section.contact');
  });

  it('never declares a bare `.contact` rule that would tie and lose', () => {
    expect(selectors).not.toContain('.contact');
  });

  it('sets scroll-margin-top from the measured header token', () => {
    expect(decls('section.contact')['scroll-margin-top']).toBe('var(--header-h)');
  });
});

// ══ 2 & 3 · the wash out, the glow in ══════════════════════════════════
describe('section background (Step 9 #2, #3)', () => {
  /**
   * Asserted as an ABSENCE deliberately. The prototype's line 489 really
   * does declare this wash, so a later fidelity pass diffing live
   * against the export reads its absence as un-transcribed and paints it
   * back. The 2026-08-18 site-wide removal is why it is gone.
   */
  it('declares no background of any kind on the section', () => {
    const rule = decls('section.contact');
    Object.keys(rule).forEach((prop) => {
      expect(prop).not.toMatch(/^background/);
    });
  });

  /**
   * ⚠️ The accent glow is REMOVED — owner-requested 2026-08-22, after
   * PF-87 built it and raised it as an open question. Guarded as an
   * ABSENCE for the same reason the section wash above is: the
   * prototype's line 490 really does declare it, so a fidelity pass
   * diffing against the export reads its absence as un-transcribed and
   * paints it back.
   *
   * Three ways, following the ghost-numeral removal — no rule, no
   * element, no stray gradient — because each catches a different way
   * of half-restoring it. All three go through postcss or the DOM, never
   * a text search: the module documents the removed declarations in
   * prose exactly where the rule used to be, so a raw
   * `not.toContain('radial-gradient')` matches the comment explaining
   * the removal.
   */
  it('declares no .glow rule', () => {
    expect(selectors).not.toContain('.glow');
  });

  it('renders no absolutely-positioned decorative child', () => {
    const { container } = renderSection();
    const section = container.querySelector('#contact');
    // The section's only children are the inner wrapper's subtree; no
    // aria-hidden sibling layer sits alongside it.
    const hidden = [...section.children].filter((el) => el.getAttribute('aria-hidden') === 'true');
    expect(hidden).toEqual([]);
    expect(section.children).toHaveLength(1);
  });

  it('has no amber radial-gradient anywhere in the module', () => {
    const gradients = [];
    root.walkRules((rule) => rule.walkDecls(/^background/, (d) => {
      if (/radial-gradient/.test(d.value)) gradients.push(`${rule.selector} { ${d.prop}: ${d.value} }`);
    }));
    expect(gradients).toEqual([]);
  });

  /**
   * ⚠️ `overflow: hidden` STAYS, and this guard is the reason it cannot
   * be swept up as "the other half" of the glow removal. It is the
   * prototype's own declaration on line 489 and independent of the
   * layer it happened to clip.
   */
  it('keeps the prototype overflow:hidden on the section', () => {
    expect(decls('section.contact').overflow).toBe('hidden');
  });
});

// ══ 4 · the eyebrow margin ═════════════════════════════════════════════
describe('eyebrow (Step 9 #4)', () => {
  /**
   * The prototype's five eyebrows carry THREE different bottom margins —
   * About 38px, Skills/Projects/Blog 14px, Contact 20px. PF-81 baked
   * About's into the shared class from one observation and PF-82 found
   * it wrong, so `patterns.module.css` deliberately carries none and
   * each section declares its own.
   */
  it('declares margin-bottom: 20px locally, not 14px or 38px', () => {
    expect(decls('.eyebrow')['margin-bottom']).toBe('20px');
  });

  it('takes its structure from patterns rather than redeclaring it', () => {
    const rule = decls('.eyebrow');
    expect(rule.composes).toContain('section-eyebrow');
    // If these were declared locally the composes would be decorative.
    expect(rule.display).toBeUndefined();
    expect(rule.gap).toBeUndefined();
  });

  it('renders the 05 / CONTACT label', () => {
    renderSection();
    expect(screen.getByText('05 / CONTACT')).toBeInTheDocument();
  });
});

// ══ 5 · the heading's two unique spacings ══════════════════════════════
describe('heading (Step 9 #5)', () => {
  /**
   * The only section heading in the prototype with either property. Both
   * read as noise beside the other four headings, which is exactly how a
   * normalising pass loses them.
   */
  it('keeps letter-spacing AND word-spacing', () => {
    const rule = decls('.heading');
    expect(rule['letter-spacing']).toBe('.03em');
    expect(rule['word-spacing']).toBe('.12em');
  });

  it('transcribes the clamp without rounding', () => {
    const rule = decls('.heading');
    expect(rule['font-size']).toBe('clamp(32px, 5.2vw, 78px)');
    expect(rule['line-height']).toBe('1.06');
    expect(rule.margin).toBe('0 0 22px');
  });

  it('outlines only "something loud"', () => {
    const { container } = renderSection();
    const outlined = pickAll(container, 'outlined');
    expect(outlined).toHaveLength(1);
    expect(outlined[0]).toHaveTextContent('something loud');
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent(/Let's build\s*something loud/i);
  });
});

// ══ 6 & 7 · the focus indicator ════════════════════════════════════════
describe('input focus (Step 9 #6, #7)', () => {
  /**
   * The prototype ships a bare `outline: none` on all three fields. That
   * would be this repo's first — PF-83 recorded "there is no outline:
   * none anywhere in this repo, checked" — and in forced-colors mode the
   * browser overrides author `border-color`, so suppressing the outline
   * leaves the field with NO indicator at all. A transparent outline
   * renders as nothing normally and is restored by forced-colors.
   */
  it('never declares a bare outline:none anywhere in the file', () => {
    const suppressed = outlines.filter((o) => /^none$/.test(o.value.trim()));
    expect(suppressed).toEqual([]);
  });

  it('gives both field types a transparent outline on focus', () => {
    ['.input:focus', '.textarea:focus'].forEach((sel) => {
      const rule = decls(sel);
      expect(rule.outline).toBe('2px solid transparent');
      expect(rule['outline-offset']).toBe('2px');
    });
  });

  /** The design's own indicator, and the reason the outline can be
   *  transparent in the first place. */
  it('shifts border-color to the accent on focus, per the prototype', () => {
    ['.input:focus', '.textarea:focus'].forEach((sel) => {
      expect(decls(sel)['border-color']).toBe('var(--acc)');
    });
  });

  /**
   * `composes:` copies the class reference, not the `:focus` rule — so a
   * `.textarea:focus` block is genuinely required and its absence would
   * silently leave the message field with no focus treatment at all.
   */
  it('declares the textarea focus rule separately from the input one', () => {
    expect(selectors).toContain('.textarea:focus');
    expect(selectors).toContain('.input:focus');
  });
});

// ══ 8 · the email input's type ═════════════════════════════════════════
describe('email input (Step 9 #8)', () => {
  /**
   * `type="email"` would trigger native validation, whose bubble is
   * browser-styled and has no treatment anywhere in this design. The
   * prototype chose `text` + `inputmode`; validation happens in JS.
   */
  it('is type=text with inputmode=email, not type=email', () => {
    const { container } = renderSection();
    const email = container.querySelector('input[name="email"]');
    expect(email).toHaveAttribute('type', 'text');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });

  it('marks the form noValidate so the two stay consistent', () => {
    const { container } = renderSection();
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
  });
});

// ══ 9 · PF-93 ══════════════════════════════════════════════════════════
describe('transitions (Step 9 #9)', () => {
  /**
   * Stronger than PF-93 requires, and correct for this section
   * specifically: the prototype declares `transition` on NOTHING here.
   * The Reveal targets must not have one (PF-93 — `.reveal` owns the
   * property and a local one would replace the entrance easing), and the
   * links, inputs and submit must not either, because they are children
   * of a Reveal target rather than targets themselves, so
   * `hideReveals()` never writes to them and their hover snaps in the
   * export exactly as here.
   *
   * Asserted as a whole-file count rather than per class, so an element
   * added later cannot slip past a hardcoded list.
   */
  it('declares no transition anywhere in the module', () => {
    expect(transitions).toEqual([]);
  });

  /** The inverse: the hover END STATES must survive. Deleting the
   *  transition must not become deleting the hover treatment. */
  it('keeps every hover end state the prototype specifies', () => {
    expect(decls('.emailLink:hover').transform).toBe('translateY(-3px)');
    expect(decls('.cvLink:hover').transform).toBe('translateY(-3px)');
    expect(decls('.socialLink:hover')['border-color']).toBe('var(--acc)');
    expect(decls('.submit:hover').transform).toBe('translateY(-2px)');
  });
});

// ══ 11, 12, 13 · form behaviour ════════════════════════════════════════
describe('form submission (Step 9 #11, #12, #13)', () => {
  const fill = async (user, { name, email, message }) => {
    if (name !== undefined) await user.type(screen.getByRole('textbox', { name: /name/i }), name);
    if (email !== undefined) await user.type(screen.getByRole('textbox', { name: /email/i }), email);
    if (message !== undefined) await user.type(screen.getByRole('textbox', { name: /message/i }), message);
  };
  const send = () => screen.getByRole('button', { name: /send message/i });

  /**
   * #11. The prototype's own copy (line 1138), and the important half is
   * the last assertion: an empty submit must not reach the network.
   */
  it('blocks an empty submit, shows the error, and sends nothing', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(send());

    expect(await screen.findByRole('alert')).toHaveTextContent('All three fields are required.');
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects a malformed email with the prototype's own copy", async () => {
    const user = userEvent.setup();
    renderSection();
    await fill(user, { name: 'Ada', email: 'not-an-email', message: 'Hello there, this is long enough.' });
    await user.click(send());

    expect(await screen.findByRole('alert')).toHaveTextContent('That email address looks off.');
    expect(submit).not.toHaveBeenCalled();
  });

  /**
   * #11's second half, and the one with no design source: a failed
   * request must not cost the visitor the message they typed. The
   * prototype cannot fail — its submit is a 900ms setTimeout — so this
   * behaviour is decided here.
   */
  it('does NOT clear the form when the request fails', async () => {
    submit.mockRejectedValue({ response: { data: { message: 'Message must be at least 10 characters long' } } });
    const user = userEvent.setup();
    renderSection();

    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'Short' });
    await user.click(send());

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Message must be at least 10 characters long');
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Ada');
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveValue('ada@example.com');
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('Short');
  });

  /**
   * A backend that is not running produces no `err.response` at all. The
   * fallback sentence exists so that case does not render as a
   * validation complaint about the visitor's input — the same failure
   * shape that made `loginError.js` necessary.
   */
  it('falls back to a connection message when there is no response', async () => {
    submit.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    renderSection();

    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'A properly long message.' });
    await user.click(send());

    expect(await screen.findByRole('alert')).toHaveTextContent(/check your connection/i);
  });

  /** #12. Double-submission is the reason, and the label is the
   *  design-sanctioned place the state is already visible. */
  it('disables the submit in flight and re-enables it after', async () => {
    let release;
    submit.mockImplementation(() => new Promise((r) => { release = r; }));
    const user = userEvent.setup();
    renderSection();

    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'A properly long message.' });
    await user.click(send());

    const button = screen.getByRole('button', { name: /sending/i });
    expect(button).toBeDisabled();

    release({ status: 'success' });
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('sends exactly one request when the button is clicked twice', async () => {
    let release;
    submit.mockImplementation(() => new Promise((r) => { release = r; }));
    const user = userEvent.setup();
    renderSection();

    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'A properly long message.' });
    const button = send();
    await user.click(button);
    await user.click(button);

    expect(submit).toHaveBeenCalledTimes(1);
    release({ status: 'success' });
  });

  /**
   * The path `disabled` does NOT cover, and the reason the handler has
   * its own `if (sending) return`.
   *
   * ⚠️ Found by mutation: deleting that guard left all 49 tests green,
   * because the click-twice test above is satisfied by the disabled
   * attribute alone — userEvent will not click a disabled button. A
   * submit dispatched straight at the <form> never consults the
   * button's state, so this is the only assertion that can tell the two
   * mechanisms apart. Enter in a text field and a programmatic
   * requestSubmit() both take this route.
   */
  it('ignores a submit dispatched at the form while one is in flight', async () => {
    let release;
    submit.mockImplementation(() => new Promise((r) => { release = r; }));
    const user = userEvent.setup();
    const { container } = renderSection();

    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'A properly long message.' });
    const form = container.querySelector('form');

    await user.click(send());
    expect(submit).toHaveBeenCalledTimes(1);

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(submit).toHaveBeenCalledTimes(1);
    release({ status: 'success' });
  });

  /** #13. */
  it('clears the form and shows the sent message on success', async () => {
    const user = userEvent.setup();
    renderSection();

    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'A properly long message.' });
    await user.click(send());

    expect(await screen.findByRole('status'))
      .toHaveTextContent("✓ Message sent — I'll reply within 24 hours.");
    expect(submit).toHaveBeenCalledWith({
      name: 'Ada', email: 'ada@example.com', message: 'A properly long message.',
    });
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('');
  });

  /** The prototype's `onField` (line 1132) clears both statuses on any
   *  keystroke, so neither sits stale above a form being re-edited. */
  it('clears a standing error as soon as the visitor types', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(send());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'A');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the sent message as soon as the visitor types again', async () => {
    const user = userEvent.setup();
    renderSection();
    await fill(user, { name: 'Ada', email: 'ada@example.com', message: 'A properly long message.' });
    await user.click(send());
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'B');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// ══ 14 · the CV link ═══════════════════════════════════════════════════
describe('DOWNLOAD CV (Step 9 #14)', () => {
  const cv = (c) => pick(c, 'cvLink');

  /**
   * The prototype's markup href is `#contact` — self-referential, inside
   * `#contact`. That is not a design decision and not a dead anchor
   * either: `applyResume()` (line 676) rewrites it at runtime, and this
   * is the branch where a résumé exists.
   */
  it('points at the résumé endpoint when one is uploaded', () => {
    useAbout.mockReturnValue(aboutOk(true));
    const { container } = renderSection();
    const link = cv(container);
    expect(link).toHaveAttribute('href', '/api/resume');
    expect(link).toHaveAttribute('download');
    expect(link).not.toHaveAttribute('title');
  });

  it("never ships the prototype's self-referential href when a résumé exists", () => {
    useAbout.mockReturnValue(aboutOk(true));
    const { container } = renderSection();
    expect(cv(container)).not.toHaveAttribute('href', '#contact');
  });

  /**
   * The other branch of `applyResume()` — the design's own empty state,
   * which the ticket believed had no design source. Inert href, no
   * `download` (it would otherwise try to download the page itself), and
   * the prototype's own explanatory title.
   */
  it("falls back to the prototype's inert state when there is no résumé", () => {
    useAbout.mockReturnValue(aboutOk(false));
    const { container } = renderSection();
    const link = cv(container);
    expect(link).toHaveAttribute('href', '#contact');
    expect(link).not.toHaveAttribute('download');
    expect(link).toHaveAttribute('title', 'Upload a résumé in the admin panel to enable this');
  });

  /** Fails closed. A failed About fetch must not produce a link to a
   *  download that may not exist. */
  it('renders the inert state when the About fetch fails', () => {
    useAbout.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('boom') });
    const { container } = renderSection();
    expect(cv(container)).toHaveAttribute('href', '#contact');
  });

  it('renders the inert state while the About fetch is still loading', () => {
    useAbout.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
    const { container } = renderSection();
    expect(cv(container)).toHaveAttribute('href', '#contact');
  });
});

// ══ 15 · copy ══════════════════════════════════════════════════════════
describe('transcribed copy (Step 9 #15)', () => {
  it("uses the prototype's placeholders exactly, ellipsis included", () => {
    const { container } = renderSection();
    expect(container.querySelector('input[name="name"]'))
      .toHaveAttribute('placeholder', 'Parindra Gallage');
    expect(container.querySelector('input[name="email"]'))
      .toHaveAttribute('placeholder', 'you@company.com');

    const message = container.querySelector('textarea[name="message"]');
    expect(message).toHaveAttribute('placeholder', 'Tell me about the role, project, or just say hi…');
    // The single ellipsis character, not three periods. Both render
    // similarly and only one is the design's.
    expect(message.getAttribute('placeholder')).toContain('…');
    expect(message.getAttribute('placeholder')).not.toContain('...');
  });

  it("states the location with the section's own string", () => {
    renderSection();
    // ⚠️ NOT About's removed `GALLE, SRI LANKA — SEEING THE STACK`
    // caption. Different string, different section; this is where the
    // location is stated on the page.
    expect(screen.getByText('GALLE, SRI LANKA · UTC+5:30')).toBeInTheDocument();
  });

  it('renders the three field labels', () => {
    renderSection();
    ['NAME', 'EMAIL', 'MESSAGE'].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('renders the email, GitHub and LinkedIn links', () => {
    renderSection();
    expect(screen.getByRole('link', { name: 'parindrachameekara@gmail.com' }))
      .toHaveAttribute('href', 'mailto:parindrachameekara@gmail.com');

    const github = screen.getByRole('link', { name: 'GITHUB' });
    expect(github).toHaveAttribute('href', 'https://github.com/Chami-02');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noreferrer');

    expect(screen.getByRole('link', { name: 'LINKEDIN' }))
      .toHaveAttribute('href', 'https://www.linkedin.com/in/chamikara-gallage-3b0861295/');
  });

  it('keeps the 24-hour promise in the intro copy', () => {
    renderSection();
    expect(screen.getByText(/I respond within 24 hours/)).toBeInTheDocument();
  });
});

// ══ reveal wiring ══════════════════════════════════════════════════════
describe('reveal targets', () => {
  /**
   * ⚠️ The prototype puts `data-reveal` on the ROW DIVS, not on the links
   * inside them. Which elements are targets decides which may declare a
   * transition, so this is load-bearing rather than decorative — and it
   * is the fact PF-93's repo-wide scanner reads.
   */
  it('wraps the eight elements the prototype marks, and no link', () => {
    const { container } = renderSection();
    const revealed = [...container.querySelectorAll('[data-reveal]')];
    expect(revealed).toHaveLength(8);

    // No <a> and no form control is itself a reveal target.
    revealed.forEach((el) => {
      expect(['A', 'INPUT', 'TEXTAREA', 'BUTTON']).not.toContain(el.tagName);
    });
  });

  it("staggers with the prototype's delays, including the repeated 220", () => {
    const { container } = renderSection();
    const delays = [...container.querySelectorAll('[data-reveal]')]
      .map((el) => el.style.transitionDelay);
    expect(delays).toEqual([
      '0ms',    // eyebrow
      '60ms',   // h2
      '120ms',  // intro
      '180ms',  // email row
      '200ms',  // cv row
      '220ms',  // social row
      '220ms',  // location — same delay, the prototype's own choice
      '160ms',  // form
    ]);
  });

  it('renders the form itself as the reveal target', () => {
    const { container } = renderSection();
    expect(container.querySelector('form')).toHaveAttribute('data-reveal');
  });
});
