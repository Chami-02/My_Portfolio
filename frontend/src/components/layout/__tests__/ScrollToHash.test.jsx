// frontend/src/components/layout/__tests__/ScrollToHash.test.jsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
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

/**
 * rAF is queued, not synchronous — the component schedules a frame so
 * the newly-committed route has laid out before it measures.
 *
 * ⚠️ PF-94: this DRAINS, it does not flush once. The component no
 * longer scrolls a single time — it re-schedules itself until the page
 * stops moving, so a one-shot flush would leave the loop suspended
 * mid-poll and `settledForKey` never set. Every "does not re-scroll"
 * assertion in this file depends on the settle having actually
 * happened, and would report a false PASS against a component that
 * simply stalled.
 *
 * In jsdom nothing has layout — `getBoundingClientRect()` is all zeros
 * and `scrollY` is 0 — so the target never appears to move and the
 * loop reaches quiescence in three frames. The cap is a runaway guard,
 * not a timing assumption.
 */
let rafQueue = [];
const flushRaf = (maxFrames = 20) => {
  for (let i = 0; i < maxFrames && rafQueue.length; i += 1) {
    const q = rafQueue;
    rafQueue = [];
    q.forEach((cb) => cb(0));
  }
};

/** Exactly one animation frame, for asserting what happens BETWEEN
 *  frames — a drain would collapse a shift and its correction into one
 *  indistinguishable step. */
const stepRaf = () => {
  const q = rafQueue;
  rafQueue = [];
  q.forEach((cb) => cb(0));
};

/**
 * Give a target a controllable document position. jsdom has no layout,
 * so every rect is zeros and nothing ever appears to move — which is
 * precisely the shift PF-94 is about, and it has to be simulated.
 */
const positionAt = (el, get) => {
  el.getBoundingClientRect = () => ({
    top: get(), left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
  });
};

const mountTarget = (id) => {
  const el = document.createElement('div');
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
};

/**
 * ⚠️ ScrollToHash reads `useIsFetching()`, so it requires a
 * QueryClientProvider. In the app it has always had one — main.jsx
 * wraps <App /> — but this suite rendered it bare until PF-94, and a
 * bare render now throws "No QueryClient set", which reads like a
 * routing bug and is not one.
 */
const withProviders = (ui, { splashReady = true } = {}) => (
  <QueryClientProvider client={new QueryClient()}>
    <SplashProvider initialReady={splashReady}>{ui}</SplashProvider>
  </QueryClientProvider>
);

const at = (path, { splashReady = true } = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      {withProviders(<ScrollToHash />, { splashReady })}
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
        {withProviders(
          <>
            <Releaser />
            <ScrollToHash />
          </>,
          { splashReady: false },
        )}
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

  /**
   * ⚠️ PF-88. The footer's REPLAY INTRO button closes and reopens the
   * readiness gate mid-session, and `splashReady` is one of this
   * effect's dependencies — so without the per-navigation guard a user
   * sitting at /#projects who clicks replay gets the scroll-to-top, then
   * the whole ~5.65s splash, and then a silent yank back down to
   * #projects the instant the gate reopens. Nothing errors; the button
   * just stops ending where it says it does.
   *
   * Mutation-tested by deleting the `scrolledForKey` guard in
   * ScrollToHash: this fails and every other test in the file passes.
   */
  it('does not re-scroll when the splash gate merely reopens', () => {
    const el = mountTarget('projects');
    let release;

    function Releaser() {
      const { setReady } = useSplashControls();
      release = setReady;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/#projects']}>
        {withProviders(
          <>
            <Releaser />
            <ScrollToHash />
          </>,
        )}
      </MemoryRouter>,
    );
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);

    // What a replay does: close the gate, then reopen it 320ms into the
    // new splash's exit.
    act(() => release(false));
    act(() => release(true));
    flushRaf();

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('still scrolls the FIRST time the gate opens, mid-splash', () => {
    // The control for the guard above. A guard that simply never
    // scrolled would also report "called once" — this pins the case the
    // splash gate exists for: the effect bailed while ready was false,
    // so nothing was marked handled and the real jump still happens.
    const el = mountTarget('projects');
    let release;

    function Releaser() {
      const { setReady } = useSplashControls();
      release = setReady;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/#projects']}>
        {withProviders(
          <>
            <Releaser />
            <ScrollToHash />
          </>,
          { splashReady: false },
        )}
      </MemoryRouter>,
    );
    flushRaf();
    expect(el.scrollIntoView).not.toHaveBeenCalled();

    act(() => release(true));
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  // ══ PF-94: the page keeps moving after the first scroll ══════════

  /**
   * ⚠️ THE DEFECT THIS EXISTS FOR. Measured on the production build,
   * cold arrival at a 404 → click BLOG:
   *
   *     t=95ms   #projects 1150px   #blog at 3933   ← scroll ran here
   *     t=693ms  #projects 1264px   #blog at 4048   ← content arrived
   *
   * Projects' loading placeholder is ~114px shorter than its real
   * content, so #blog and #contact were left at 186px instead of 71px,
   * permanently. The numbers below are those measurements.
   *
   * Mutation-tested against the pre-PF-94 component (scroll once in a
   * rAF, then mark handled): this fails with 1 call where 2 are needed,
   * and it is the only test in the file that does.
   */
  it('re-scrolls when a late layout shift moves the target under it', () => {
    const el = mountTarget('blog');
    let top = 3933;
    positionAt(el, () => top);

    at('/#blog');
    stepRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);

    // Projects' query resolves and its real content pushes #blog down.
    top = 4048;
    stepRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  /**
   * The counterweight, and the reason the loop keys on MOVEMENT rather
   * than on being off-target: a page that never shifts — an instant or
   * already-cached API — must be scrolled exactly once. A component
   * that re-issued scrollIntoView() every frame would also land in the
   * right place, and would restart the browser's smooth animation on
   * each of those frames.
   */
  it('scrolls exactly once when the layout never moves', () => {
    const el = mountTarget('blog');
    positionAt(el, () => 4048);

    at('/#blog');
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ The user outranks the anchor. Once someone scrolls, a late
   * correction is a yank rather than a fix.
   *
   * Note the listener is on INPUT (wheel/touch/key) and never on
   * `scroll`: the smooth scroll this component starts fires `scroll` on
   * every frame, so a scroll listener would cancel the very fix it is
   * meant to protect.
   */
  it('stops correcting once the user takes over', () => {
    const el = mountTarget('blog');
    let top = 3933;
    positionAt(el, () => top);

    at('/#blog');
    stepRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('wheel'));
    });

    top = 4048;
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ `useIsFetching() === 0` is part of the settle condition, not
   * decoration. Without it the loop reaches quiescence during the gap
   * between the placeholder rendering and the response arriving —
   * nothing is moving yet — and settles before the shift it exists to
   * catch. jsdom reaches that quiet state in three frames, which is
   * well inside a real network round trip.
   *
   * Mutation-tested by dropping `isFetching === 0` from the settle
   * condition: this fails, and nothing else does.
   */
  it('does not settle while a query is still in flight', () => {
    const el = mountTarget('blog');
    let top = 3933;
    positionAt(el, () => top);

    const client = new QueryClient();
    // A query that never resolves, so useIsFetching() stays at 1.
    function Pending() {
      useQuery({ queryKey: ['pf94'], queryFn: () => new Promise(() => {}) });
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/#blog']}>
        <QueryClientProvider client={client}>
          <SplashProvider initialReady>
            <Pending />
            <ScrollToHash />
          </SplashProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Long past the three frames it would take to go quiet.
    flushRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);

    // The response finally lands and shifts the page.
    top = 4048;
    stepRaf();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('cancels its pending frame on unmount', () => {
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    mountTarget('projects');
    const { unmount } = at('/#projects');
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
