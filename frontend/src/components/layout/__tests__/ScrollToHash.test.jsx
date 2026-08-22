// frontend/src/components/layout/__tests__/ScrollToHash.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ScrollToHash } from '../ScrollToHash';
import { SplashProvider } from '../../../providers/SplashProvider';
import { useSplashControls } from '../../../hooks/useSplashControls';

/**
 * ScrollToHash — 2026-08-22.
 *
 * React Router v7 performs the navigation and ignores the fragment, so
 * without this the route-aware navbar's off-home links would navigate
 * home and leave the viewport at the top.
 */
const here = dirname(fileURLToPath(import.meta.url));
const motionCss = readFileSync(
  resolve(here, '../../../styles/motion.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** rAF is queued, not synchronous — the component schedules one frame
 *  so the newly-committed route has laid out before it measures. */
let rafQueue = [];
const flushRaf = () => {
  const q = rafQueue;
  rafQueue = [];
  q.forEach((cb) => cb(0));
};

const mountTarget = (id) => {
  const el = document.createElement('div');
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
};

const at = (path, { splashReady = true } = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SplashProvider initialReady={splashReady}>
        <ScrollToHash />
      </SplashProvider>
    </MemoryRouter>,
  );

describe('ScrollToHash', () => {
  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('scrolls the hash target into view', () => {
    const el = mountTarget('projects');
    at('/#projects');
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('does nothing when there is no hash', () => {
    const el = mountTarget('projects');
    at('/');
    flushRaf();
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not throw when the hash names no element', () => {
    at('/#nothing-here');
    expect(() => flushRaf()).not.toThrow();
  });

  it('does not throw on a hash that is not a valid selector', () => {
    // "#2024" and friends throw in querySelector. A malformed fragment
    // is not a reason to break navigation.
    at('/#2024');
    expect(() => flushRaf()).not.toThrow();
  });

  // ══ the splash gate ═══════════════════════════════════════════════

  it('HOLDS the jump while the splash is up', () => {
    // A cold link to /#projects with no ?nosplash mounts the splash AND
    // wants to scroll. Scrolling behind a z-index-100 overlay puts the
    // page mid-document before the user has seen the top of it, while
    // every Reveal is still held by initialReady={false} — so the splash
    // would lift onto a mid-page view whose entrances then arm there.
    const el = mountTarget('projects');
    at('/#projects', { splashReady: false });
    flushRaf();
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('fires on the frame the splash releases', () => {
    // ⚠️ The gate is opened through setReady(), NOT by re-rendering with
    // a different initialReady. That prop only SEEDS the state — a
    // second value is ignored, exactly as SplashProvider documents — so
    // a rerender-based version of this test would report "still held"
    // against correct code and look like a bug in the component.
    const el = mountTarget('projects');
    let release;

    function Releaser() {
      const { setReady } = useSplashControls();
      release = setReady;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/#projects']}>
        <SplashProvider initialReady={false}>
          <Releaser />
          <ScrollToHash />
        </SplashProvider>
      </MemoryRouter>,
    );
    flushRaf();
    expect(el.scrollIntoView).not.toHaveBeenCalled();

    // What Splash itself does 320ms into its exit.
    act(() => release(true));
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  // ══ reduced motion ════════════════════════════════════════════════

  it('passes NO behavior, so the jump inherits the root scroll-behavior', () => {
    // ⚠️ This is the reduced-motion guard, and it is asserted on the
    // ARGUMENT rather than on an observed scroll, because jsdom does not
    // implement scrolling at all.
    //
    // Omitting `behavior` means scrollIntoView() reads the root's
    // computed scroll-behavior: `smooth` normally, `auto` under
    // prefers-reduced-motion. Passing `{ behavior: 'smooth' }` would
    // animate the jump for exactly the users who asked it not to, and
    // would be invisible to anyone not testing with reduce on.
    const el = mountTarget('projects');
    at('/#projects');
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalledWith();
  });

  it('the root scroll-behavior override it relies on still exists', () => {
    // ⚠️ motion.css's ROOT-ELEMENT rule, not the universal one.
    // `html[data-motion="reduced"] *` is a DESCENDANT selector and
    // cannot reach <html> itself, so the document's scrolling box would
    // keep `scroll-behavior: smooth` under reduce. PF-79 found that in a
    // browser and added the root rule; it has regressed once already,
    // which is why this component's own suite re-asserts it rather than
    // trusting styles/__tests__/motion.test.js alone.
    expect(motionCss).toMatch(
      /html\[data-motion=['"]reduced['"]\][^*{]*\{[^}]*scroll-behavior:\s*auto/,
    );
  });

  // ══ re-navigation ═════════════════════════════════════════════════

  it('cancels its pending frame on unmount', () => {
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    mountTarget('projects');
    const { unmount } = at('/#projects');
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
