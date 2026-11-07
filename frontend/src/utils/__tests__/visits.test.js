// PF-145 — what the browser sends to the visitor counter, and what it never does.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countVisit, linkKind, outsideReferrer, resetEngagement, sendVisit, shouldCount, startReadClock } from '../visits';
import { apiUrl } from '../../services/api';
import { session } from '../../services/session';

const anchor = (href, attrs = {}) => {
  const a = document.createElement('a');
  a.href = href;
  Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v));
  return a;
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shouldCount', () => {
  it('counts an ordinary visitor on a public page', () => {
    expect(shouldCount('/')).toBe(true);
    expect(shouldCount('/blog/a-post')).toBe(true);
    expect(shouldCount('/administrator')).toBe(true); // a 404, not the admin area
  });

  it.each(['/admin', '/admin/login', '/admin/messages'])('never counts %s', (path) => {
    expect(shouldCount(path)).toBe(false);
  });

  it('stops counting a browser once it has signed in, and stays stopped after sign-out', () => {
    session.set({ accessToken: 'a' });
    expect(shouldCount('/')).toBe(false);
    session.clear();
    expect(shouldCount('/')).toBe(false);
  });

  it.each([
    ['Global Privacy Control', { globalPrivacyControl: true }],
    ['do not track',           { doNotTrack: '1' }],
    ['an automated browser',   { webdriver: true }],
  ])('leaves out %s', (_name, props) => {
    vi.stubGlobal('navigator', { ...navigator, ...props });
    expect(shouldCount('/')).toBe(false);
  });

  it('do not track set to "0" is not a request to be left out', () => {
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '0' });
    expect(shouldCount('/')).toBe(true);
  });
});

describe('outsideReferrer', () => {
  it('passes an outside site on, and drops this site or none', () => {
    expect(outsideReferrer('https://www.linkedin.com/feed')).toBe('https://www.linkedin.com/feed');
    expect(outsideReferrer(`${window.location.origin}/blog`)).toBeUndefined();
    expect(outsideReferrer('')).toBeUndefined();
    expect(outsideReferrer('not a url')).toBeUndefined();
  });
});

describe('linkKind', () => {
  it.each([
    ['mailto:pcgallege@gmail.com', 'email'],
    ['https://github.com/Chami-02', 'github'],
    ['https://gist.github.com/x', 'github'],
    [apiUrl('/resume'), 'cv'],
    ['https://www.linkedin.com/in/x', null],
    ['https://notgithub.com/x', null],
    ['/blog', null],
  ])('%s → %s', (href, kind) => {
    expect(linkKind(anchor(href))).toBe(kind);
  });

  it('a marked live-site link is live, even when it is hosted on GitHub', () => {
    expect(linkKind(anchor('https://github.com/x', { 'data-visit-link': 'live' }))).toBe('live');
  });
});

describe('sendVisit', () => {
  it('posts JSON with no credentials, and outlives the page', () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    sendVisit({ type: 'view', path: '/' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(apiUrl('/visits'));
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    expect(JSON.parse(init.body)).toEqual({ type: 'view', path: '/' });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('a failed count is swallowed', async () => {
    const rejected = Promise.reject(new Error('offline'));
    vi.stubGlobal('fetch', vi.fn(() => rejected));
    expect(() => sendVisit({ type: 'view', path: '/' })).not.toThrow();
    await rejected.catch(() => {});
  });
});

// PF-153 — the clock behind a read, and through it the engaged visit.
describe('startReadClock', () => {
  const sent = () => globalThis.fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
  const setHidden = (hidden) => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible');
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve()));
    sessionStorage.clear();
    resetEngagement();
  });
  afterEach(() => vi.useRealTimers());

  it('counts only the time the tab is showing', () => {
    startReadClock('a-post');
    vi.advanceTimersByTime(4_000);
    setHidden(true);
    vi.advanceTimersByTime(60_000);
    expect(sent()).toEqual([]);
    setHidden(false);
    vi.advanceTimersByTime(1_999);
    expect(sent()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent()).toEqual([{ type: 'read', slug: 'a-post' }]);
  });

  it('a tab opened behind others counts nothing until it is shown', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    startReadClock('a-post');
    vi.advanceTimersByTime(60_000);
    expect(sent()).toEqual([]);
  });

  it('confirms the visit, sending what was held back', () => {
    countVisit({ type: 'view', path: '/blog/a-post' });
    expect(sent()).toEqual([]);
    startReadClock('a-post');
    vi.advanceTimersByTime(6_000);
    expect(sent()).toEqual([
      { type: 'read', slug: 'a-post' },
      { type: 'view', path: '/blog/a-post' },
    ]);
  });

  it('a post already read this session still confirms the visit (owner: every reader is a visit)', () => {
    sessionStorage.setItem('pg-viewed-a-post', '1');
    countVisit({ type: 'view', path: '/blog/a-post' });
    startReadClock('a-post');
    vi.advanceTimersByTime(6_000);
    expect(sent()).toEqual([{ type: 'view', path: '/blog/a-post' }]);
  });

  it('coming back to the tab afterwards sends nothing more', () => {
    startReadClock('a-post');
    vi.advanceTimersByTime(6_000);
    setHidden(true);
    setHidden(false);
    vi.advanceTimersByTime(60_000);
    expect(sent()).toHaveLength(1);
  });

  it('signing in during the 6 seconds makes this the owner', () => {
    startReadClock('a-post');
    localStorage.setItem('pg-owner-device', '1');
    vi.advanceTimersByTime(6_000);
    expect(sent()).toEqual([]);
    expect(sessionStorage.getItem('pg-viewed-a-post')).toBeNull();
  });

  it('stopped, it sends nothing', () => {
    const stop = startReadClock('a-post');
    vi.advanceTimersByTime(5_000);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(sent()).toEqual([]);
  });
});
