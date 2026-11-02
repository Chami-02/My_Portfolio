// The hero's typing line (owner, 2026-11-02) — types each role, holds it,
// deletes it, moves on; still under reduced motion; waits for the splash.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionContext } from '../../../providers/MotionContext';
import { SplashContext } from '../../../providers/SplashContext';
import { TypingRoles, TYPE_MS, HOLD_MS, DELETE_MS, START_MS } from '../TypingRoles';

// The owner's roles, in order (2026-11-02).
const ROLES = [
  'Full-Stack Web Developer',
  'Cloud & DevOps Enthusiast',
  'Continuous Learner',
  'Tech Explorer',
  'Problem Solver',
];

const renderLine = ({ reduced = false, ready = true } = {}) => render(
  <MotionContext.Provider value={{ reduced }}>
    <SplashContext.Provider value={{ ready }}>
      <TypingRoles />
    </SplashContext.Provider>
  </MotionContext.Provider>,
);

/** What a sighted visitor sees (the aria-hidden half). */
const shown = (container) => container.querySelector('[aria-hidden="true"]').textContent;
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('TypingRoles', () => {
  it('types the first role letter by letter, then holds it', () => {
    const { container } = renderLine();
    expect(shown(container)).toBe('');
    tick(START_MS);
    expect(shown(container)).toBe('F');
    tick(TYPE_MS * 3);
    expect(shown(container)).toBe('Full');
    tick(TYPE_MS * (ROLES[0].length - 4));
    expect(shown(container)).toBe(ROLES[0]);
    tick(HOLD_MS - 1);
    expect(shown(container)).toBe(ROLES[0]);          // still holding
  });

  it('deletes the role, then types the next — and loops back to the first', () => {
    const { container } = renderLine();
    tick(START_MS + TYPE_MS * (ROLES[0].length - 1) + HOLD_MS);
    expect(shown(container)).toBe(ROLES[0].slice(0, -1));   // deleting
    tick(DELETE_MS * ROLES[0].length);
    expect(shown(container)).toBe(ROLES[1][0]);              // next role starts

    // Run every role through once more and land back on the first.
    const cycle = (w) => TYPE_MS * (w.length - 1) + HOLD_MS + DELETE_MS * w.length;
    tick(ROLES.slice(1).reduce((ms, w) => ms + cycle(w), 0));
    expect(shown(container)).toBe(ROLES[0][0]);
  });

  it('a screen reader hears every role once, as text', () => {
    renderLine();
    expect(screen.getByText(ROLES.join(', '))).toBeInTheDocument();
  });

  it('waits for the splash — nothing types while it is up', () => {
    const { container } = renderLine({ ready: false });
    tick(START_MS * 10);
    expect(shown(container)).toBe('');
  });

  it('under reduced motion the first role stands still, with no caret', () => {
    const { container } = renderLine({ reduced: true });
    expect(shown(container)).toBe(ROLES[0]);
    tick(START_MS + HOLD_MS * 4);
    expect(shown(container)).toBe(ROLES[0]);
    expect(container.querySelector('[class*="typingCaret"]')).toBeNull();
  });

  it('stops its timer when it leaves the page', () => {
    const { unmount } = renderLine();
    tick(START_MS);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
