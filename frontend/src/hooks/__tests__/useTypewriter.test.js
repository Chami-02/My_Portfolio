import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act }                             from '@testing-library/react';
import { useTypewriter }                               from '../../hooks/useTypewriter';

describe('useTypewriter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with an empty string', () => {
    const { result } = renderHook(() => useTypewriter());
    expect(result.current).toBe('');
  });

  it('builds up text over time', async () => {
    const { result } = renderHook(() => useTypewriter());

    // Advance time to let the typewriter build some characters
    await act(async () => {
      vi.advanceTimersByTime(300); // ~3 characters at 90ms each
    });

    expect(result.current.length).toBeGreaterThan(0);
  });

  it('returns a string type at all times', async () => {
    const { result } = renderHook(() => useTypewriter());

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(typeof result.current).toBe('string');
  });

  it('covers pause and deletion transitions', async () => {
    const { result } = renderHook(() => useTypewriter());

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBe('F');
  });
});
