// PF-145 — what the browser sends to the visitor counter, and what it never does.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linkKind, outsideReferrer, sendVisit, shouldCount } from '../visits';
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
    session.set({ accessToken: 'a', refreshToken: 'r' });
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
