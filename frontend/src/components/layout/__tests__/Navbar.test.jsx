// frontend/src/components/layout/__tests__/Navbar.test.jsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Navbar } from '../Navbar';

import { ThemeProvider } from '../../../providers/ThemeProvider';

const navCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../Navbar.module.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const withProviders = (ui) => (
  <MemoryRouter>
    <ThemeProvider>{ui}</ThemeProvider>
  </MemoryRouter>
);

/**
 * rAF harness.
 *
 * A synchronous rAF mock — `cb => cb()` — looks simpler and is wrong
 * here, because of the order of these two statements in Navbar:
 *
 *     raf = requestAnimationFrame(() => { raf = null; ... });
 *
 * Run the callback synchronously and it clears `raf` BEFORE the outer
 * assignment stores the returned id, leaving `raf` truthy forever.
 * Every subsequent scroll then hits the `if (raf) return` guard and
 * the bar never moves again — a test that quietly asserts nothing.
 *
 * Queueing instead reproduces the real contract: an id back now, the
 * callback later.
 */
let rafQueue = [];
let rafId = 0;

const flushRaf = () => {
  const queued = rafQueue;
  rafQueue = [];
  queued.forEach((cb) => cb(performance.now()));
};

/** jsdom leaves scrollY at 0, and Navbar falls through to
 *  scrollingElement.scrollTop — so drive the scroll position there
 *  rather than fighting window.scrollY's read-only accessor. */
const setScroll = (scrollTop, scrollHeight = 3000) => {
  Object.defineProperty(document, 'scrollingElement', {
    value: { scrollTop, scrollHeight },
    configurable: true,
  });
};

describe('Navbar (PF-79)', () => {
  beforeEach(() => {
    rafQueue = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafQueue.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    setScroll(0);
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  it('renders all four nav links plus CONTACT and ADMIN', () => {
    render(withProviders(<Navbar />));
    ['ABOUT', 'SKILLS', 'PROJECTS', 'BLOG', 'CONTACT', 'ADMIN'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('does not highlight an active section — the prototype has no such state', () => {
    render(withProviders(<Navbar />));
    // Phase 1's navbar tracked activeId and restyled the matching link.
    // The prototype has nothing equivalent, so all four carry the same
    // class. Guards against the old behaviour creeping back in.
    const classes = ['ABOUT', 'SKILLS', 'PROJECTS', 'BLOG'].map(
      (label) => screen.getByText(label).className,
    );
    expect(new Set(classes).size).toBe(1);
  });

  it('ADMIN links to /admin/login via react-router, not a raw href', () => {
    render(withProviders(<Navbar />));
    const admin = screen.getByText('ADMIN').closest('a');
    expect(admin).toHaveAttribute('href', '/admin/login');
  });

  it('imports the logo rather than pointing at an unserved path', () => {
    const { container } = render(withProviders(<Navbar />));
    const src = container.querySelector('img').getAttribute('src');
    // docs/design/assets/ is not served by anything, and public/ has no
    // logo. A literal "/assets/logo.png" renders a broken image with no
    // error — the exact silent 404 CLAUDE.md documents.
    expect(src).not.toBe('/assets/logo.png');
    expect(src).toBeTruthy();
  });

  it('reflects scroll position immediately on mount, not just after the first scroll event', () => {
    setScroll(2100); // (3000 - 900) max → 100%

    const { container } = render(withProviders(<Navbar />));
    act(() => flushRaf());

    const fill = container.querySelector('[class*="progressFill"]');
    expect(fill.style.width).toBe('100%');
  });

  it('updates the progress bar width on scroll', () => {
    const { container } = render(withProviders(<Navbar />));
    act(() => flushRaf()); // drain the mount call

    setScroll(1050); // half of the (3000 - 900) max
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => flushRaf());

    const fill = container.querySelector('[class*="progressFill"]');
    expect(fill.style.width).toBe('50%');
  });

  it('coalesces bursts of scroll events into a single frame', () => {
    render(withProviders(<Navbar />));
    act(() => flushRaf());

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });
    expect(rafQueue).toHaveLength(1);
  });

  it('leaves the bar at 0% when the page is too short to scroll', () => {
    setScroll(0, 400); // scrollHeight below innerHeight → max is negative

    const { container } = render(withProviders(<Navbar />));
    act(() => flushRaf());

    const fill = container.querySelector('[class*="progressFill"]');
    expect(fill.style.width).toBe('0%');
  });

  it('opens the mobile overlay on hamburger click', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when a link inside the overlay is clicked', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });

    const links = screen.getAllByText('ABOUT');
    act(() => {
      links[links.length - 1].click(); // the overlay's copy
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a click outside the menu', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });

    // The dialog root IS the backdrop. A separate backdrop layer under
    // a full-size panel never receives a click — whichever box is on
    // top takes all of them — which is how this was originally built
    // and how a browser check caught it.
    act(() => {
      screen.getByRole('dialog').click();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close on a click inside the menu', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });

    // The theme toggle lives in the overlay. Without the nav stopping
    // the bubble, toggling the theme would also dismiss the menu.
    const toggles = screen.getAllByTestId('theme-toggle');
    act(() => {
      toggles[toggles.length - 1].click();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps exactly two controls named "Close menu"', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });

    // The hamburger relabels itself while open, and the overlay has its
    // own button. A third — e.g. a full-viewport backdrop <button> —
    // would be tab-order dead weight and make the real one impossible
    // to pick out by name.
    expect(screen.getAllByLabelText('Close menu')).toHaveLength(2);
  });

  it('locks body scroll while the overlay is open, restores it on close', () => {
    render(withProviders(<Navbar />));
    expect(document.body.style.overflow).not.toBe('hidden');

    act(() => {
      screen.getByLabelText('Open menu').click();
    });
    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      screen.getAllByLabelText('Close menu')[0].click();
    });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('moves focus into the overlay on open', () => {
    render(withProviders(<Navbar />));
    act(() => {
      screen.getByLabelText('Open menu').click();
    });
    const links = screen.getAllByText('ABOUT');
    expect(document.activeElement).toBe(links[links.length - 1]);
  });

  it('removes the scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(withProviders(<Navbar />));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  /**
   * Nested rather than a sibling describe so these inherit the rAF
   * harness and scroll stubs above — Navbar's progress-bar effect needs
   * them regardless of what the test is actually asserting.
   */
  describe('keyboard a11y (PF-83)', () => {
    /** The overlay's focusable set, in the same document order the
     *  component's own querySelectorAll sees. Deliberately re-queried
     *  from the DOM rather than hardcoded to a count: the assertion is
     *  "Tab wraps at the real edges", not "there are seven of them". */
    const overlayFocusables = () =>
      screen
        .getByRole('dialog')
        .querySelectorAll('a[href], button:not([disabled])');

    const openMenu = () => {
      render(withProviders(<Navbar />));
      act(() => {
        screen.getByLabelText('Open menu').click();
      });
    };

    /** cancelable, so the handler's preventDefault() is a real call and
     *  not silently inert. */
    const pressTab = (shiftKey = false) => {
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true }),
        );
      });
    };

    it('wraps Tab from the last focusable back to the first', () => {
      openMenu();
      const focusable = overlayFocusables();
      const last = focusable[focusable.length - 1];

      last.focus();
      expect(document.activeElement).toBe(last);

      pressTab();
      expect(document.activeElement).toBe(focusable[0]);
    });

    it('wraps Shift+Tab from the first focusable back to the last', () => {
      openMenu();
      const focusable = overlayFocusables();

      focusable[0].focus();
      pressTab(true);
      expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    });

    it('leaves Tab alone in the middle of the overlay', () => {
      openMenu();
      const focusable = overlayFocusables();
      const middle = focusable[1];

      middle.focus();
      pressTab();

      // The trap only intervenes at the edges — the browser's own
      // sequential navigation handles everything between them, and jsdom
      // does not implement it, so focus simply stays put here. Asserting
      // that documents the boundary: a trap that moved focus on EVERY
      // Tab would pass both wrap tests above and still be broken.
      expect(document.activeElement).toBe(middle);
    });

    it('pulls focus back in when it has escaped the overlay', () => {
      openMenu();
      const focusable = overlayFocusables();

      // Focus outside the dialog entirely, as happens when the user
      // clicks the browser chrome and tabs back. Neither edge test
      // matches in that state, so without the containment check the
      // default Tab walks the header behind the overlay.
      //
      // blur(), not document.body.focus(): <body> is not focusable, so
      // focusing it is a silent no-op in jsdom and activeElement stays on
      // the overlay link the open effect focused — which made the first
      // version of this test assert the middle-of-the-set case instead
      // and fail against correct code. blur() genuinely resets
      // activeElement to <body>.
      act(() => {
        document.activeElement.blur();
      });
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(false);

      pressTab();
      expect(document.activeElement).toBe(focusable[0]);
    });

    it('returns focus to the hamburger when the overlay closes', () => {
      render(withProviders(<Navbar />));
      const trigger = screen.getByLabelText('Open menu');
      trigger.focus();

      act(() => {
        trigger.click();
      });
      expect(document.activeElement).not.toBe(trigger);

      // Queried inside the dialog on purpose. While the overlay is open
      // TWO elements carry aria-label="Close menu" — the hamburger, whose
      // label flips when open, and the overlay's own × button — so a bare
      // getByLabelText('Close menu') throws on multiple matches.
      const closeButton = screen
        .getByRole('dialog')
        .querySelector('button[aria-label="Close menu"]');
      act(() => {
        closeButton.click();
      });

      expect(document.activeElement).toBe(trigger);
    });

    it('removes the document keydown listener when the overlay closes', () => {
      // ⚠️ Asserted against removeEventListener, NOT by pressing Tab
      // afterwards and checking that focus stays put. That version was
      // written first and mutation testing showed it was blind: React
      // nulls overlayRef on unmount, so a LEAKED listener still bails on
      // `if (!root) return` and does nothing observable. Deleting the
      // cleanup entirely left the test green.
      //
      // The listener is on document, and the Escape handler above is on
      // window, so this is unambiguous about which one it is watching.
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      render(withProviders(<Navbar />));
      const trigger = screen.getByLabelText('Open menu');

      act(() => {
        trigger.click();
      });
      expect(removeSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));

      act(() => {
        trigger.click();
      });
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('gives the logo alt text distinct from the hero portrait and splash', () => {
      render(withProviders(<Navbar />));

      // All three used to read exactly "Parindra Gallage". The sibling
      // halves of this assertion live in HeroSection.test.jsx and
      // Splash.test.jsx — one file per module, so each pins its own
      // string and none can drift back to the shared one unnoticed.
      const logo = screen.getByRole('img');
      expect(logo).toHaveAttribute('alt', 'Parindra Gallage — back to top');
    });
  });
});

/**
 * ══ Route-awareness (2026-08-22) ══════════════════════════════════════
 *
 * ⚠️ THE BUG THIS COVERS. App.jsx mounts <Navbar /> on `path="*"`, and
 * every link used to be a bare hash — so on NotFoundPage and on /blog
 * all six resolved to nothing. PF-86 then pointed five Blog-teaser links
 * at /blog, which has no route, putting the dead chrome two clicks from
 * the home page.
 *
 * Deliberately a separate describe with its own router setup: the block
 * above renders at MemoryRouter's default "/" and its assertions are the
 * regression guard that the HOME page did not change. e2e's
 * `a[href="#about"]` selectors depend on exactly that.
 */
describe('route-awareness (2026-08-22)', () => {
  const at = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <Navbar />
        </ThemeProvider>
      </MemoryRouter>,
    );

  const hrefOf = (label) => screen.getByText(label).closest('a').getAttribute('href');

  beforeEach(() => {
    // The scroll effect runs on every render regardless of the route.
    setScroll(0);
  });

  /* The pure model's own tests live in utils/__tests__/nav.test.js —
     navModel() and isBlogPath() moved to utils/nav.js so this component
     file exports only a component (react-refresh/only-export-components,
     the same rule that puts contexts in their own module). What stays
     here is what the COMPONENT does with the model. */

  describe('rendered output', () => {
    it('renders bare hashes on "/" — guards e2e a[href="#about"]', () => {
      at('/');
      expect(hrefOf('ABOUT')).toBe('#about');
      expect(hrefOf('CONTACT')).toBe('#contact');
    });

    it('renders absolute links on a 404 route', () => {
      at('/this-page-does-not-exist');
      expect(hrefOf('ABOUT')).toBe('/?nosplash=1#about');
      expect(hrefOf('PROJECTS')).toBe('/?nosplash=1#projects');
    });

    it('renders the blog chrome on /blog, with no BLOG or CONTACT link', () => {
      at('/blog');
      expect(screen.getByText('PROJECTS')).toBeInTheDocument();
      expect(screen.getByText('ABOUT')).toBeInTheDocument();
      expect(screen.getByText('← PORTFOLIO')).toBeInTheDocument();
      expect(screen.queryByText('BLOG')).toBeNull();
      expect(screen.queryByText('CONTACT')).toBeNull();
      expect(screen.queryByText('SKILLS')).toBeNull();
    });

    it('uses react-router for off-home links, not a full document load', () => {
      // A plain <a href> would reload, discarding the TanStack Query
      // cache and re-fetching the two unoptimised hero images. The tell
      // in jsdom is that <Link> renders a same-origin path href while
      // still being intercepted by the router — assert the shape the
      // component chose rather than the navigation itself.
      const { container } = at('/blog');
      const portfolio = screen.getByText('← PORTFOLIO').closest('a');
      expect(portfolio).toHaveAttribute('href', '/?nosplash=1');
      // Nothing in the blog header should still be a dead bare hash.
      const hashes = [...container.querySelectorAll('a[href^="#"]')];
      expect(hashes).toHaveLength(0);
    });

    it('keeps ADMIN last in the nav group on every route', () => {
      // PF-83 specified and verified skip → logo → nav links → CONTACT
      // → toggle → ADMIN. .adminDivider is what separates it visually;
      // moving it in markup breaks the tested sequence.
      //
      // Scoped to <nav> deliberately. The hamburger follows it in the
      // header's DOM and is therefore the last focusable in the whole
      // container — but it is `display: none` above 768px, so it is not
      // in the desktop tab order at all, and below 768px the nav itself
      // is hidden instead. The two are never focusable together, which
      // is why the contract is "last in the nav", not "last in header".
      for (const path of ['/', '/blog', '/nope']) {
        const { container, unmount } = at(path);
        const focusables = [
          ...container
            .querySelector('nav')
            .querySelectorAll('a[href], button:not([disabled])'),
        ];
        expect(focusables.at(-1)).toHaveAttribute('href', '/admin/login');
        unmount();
      }
    });

    it('separates ADMIN with whitespace, NOT a second divider', () => {
      // ⚠️ Guarded as an absence. A divider here was asked for, built,
      // then removed the same day as one separator too many — it boxed
      // the toggle in rather than setting ADMIN apart. Without this the
      // next reader adds it back for the same reason it was added once.
      const { container } = at('/');
      expect(container.querySelector('[class*="adminDivider"]')).toBeNull();
      // The PROTOTYPE's divider, on the LEFT of the toggle, STAYS. The
      // two are easy to conflate; this says exactly one survives.
      expect(container.querySelectorAll('nav [class*="divider"], nav [class*="Divider"]'))
        .toHaveLength(1);
    });
  });

  describe('the mobile overlay follows the route', () => {
    const openAt = (path) => {
      at(path);
      act(() => {
        screen.getByLabelText('Open menu').click();
      });
      return screen
        .getByRole('dialog')
        .querySelectorAll('a[href], button:not([disabled])');
    };

    it('does not leak ADMIN desktop isolation margin into the overlay', () => {
      // ⚠️ .overlayAdminLink composes .adminLink, whose 32px margin-left
      // isolates ADMIN in the DESKTOP header row. Inherited here it
      // shoves the overlay's centred [toggle, ADMIN] pair 32px
      // off-centre — a layout bug with nothing wrong in either rule read
      // on its own. CSS Modules are stubbed under Vitest, so this
      // asserts the stylesheet as text.
      expect(navCss).toMatch(/\.overlayAdminLink\s*\{[^}]*margin-left:\s*0/);
    });

    it('has 8 focusables on "/" — PF-83 count, unchanged', () => {
      // close, 4 links, CONTACT, toggle, ADMIN.
      expect(openAt('/')).toHaveLength(8);
    });

    it('has 6 on /blog — the count is per-route now, not a constant', () => {
      // close, PROJECTS, ABOUT, ← PORTFOLIO, toggle, ADMIN.
      expect(openAt('/blog')).toHaveLength(6);
    });

    it('still ends on ADMIN, so the trap wraps at the right element', () => {
      const focusables = openAt('/blog');
      expect(focusables[focusables.length - 1]).toHaveAttribute(
        'href',
        '/admin/login',
      );
    });

    it('focuses the first link on open even when it is a router Link', () => {
      // Off "/" the overlay links are <Link>, not <a>. NavAnchor takes
      // `ref` as an ordinary prop and react-router v7 forwards it to the
      // anchor it renders; if either half broke, firstLinkRef would be
      // null and focus would stay on the hamburger with nothing erroring.
      at('/blog');
      act(() => {
        screen.getByLabelText('Open menu').click();
      });
      const links = screen.getAllByText('PROJECTS');
      expect(document.activeElement).toBe(links[links.length - 1].closest('a'));
    });
  });
});
