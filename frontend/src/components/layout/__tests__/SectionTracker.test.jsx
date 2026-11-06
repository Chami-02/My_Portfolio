// PF-149 — "most reached sections": what the tracker sends, and when it stays quiet.
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SplashContext } from '../../../providers/SplashContext';
import { SectionTracker } from '../SectionTracker';
import { hasReached } from '../../../utils/visits';
import { session } from '../../../services/session';

let observers;
let fetchMock;

class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    observers.push(this);
  }
  observe(target) { this.targets.add(target); }
  unobserve(target) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
}

const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));

/** The visitor switching away, the moment reached sections are sent. */
const hide = () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
};

/** The browser reporting `visible` px of a section `height` px tall, on an 800 px screen. */
const report = (id, visible, height = 1000) => act(() => {
  observers.forEach((observer) => {
    const target = [...observer.targets].find((el) => el.id === id);
    if (!target) return;
    observer.callback([{
      target,
      intersectionRect:   { height: visible },
      boundingClientRect: { height },
      rootBounds:         { height: 800 },
    }]);
  });
});

const renderTracker = ({ ready = true, ids = ['hero', 'about', 'skills'] } = {}) => render(
  <StrictMode>
    <SplashContext.Provider value={{ ready }}>
      <SectionTracker />
      {ids.map((id) => <section key={id} id={id} />)}
    </SplashContext.Provider>
  </StrictMode>,
);

beforeEach(() => {
  observers = [];
  localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue({ status: 204 });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  delete document.visibilityState;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('hasReached', () => {
  it.each([
    [400, 1000, 800, true],   // half the screen is showing it
    [399, 1000, 800, false],
    [400, 3000, 800, true],   // a tall section: half the screen is enough
    [100, 200, 800, true],    // a short one: half of itself is enough
    [99, 200, 800, false],
    [0, 0, 800, false],       // an empty section is never reached
  ])('%i of %i on a %i screen → %s', (visible, section, viewport, expected) => {
    expect(hasReached(visible, section, viewport)).toBe(expected);
  });
});

describe('SectionTracker', () => {
  it('counts a section once it has been properly seen', () => {
    renderTracker();
    report('about', 600);
    hide();
    expect(sent()).toEqual([{ type: 'section', sections: ['about'] }]);
  });

  it('does not count a section that only just appeared', () => {
    renderTracker();
    report('about', 20);
    hide();
    expect(sent()).toEqual([]);
  });

  it('counts a section once per page opened, even under StrictMode', () => {
    renderTracker();
    report('about', 600);
    report('about', 800);
    hide();
    expect(sent()).toEqual([{ type: 'section', sections: ['about'] }]);
  });

  it('counts once when the browser reports a section twice in one update', () => {
    renderTracker();
    act(() => {
      observers.forEach((observer) => {
        const target = [...observer.targets].find((el) => el.id === 'about');
        if (!target) return;
        const entry = {
          target, intersectionRect: { height: 600 }, boundingClientRect: { height: 1000 }, rootBounds: { height: 800 },
        };
        observer.callback([entry, entry]);
      });
    });
    hide();
    expect(sent()).toEqual([{ type: 'section', sections: ['about'] }]);
  });

  it('sends every section reached as ONE request', () => {
    renderTracker();
    report('hero', 600);
    report('skills', 600);
    expect(sent()).toEqual([]);
    hide();
    expect(sent()).toEqual([{ type: 'section', sections: ['hero', 'skills'] }]);
  });

  it('sends nothing twice, and only what is new after coming back', () => {
    renderTracker();
    report('hero', 600);
    hide();
    hide();
    expect(sent()).toHaveLength(1);
    delete document.visibilityState;
    report('skills', 600);
    hide();
    expect(sent()[1]).toEqual({ type: 'section', sections: ['skills'] });
  });

  it('coming BACK to the tab sends nothing', () => {
    renderTracker();
    report('hero', 600);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(sent()).toEqual([]);
  });

  it('sends when the page is closed', () => {
    renderTracker();
    report('hero', 600);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(sent()).toEqual([{ type: 'section', sections: ['hero'] }]);
  });

  it('sends when the visitor moves to another page of the site', () => {
    const { unmount } = renderTracker();
    report('hero', 600);
    unmount();
    expect(sent()).toEqual([{ type: 'section', sections: ['hero'] }]);
  });

  it('sends nothing when no section was reached', () => {
    const { unmount } = renderTracker();
    hide();
    unmount();
    expect(sent()).toEqual([]);
  });

  it('waits for the splash, which covers the hero', () => {
    renderTracker({ ready: false });
    expect(observers).toHaveLength(0);
  });

  it('ignores anything that is not one of the six sections', () => {
    renderTracker({ ids: ['hero', 'secret'] });
    report('secret', 800);
    hide();
    expect(sent()).toEqual([]);
  });

  it('leaves out the owner\'s own browser', () => {
    vi.spyOn(session, 'isOwnerDevice').mockReturnValue(true);
    renderTracker();
    expect(observers).toHaveLength(0);
  });

  it('leaves out a browser that asked not to be followed', () => {
    vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: true });
    renderTracker();
    expect(observers).toHaveLength(0);
  });

  it('stops watching when the page is left', () => {
    const { unmount } = renderTracker();
    unmount();
    observers.forEach((observer) => expect(observer.targets.size).toBe(0));
  });

  it('does nothing in a browser with no observer', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => renderTracker()).not.toThrow();
    expect(sent()).toEqual([]);
  });
});
