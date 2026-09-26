// frontend/src/hooks/__tests__/useFormGuard.test.jsx
//
// The refuse-shake-and-mark behaviour every admin panel shares.
//
// ⚠️ `onShakeEnd` is exercised HERE rather than in a panel test, and not by
// preference. `animationend` cannot be fired in this environment at all:
// measured, jsdom defines no `AnimationEvent` constructor, so testing-library's
// `fireEvent.animationEnd` and a hand-built `new Event('animationend')` both
// dispatch without error and React's `onAnimationEnd` never runs — with or
// without `bubbles`. A component test written the obvious way fails as though
// the component were broken. Here the callback is simply called.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFormGuard } from '../useFormGuard';

// The guard defers focus one frame so the paint carrying aria-invalid has
// landed. A queue that can be flushed on demand, rather than a synchronous
// stub — the same reasoning HeroSection.test.jsx records.
let rafQueue = [];
const flushRaf = () => {
  const pending = rafQueue;
  rafQueue = [];
  act(() => { pending.forEach((cb) => cb()); });
};

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb) => rafQueue.push(cb));
  document.body.innerHTML = '';
});

const setup = (validate) => renderHook(() => useFormGuard(validate, 'about'));

const NONE = () => [];
const ONE  = () => [{ field: 'email', message: 'That email address looks off.' }];

describe('check', () => {
  it('returns true and stays quiet on a clean form', () => {
    const { result } = setup(NONE);
    let ok;
    act(() => { ok = result.current.check({}); });

    expect(ok).toBe(true);
    expect(result.current.errors).toEqual([]);
    expect(result.current.shaking).toBe(false);
  });

  it('returns FALSE on problems — the caller must be able to bail', () => {
    // ⚠️ A boolean, never a throw. A guard that threw would need a try/catch in
    // every handler, and the one place someone forgets is a save that goes
    // through invalid.
    const { result } = setup(ONE);
    let ok;
    act(() => { ok = result.current.check({}); });

    expect(ok).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.shaking).toBe(true);
  });

  it('exposes the message through errorFor', () => {
    const { result } = setup(ONE);
    act(() => { result.current.check({}); });

    expect(result.current.errorFor('email')).toBe('That email address looks off.');
    expect(result.current.errorFor('location')).toBeUndefined();
  });

  it('replaces the previous errors rather than accumulating them', () => {
    // Otherwise a field fixed between two presses stays marked forever, and the
    // banner's count climbs while the form improves.
    const validate = vi.fn()
      .mockReturnValueOnce([
        { field: 'email', message: 'a' },
        { field: 'stats.0.value', message: 'b' },
      ])
      .mockReturnValueOnce([{ field: 'email', message: 'a' }]);

    const { result } = setup(validate);
    act(() => { result.current.check({}); });
    expect(result.current.errors).toHaveLength(2);

    act(() => { result.current.check({}); });
    expect(result.current.errors).toHaveLength(1);
  });

  it('survives a validator that returns nothing at all', () => {
    const { result } = setup(() => undefined);
    let ok;
    act(() => { ok = result.current.check({}); });
    expect(ok).toBe(true);
  });
});

describe('focus', () => {
  it('focuses the FIRST offending field, by its derived id', () => {
    document.body.innerHTML = '<input id="about-email" /><input id="about-location" />';
    const { result } = setup(ONE);

    act(() => { result.current.check({}); });
    flushRaf();

    expect(document.activeElement).toBe(document.getElementById('about-email'));
  });

  it('flattens a dotted path to reach a row input', () => {
    document.body.innerHTML = '<input id="about-stats-0-value" />';
    const { result } = setup(() => [{ field: 'stats.0.value', message: 'x' }]);

    act(() => { result.current.check({}); });
    flushRaf();

    expect(document.activeElement).toBe(document.getElementById('about-stats-0-value'));
  });

  it('scrolls the field to the CENTRE, not under the sticky header', () => {
    // focus()'s own scrolling puts the field at the very top of the viewport,
    // which on /admin is behind the sticky header. jsdom implements no
    // scrollIntoView, so it is supplied here — which is also what proves the
    // optional call in the hook is not quietly skipping it in a real browser.
    document.body.innerHTML = '<input id="about-email" />';
    const el = document.getElementById('about-email');
    el.scrollIntoView = vi.fn();

    const { result } = setup(ONE);
    act(() => { result.current.check({}); });
    flushRaf();

    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('does not throw when the field has no input on screen', () => {
    // A validator can name a field the panel has not rendered — a row inside a
    // collapsed card, say. Refusing the save still has to work.
    const { result } = setup(ONE);
    act(() => { result.current.check({}); });
    expect(() => flushRaf()).not.toThrow();
  });

  it('defers to a frame rather than focusing during the same tick', () => {
    // ⚠️ The paint carrying aria-invalid has not landed when check() returns,
    // and the element may not exist yet. Focusing immediately finds nothing and
    // silently does nothing, which looks exactly like "the first field already
    // had focus".
    document.body.innerHTML = '<input id="about-email" />';
    const { result } = setup(ONE);

    act(() => { result.current.check({}); });
    expect(document.activeElement).not.toBe(document.getElementById('about-email'));

    flushRaf();
    expect(document.activeElement).toBe(document.getElementById('about-email'));
  });
});

describe('clearField', () => {
  it('drops one field and leaves the rest marked', () => {
    // ⚠️ Per field, never the whole list. Clearing everything on the first
    // keystroke wipes the marks off fields that are still wrong, and the
    // banner's count then disagrees with what is on screen.
    const { result } = setup(() => [
      { field: 'email', message: 'a' },
      { field: 'stats.0.value', message: 'b' },
    ]);
    act(() => { result.current.check({}); });

    act(() => { result.current.clearField('email'); });

    expect(result.current.errorFor('email')).toBeUndefined();
    expect(result.current.errorFor('stats.0.value')).toBe('b');
  });

  it('is a no-op for a field that was never in error', () => {
    const { result } = setup(ONE);
    act(() => { result.current.check({}); });
    const before = result.current.errors;

    act(() => { result.current.clearField('location'); });

    // Same array reference — the hook bails out rather than re-rendering.
    expect(result.current.errors).toBe(before);
  });
});

describe('the shake', () => {
  it('bumps the key on every refusal, so the animation restarts', () => {
    // Re-adding a class React already rendered restarts nothing. The key is
    // what forces the remount that restarts it.
    const { result } = setup(ONE);

    act(() => { result.current.check({}); });
    const first = result.current.shakeKey;

    act(() => { result.current.onShakeEnd(); });
    act(() => { result.current.check({}); });

    expect(result.current.shakeKey).toBeGreaterThan(first);
  });

  it('does not bump the key when the form is clean', () => {
    const { result } = setup(NONE);
    const before = result.current.shakeKey;
    act(() => { result.current.check({}); });
    expect(result.current.shakeKey).toBe(before);
  });

  it('stops shaking when the animation reports it ended', () => {
    const { result } = setup(ONE);
    act(() => { result.current.check({}); });
    expect(result.current.shaking).toBe(true);

    act(() => { result.current.onShakeEnd(); });
    expect(result.current.shaking).toBe(false);
  });
});

describe('reset', () => {
  it('drops every error — for a successful save, or a REVERT', () => {
    const { result } = setup(ONE);
    act(() => { result.current.check({}); });

    act(() => { result.current.reset(); });

    expect(result.current.errors).toEqual([]);
  });
});
