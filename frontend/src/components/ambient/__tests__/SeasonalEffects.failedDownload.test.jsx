// frontend/src/components/ambient/__tests__/SeasonalEffects.failedDownload.test.jsx
//
// PF-151 — its own file: `vi.mock` is per file, and here the chunk must FAIL.
import { Component } from 'react';
import { render, screen, act } from '@testing-library/react';
import { it, expect, vi } from 'vitest';

vi.mock('../../../hooks/useAbout', () => ({
  useAbout: () => ({ data: { seasonalEffect: 'snow' }, isPending: false }),
}));
vi.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../hooks/useSplashReady', () => ({ useSplashReady: () => true }));
vi.mock('../SeasonalCanvas', () => {
  throw new Error('chunk failed to download');
});

const { default: SeasonalEffects } = await import('../SeasonalEffects');

/** Stands in for the page's own boundary: anything reaching it broke the page. */
class PageBoundary extends Component {
  state = { broke: false };

  static getDerivedStateFromError() {
    return { broke: true };
  }

  render() {
    return this.state.broke ? <p>PAGE BROKE</p> : this.props.children;
  }
}

it('a failed download paints nothing and leaves the page alone', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(<PageBoundary><p>THE PAGE</p><SeasonalEffects /></PageBoundary>);
  await act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((r) => { setTimeout(r, 0); });
  });

  expect(screen.getByText('THE PAGE')).toBeTruthy();
  expect(screen.queryByText('PAGE BROKE')).toBeNull();
  quiet.mockRestore();
});
