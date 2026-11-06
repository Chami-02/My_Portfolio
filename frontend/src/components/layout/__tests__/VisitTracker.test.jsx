// PF-145 — through a real router, so a navigation is a real navigation.
import { StrictMode } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter } from 'react-router-dom';
import { VisitTracker } from '../VisitTracker';
import { ENGAGED_AFTER_MS, resetEngagement } from '../../../utils/visits';
import { session } from '../../../services/session';

let fetchMock;
const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
const settle = () => act(async () => { vi.runAllTimers(); });

const renderAt = (path, extra = null) => render(
  <StrictMode>
    <MemoryRouter initialEntries={[path]}>
      <VisitTracker />
      <Link to="/blog">to blog</Link>
      <Link to="/">to home</Link>
      <a href="mailto:a@b.co" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>mail me</a>
      <a href="https://example.com" onClick={(e) => e.preventDefault()}>elsewhere</a>
      {extra}
    </MemoryRouter>
  </StrictMode>,
);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetEngagement();
  fetchMock = vi.fn().mockResolvedValue({ status: 204 });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('requestIdleCallback', undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VisitTracker — only an engaged visit counts (the Google Analytics rule)', () => {
  const after = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
  const visibility = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  };

  afterEach(() => { delete document.visibilityState; });

  it('sends nothing before 10 seconds, then the view', async () => {
    renderAt('/');
    await after(ENGAGED_AFTER_MS - 1);
    expect(sent()).toEqual([]);
    await after(1);
    expect(sent()).toEqual([{ type: 'view', path: '/' }]);
  });

  it('someone gone sooner counts nothing', async () => {
    const { unmount } = renderAt('/');
    await after(ENGAGED_AFTER_MS - 1);
    unmount();
    await after(ENGAGED_AFTER_MS * 2);
    expect(sent()).toEqual([]);
  });

  it('a second page counts both pages at once, in order', async () => {
    renderAt('/');
    await after(500);
    fireEvent.click(screen.getByText('to blog'));
    await after(500);
    expect(sent().map((b) => b.path)).toEqual(['/', '/blog']);
  });

  it('a counted link counts the view, then the click', async () => {
    renderAt('/');
    await after(500);
    fireEvent.click(screen.getByText('mail me'));
    expect(sent()).toEqual([{ type: 'view', path: '/' }, { type: 'click', link: 'email' }]);
  });

  it('a link that is not counted proves nothing', async () => {
    renderAt('/');
    await after(500);
    fireEvent.click(screen.getByText('elsewhere'));
    expect(sent()).toEqual([]);
  });

  it('counts only time the tab is showing, and adds it up', async () => {
    renderAt('/');
    await after(6000);
    visibility('hidden');
    await after(60_000);
    expect(sent()).toEqual([]);
    visibility('visible');
    await after(3999);
    expect(sent()).toEqual([]);
    await after(1);
    expect(sent()).toHaveLength(1);
  });

  it('a tab opened behind others does not start the clock', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    renderAt('/');
    await after(60_000);
    expect(sent()).toEqual([]);
  });

  it('after that, each page goes at once', async () => {
    renderAt('/');
    await after(ENGAGED_AFTER_MS);
    fireEvent.click(screen.getByText('to blog'));
    await after(200);
    expect(sent().map((b) => b.path)).toEqual(['/', '/blog']);
  });

  it('keeps the outside referrer on the first view when it is finally sent', async () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://www.linkedin.com/feed');
    renderAt('/');
    await after(ENGAGED_AFTER_MS);
    expect(sent()[0].referrer).toBe('https://www.linkedin.com/feed');
  });

  it('signing in during those 10 seconds drops what was held', async () => {
    renderAt('/');
    await after(500);
    vi.spyOn(session, 'isOwnerDevice').mockReturnValue(true);
    await after(ENGAGED_AFTER_MS);
    expect(sent()).toEqual([]);
  });
});

describe('VisitTracker', () => {
  it('sends nothing until the page has settled, then one count despite StrictMode', async () => {
    renderAt('/');
    expect(fetchMock).not.toHaveBeenCalled();
    await settle();
    expect(sent()).toEqual([{ type: 'view', path: '/' }]);
  });

  it('uses the browser idle callback where there is one', async () => {
    const idle = vi.fn((fn) => fn());
    vi.stubGlobal('requestIdleCallback', idle);
    renderAt('/');
    expect(idle).toHaveBeenCalledTimes(1);
    await settle();
    expect(sent()).toEqual([{ type: 'view', path: '/' }]);
  });

  it('counts each page opened, and coming back counts again', async () => {
    renderAt('/');
    await settle();
    fireEvent.click(screen.getByText('to blog'));
    await settle();
    fireEvent.click(screen.getByText('to home'));
    await settle();
    expect(sent().map((b) => b.path)).toEqual(['/', '/blog', '/']);
  });

  it('sends the outside referrer on the first view only', async () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://www.linkedin.com/feed');
    renderAt('/');
    await settle();
    fireEvent.click(screen.getByText('to blog'));
    await settle();
    expect(sent()[0].referrer).toBe('https://www.linkedin.com/feed');
    expect(sent()[1].referrer).toBeUndefined();
  });

  it('sends nothing on an admin page', async () => {
    renderAt('/admin/messages');
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing, views or clicks, from the owner\'s browser', async () => {
    session.set({ accessToken: 'a' });
    session.clear();
    renderAt('/');
    await settle();
    fireEvent.click(screen.getByText('mail me'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts a counted link even when its own handler stops the event', async () => {
    renderAt('/');
    await settle();
    fetchMock.mockClear();
    fireEvent.click(screen.getByText('mail me'));
    expect(sent()).toEqual([{ type: 'click', link: 'email' }]);
  });

  it('counts a click on something inside the link', async () => {
    renderAt('/', <a href="https://github.com/x" onClick={(e) => e.preventDefault()}><span>inner</span></a>);
    await settle();
    fetchMock.mockClear();
    fireEvent.click(screen.getByText('inner'));
    expect(sent()).toEqual([{ type: 'click', link: 'github' }]);
  });

  it('ignores an uncounted link and a click outside any link', async () => {
    renderAt('/', <p>plain text</p>);
    await settle();
    fetchMock.mockClear();
    fireEvent.click(screen.getByText('elsewhere'));
    fireEvent.click(screen.getByText('plain text'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops listening when it unmounts', async () => {
    const { unmount } = renderAt('/');
    await settle();
    unmount();
    fetchMock.mockClear();
    const a = document.createElement('a');
    a.href = 'mailto:a@b.co';
    a.addEventListener('click', (e) => e.preventDefault());
    document.body.append(a);
    fireEvent.click(a);
    a.remove();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
