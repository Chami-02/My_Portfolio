// frontend/src/components/common/__tests__/LoadingScreen.test.jsx
//
// PF-130. The owner's rule is the thing under test: nothing for the first
// 300 ms, the mark from then until the content is ready, never extra time.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/ThemeProvider';
import { MotionProvider } from '../../../providers/MotionProvider';
import { LoadingScreen, LOADING_DELAY_MS } from '../LoadingScreen';

/* Theme and Motion are required by the ambient layer the full-screen
   variant mounts (StarfieldCanvas calls useReducedMotion). */
const wrap = (ui) => (
  <ThemeProvider>
    <MotionProvider>{ui}</MotionProvider>
  </ThemeProvider>
);
const draw = (ui) => render(wrap(ui));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('LoadingScreen — the delay', () => {
  it('pins the threshold the owner approved', () => {
    expect(LOADING_DELAY_MS).toBe(300);
  });

  it('paints NOTHING before the delay: an empty status region, no ambient layer', () => {
    const { container } = draw(<LoadingScreen label="Loading…" />);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS - 1); });

    // The live region exists from the first frame, so its text is announced
    // when it arrives — but it holds nothing yet.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the mark, the label and the ambient layer once the wait passes the delay', () => {
    const { container } = draw(<LoadingScreen label="Signing you in…" />);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Signing you in…');
    // Decorative: the label says everything, so the logo is not announced.
    expect(status.querySelector('img')).toHaveAttribute('alt', '');
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('the inline variant shows the mark but mounts no ambient layer of its own', () => {
    const { container } = draw(<LoadingScreen inline label="Loading post…" />);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });

    expect(screen.getByRole('status')).toHaveTextContent('Loading post…');
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('a load that finishes inside the delay never shows anything, and leaves no timer', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = draw(<LoadingScreen label="Loading…" />);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS / 2); });
    unmount();
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS * 2); });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();

    // …and it did not count itself as visible: a fresh screen still waits.
    draw(<LoadingScreen label="Loading…" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('LoadingScreen — the hand-off', () => {
  it('a screen that REPLACES a visible one starts visible (no 300 ms blank between them)', () => {
    // ProtectedRoute's session check hands over to the lazy admin chunk's
    // fallback: two instances. Without the hand-off the second restarts
    // the delay and the owner sees mark → blank → mark.
    const { rerender } = draw(<LoadingScreen key="a" label="Signing you in…" />);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');

    rerender(wrap(<LoadingScreen key="b" label="Signing you in…" />));
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
  });

  it('a screen that replaces a HIDDEN one still waits', () => {
    const { rerender } = draw(<LoadingScreen key="a" label="Loading…" />);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS / 2); });
    rerender(wrap(<LoadingScreen key="b" label="Loading…" />));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('StrictMode\'s double effect does not leave a phantom visible screen behind', () => {
    const { unmount } = render(<StrictMode>{wrap(<LoadingScreen label="Loading…" />)}</StrictMode>);
    act(() => { vi.advanceTimersByTime(LOADING_DELAY_MS); });
    unmount();

    draw(<LoadingScreen label="Loading…" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

/* ── The stylesheets, parsed ────────────────────────────────────── */

const here = dirname(fileURLToPath(import.meta.url));
const rulesOf = (file) => {
  const root = postcss.parse(readFileSync(resolve(here, '..', file), 'utf8'));
  return (selector) => {
    const out = {};
    root.walkRules(selector, (rule) => rule.walkDecls((d) => { out[d.prop] = d.value; }));
    return out;
  };
};

describe('keyframes reach their global carriers', () => {
  // A keyframe NAMED inside a *.module.css is scoped to an identifier no
  // @keyframes defines, and the element silently never animates. The two
  // BrandMark rows moved here from AdminLoginPage.test.jsx with the CSS.
  it.each([
    ['BrandMark.module.css',     '.wrap',    'kf-floatY from global'],
    ['BrandMark.module.css',     '.ring',    'kf-ringPulse from global'],
    ['LoadingScreen.module.css', '.content', 'kf-fadeIn from global'],
  ])('%s %s composes %s', (file, selector, carrier) => {
    const d = rulesOf(file)(selector);
    expect(d.composes).toBe(carrier);
    expect(d['animation-name']).toBeUndefined();
    // Longhands only: the shorthand resets animation-name to `none`.
    expect(d.animation).toBeUndefined();
  });

  it('the full-screen variant holds the viewport, like the blank div it replaced', () => {
    expect(rulesOf('LoadingScreen.module.css')('.screen')['min-height']).toBe('100vh');
  });
});
