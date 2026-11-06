// frontend/src/components/ambient/__tests__/SeasonalEffects.test.jsx
//
// PF-151 — the decision to show the effect. The canvas module is replaced by a
// marker whose factory counts loads, so "a visitor outside a season downloads
// none of it" is measured, not read from the source.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAbout:         vi.fn(),
  useReducedMotion: vi.fn(),
  useSplashReady:   vi.fn(),
  loads:            { count: 0, fail: false },
}));
vi.mock('../../../hooks/useAbout', () => ({ useAbout: mocks.useAbout }));
vi.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: mocks.useReducedMotion }));
vi.mock('../../../hooks/useSplashReady', () => ({ useSplashReady: mocks.useSplashReady }));
vi.mock('../SeasonalCanvas', () => {
  mocks.loads.count += 1;
  return { default: ({ effect, strip }) => <div data-testid="fall" data-strip={String(strip)}>{effect}</div> };
});

const { default: SeasonalEffects } = await import('../SeasonalEffects');

const SAVED = (seasonalEffect) => ({ data: { seasonalEffect }, isPending: false });
const setDate = (y, m, d) => vi.setSystemTime(new Date(y, m - 1, d, 12));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  setDate(2026, 12, 25);
  mocks.useAbout.mockReturnValue(SAVED('auto'));
  mocks.useReducedMotion.mockReturnValue(false);
  mocks.useSplashReady.mockReturnValue(true);
});
afterEach(() => vi.useRealTimers());

describe('SeasonalEffects', () => {
  // Runs FIRST, before anything in this file has rendered an active effect:
  // the module factory runs once, so a later test could not measure it.
  it('loads no drawing code when nothing is showing', async () => {
    setDate(2027, 6, 6);
    render(<SeasonalEffects />);
    await vi.dynamicImportSettled();
    expect(mocks.loads.count).toBe(0);
    expect(screen.queryByTestId('fall')).toBeNull();
  });

  it('shows snow by itself in December', async () => {
    render(<SeasonalEffects />);
    expect((await screen.findByTestId('fall')).textContent).toBe('snow');
    expect(mocks.loads.count).toBe(1);
  });

  it('fills the page by default; the panel asks for the strip', async () => {
    const first = render(<SeasonalEffects />);
    expect((await screen.findByTestId('fall')).dataset.strip).toBe('false');
    first.unmount();

    render(<SeasonalEffects strip />);
    expect((await screen.findByTestId('fall')).dataset.strip).toBe('true');
  });

  it('shows Halloween by itself on 31 October', async () => {
    setDate(2026, 10, 31);
    render(<SeasonalEffects />);
    expect((await screen.findByTestId('fall')).textContent).toBe('halloween');
  });

  it('follows the switch on an ordinary day', async () => {
    setDate(2027, 6, 6);
    mocks.useAbout.mockReturnValue(SAVED('snow'));
    render(<SeasonalEffects />);
    expect((await screen.findByTestId('fall')).textContent).toBe('snow');
  });

  it('OFF stops it in December', async () => {
    mocks.useAbout.mockReturnValue(SAVED('off'));
    render(<SeasonalEffects />);
    await vi.dynamicImportSettled();
    expect(screen.queryByTestId('fall')).toBeNull();
  });

  it('shows nothing while About loads, so OFF never flashes snow', async () => {
    mocks.useAbout.mockReturnValue({ data: undefined, isPending: true });
    render(<SeasonalEffects />);
    await vi.dynamicImportSettled();
    expect(screen.queryByTestId('fall')).toBeNull();
  });

  it('a FAILED load still follows the dates', async () => {
    mocks.useAbout.mockReturnValue({ data: undefined, isPending: false, isError: true });
    render(<SeasonalEffects />);
    expect((await screen.findByTestId('fall')).textContent).toBe('snow');
  });

  it('shows nothing under reduced motion', async () => {
    mocks.useReducedMotion.mockReturnValue(true);
    render(<SeasonalEffects />);
    await vi.dynamicImportSettled();
    expect(screen.queryByTestId('fall')).toBeNull();
  });

  it('waits for the splash, then starts', async () => {
    mocks.useSplashReady.mockReturnValue(false);
    const { rerender } = render(<SeasonalEffects />);
    await vi.dynamicImportSettled();
    expect(screen.queryByTestId('fall')).toBeNull();

    mocks.useSplashReady.mockReturnValue(true);
    rerender(<SeasonalEffects />);
    expect(await screen.findByTestId('fall')).toBeTruthy();
  });
});
