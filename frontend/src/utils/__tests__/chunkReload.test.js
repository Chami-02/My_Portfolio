// PF-127 — a lazy chunk deleted by a newer deploy reloads the page ONCE.
//
// Driven through installChunkReload and a real dispatched event, the same
// path the browser takes, not by calling the handler directly.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installChunkReload, RELOAD_KEY, RELOAD_WINDOW_MS } from '../chunkReload';

function fakeWindow(storage = window.sessionStorage) {
  const win = new EventTarget();
  win.sessionStorage = storage;
  win.location = { reload: vi.fn() };
  installChunkReload(win);
  return win;
}

const fire = (win) => {
  const event = new Event('vite:preloadError', { cancelable: true });
  win.dispatchEvent(event);
  return event;
};

describe('installChunkReload (PF-127)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('reloads on a failed chunk and swallows the error', () => {
    const win = fakeWindow();
    const event = fire(win);
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT reload a second time inside the window — a real outage must not loop', () => {
    const win = fakeWindow();
    fire(win);
    const second = fire(win);
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);   // left to throw (router error page)
  });

  it('remembers the reload across the reload itself (sessionStorage, not memory)', () => {
    fire(fakeWindow());
    const afterReload = fakeWindow();   // a fresh page load, same tab
    fire(afterReload);
    expect(afterReload.location.reload).not.toHaveBeenCalled();
  });

  it('reloads again once the window has passed (the next deploy)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const win = fakeWindow();
    fire(win);
    vi.setSystemTime(1_000_000 + RELOAD_WINDOW_MS + 1);
    fire(win);
    expect(win.location.reload).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(RELOAD_KEY)).toBe(String(1_000_000 + RELOAD_WINDOW_MS + 1));
  });

  it('never reloads when storage is blocked — the loop guard cannot hold', () => {
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    const win = fakeWindow(blocked);
    fire(win);
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it('ignores every other event', () => {
    const win = fakeWindow();
    win.dispatchEvent(new Event('error'));
    expect(win.location.reload).not.toHaveBeenCalled();
  });
});
