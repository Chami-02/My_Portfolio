// frontend/src/components/layout/__tests__/Navbar.test.jsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { ThemeProvider } from '../../../providers/ThemeProvider';

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
});
