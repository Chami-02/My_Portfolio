// PF-149 — the Analytics panel. Every figure in REPORT is distinct, so a card
// wired to the wrong field fails. A failed load must never paint a zero.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  useAnalytics: vi.fn(), useGrowth: vi.fn(), useLiveAnalytics: vi.fn(), useExportAnalytics: vi.fn(),
}));
vi.mock('../../../../hooks/useAnalytics', () => hooks);

const saveBlob = vi.hoisted(() => vi.fn());
vi.mock('../../../../utils/backupFile', () => ({ saveBlob }));

const { AdminAnalyticsPanel } = await import('../AdminAnalyticsPanel');

const REPORT = {
  to: '2026-11-06',
  countingSince: '2026-11-04',
  comparable: true,
  totals:   { visitors: 128, views: 412, messages: 3, email: 5, cv: 9, github: 11, live: 13 },
  previous: { visitors: 100, views: 412, messages: 0, email: 10, cv: 9, github: 0, live: 0 },
  breakdowns: {
    country:  [{ key: 'LK', count: 100 }, { key: 'GB', count: 28 }],
    city:     [{ key: 'Galle, LK', count: 70 }, { key: 'London, GB', count: 28 }],
    referrer: [{ key: '(direct)', count: 90 }, { key: 'linkedin.com', count: 38 }],
    device:   [{ key: 'phone', count: 80 }, { key: 'desktop', count: 48 }],
    browser:  [{ key: 'Chrome', count: 90 }, { key: 'Safari', count: 38 }],
    hour:     [{ key: '09', count: 40 }],
    section:  [{ key: 'contact', count: 12 }, { key: 'hero', count: 95 }],
  },
  pages: [{ key: '/', count: 300 }, { key: '/blog/a-post', title: 'A post', count: 60 }],
  mostViewed: {
    projects: [{ key: '/projects/clear', title: 'ClearDrive', count: 44 }],
    posts:    [{ key: '/blog/a-post', title: 'A post', count: 60 }],
  },
  messagesByCountry: [{ key: 'Sri Lanka', count: 2 }, { key: '(unknown)', count: 1 }],
  daily:   [{ day: '2026-11-05', messages: 1, clicks: 2 }, { day: '2026-11-06', messages: 2, clicks: 36 }],
  signIns: { ok: 21, failed: 4, byMethod: { password: 15, passkey: 6 } },
};

const GROWTH = {
  days: [
    { day: '2026-11-05', visitors: 7, views: 30 },
    { day: '2026-11-06', visitors: 9, views: 40 },
  ],
};

const LIVE = { onSiteNow: 2, visitorsToday: 31, viewsToday: 94, viewsThisHour: 17, ms: 180 };

const ok = (data, extra = {}) => ({
  data, isPending: false, isError: false, refetch: vi.fn(), isFetching: false, ...extra,
});
const failed = (extra = {}) => ok(undefined, { isError: true, ...extra });
const loading = () => ok(undefined, { isPending: true });

const total = (label) => screen.getByText(label).closest('div');

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useAnalytics.mockReturnValue(ok(REPORT));
  hooks.useGrowth.mockReturnValue(ok(GROWTH));
  hooks.useLiveAnalytics.mockReturnValue(ok(LIVE, { dataUpdatedAt: Date.now() }));
  hooks.useExportAnalytics.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
});

afterEach(() => vi.useRealTimers());

describe('AdminAnalyticsPanel — totals', () => {
  it.each([
    ['VISITORS', '128'], ['PAGE VIEWS', '412'], ['MESSAGES', '3'],
    ['EMAIL CLICKS', '5'], ['CV CLICKS', '9'], ['GITHUB CLICKS', '11'],
  ])('%s shows %s', (label, value) => {
    render(<AdminAnalyticsPanel />);
    expect(within(total(label)).getByText(value)).toBeInTheDocument();
  });

  it('compares each total with the period before', () => {
    render(<AdminAnalyticsPanel />);
    expect(total('VISITORS')).toHaveTextContent('28%');
    expect(total('VISITORS')).toHaveTextContent('Up');
    expect(total('EMAIL CLICKS')).toHaveTextContent('Down');
    expect(total('PAGE VIEWS')).toHaveTextContent('NO CHANGE');
    expect(total('MESSAGES')).toHaveTextContent('NEW');
  });

  it('shows NEW, never a percentage, against a period not fully counted', () => {
    hooks.useAnalytics.mockReturnValue(ok({ ...REPORT, comparable: false }));
    render(<AdminAnalyticsPanel />);
    expect(total('VISITORS')).toHaveTextContent('NEW');
    expect(total('VISITORS')).not.toHaveTextContent('%');
  });

  it('still compares messages then: their dates predate the counter', () => {
    hooks.useAnalytics.mockReturnValue(ok({
      ...REPORT, comparable: false, previous: { ...REPORT.previous, messages: 1 },
    }));
    render(<AdminAnalyticsPanel />);
    expect(total('MESSAGES')).toHaveTextContent('200%');
  });
});

describe('AdminAnalyticsPanel — date range', () => {
  it('starts on 30 days and asks again for the range chosen', async () => {
    render(<AdminAnalyticsPanel />);
    expect(hooks.useAnalytics).toHaveBeenLastCalledWith('30');
    expect(screen.getByRole('button', { name: '30 DAYS' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'THIS YEAR' }));
    expect(hooks.useAnalytics).toHaveBeenLastCalledWith('year');
    expect(screen.getByRole('button', { name: 'THIS YEAR' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AdminAnalyticsPanel — what each section shows', () => {
  it('lists sections by reach, in plain names', () => {
    render(<AdminAnalyticsPanel />);
    const card = screen.getByText('MOST REACHED SECTIONS').closest('section');
    const names = within(card).getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toEqual(['Hero95', 'Contact12']);
  });

  it('shows real titles for projects and posts', () => {
    render(<AdminAnalyticsPanel />);
    const card = screen.getByText('MOST VIEWED PROJECTS AND MOST READ POSTS').closest('section');
    expect(within(card).getByText('ClearDrive')).toBeInTheDocument();
    expect(within(card).getByText('A post')).toBeInTheDocument();
  });

  it('splits Sri Lanka from the rest of the world', () => {
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText('Sri Lanka 100 · rest of the world 28')).toBeInTheDocument();
  });

  it('switches cities to Sri Lanka only', async () => {
    render(<AdminAnalyticsPanel />);
    const card = screen.getByText('CITIES').closest('section');
    expect(within(card).getByText('London, GB')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'SRI LANKA' }));
    expect(within(card).queryByText('London, GB')).not.toBeInTheDocument();
    expect(within(card).getByText('Galle')).toBeInTheDocument();
  });

  it('reports sign-ins with failures apart', () => {
    render(<AdminAnalyticsPanel />);
    const card = screen.getByText('SIGN-INS').closest('section');
    expect(within(card).getByText('21')).toBeInTheDocument();
    expect(within(card).getByText('4')).toBeInTheDocument();
    const methods = within(card).getAllByRole('listitem').map((li) => li.textContent);
    expect(methods).toEqual(['Password15', 'Google0', 'Passkey6']);
    expect(card).toHaveTextContent('90 days');
  });

  it('gives screen readers the chart numbers as tables', () => {
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('table', { name: 'Visitors by country' })).toHaveTextContent('Sri Lanka');
    expect(screen.getByRole('table', { name: 'Visitors by device' })).toHaveTextContent('Phone');
    expect(screen.getByRole('table', { name: 'Page views by hour' })).toHaveTextContent('9 AM');
  });

  it('names the busiest hour, and only that one', () => {
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText('HIGHEST: 9 AM · 40')).toBeInTheDocument();
  });

  it('tells the owner what the numbers can and cannot know', () => {
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText('HOW ACCURATE ARE THESE NUMBERS?')).toBeInTheDocument();
    expect(screen.getByText(/counts as 3/)).toBeInTheDocument();
  });
});

describe('AdminAnalyticsPanel — growth', () => {
  it('draws the chart for the chosen grouping', async () => {
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('table', { name: 'Visitors and page views by day' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'MONTH' }));
    const table = screen.getByRole('table', { name: 'Visitors and page views by month' });
    expect(table).toHaveTextContent('NOV 2026 so far');
    expect(table).toHaveTextContent('16'); // 7 + 9
    expect(table).toHaveTextContent('70'); // 30 + 40
  });

  it('says so when no visitor has been counted', () => {
    hooks.useGrowth.mockReturnValue(ok({ days: [{ day: '2026-11-06', visitors: 0, views: 0 }] }));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText('No visitors counted yet.')).toBeInTheDocument();
  });
});

describe('AdminAnalyticsPanel — live', () => {
  it.each([
    ['ON THE SITE NOW', '2'], ['VISITORS TODAY', '31'], ['VIEWS TODAY', '94'], ['VIEWS THIS HOUR', '17'],
  ])('%s shows %s', (label, value) => {
    render(<AdminAnalyticsPanel />);
    expect(within(total(label)).getByText(value)).toBeInTheDocument();
  });

  it('says the site and database answered, and how fast', () => {
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText(/SITE AND DATABASE · 180 MS/)).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^LIVE/ })).toBeInTheDocument();
  });

  it('turns to PAUSED when a refresh fails, keeping the age of the old numbers', () => {
    hooks.useLiveAnalytics.mockReturnValue(ok(LIVE, { isError: true, dataUpdatedAt: Date.now() - 120_000 }));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('heading', { name: /PAUSED · LAST UPDATED 2 MINUTES AGO/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^LIVE/ })).not.toBeInTheDocument();
    expect(screen.getByText(/NOT ANSWERING/)).toBeInTheDocument();
  });

  it('says why it paused, in plain words', () => {
    const error = { response: { status: 429, data: {} } };
    hooks.useLiveAnalytics.mockReturnValue(ok(LIVE, { isError: true, error, dataUpdatedAt: Date.now() }));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('never claims the site is fine before the first answer failed', () => {
    hooks.useLiveAnalytics.mockReturnValue(failed({ dataUpdatedAt: 0 }));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('heading', { name: /PAUSED · COULD NOT CHECK YET/ })).toBeInTheDocument();
    expect(screen.queryByText('ON THE SITE NOW')).not.toBeInTheDocument();
  });

  it('keeps counting the seconds since the last answer', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    hooks.useLiveAnalytics.mockReturnValue(ok(LIVE, { dataUpdatedAt: 1_000_000 }));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('heading', { name: /UPDATED 0 SECONDS AGO/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('heading', { name: /UPDATED 5 SECONDS AGO/ })).toBeInTheDocument();
  });
});

describe('AdminAnalyticsPanel — what the date buttons control', () => {
  it('sit under their own heading, after Live and Growth', () => {
    render(<AdminAnalyticsPanel />);
    const heading = screen.getByText('TOTALS AND BREAKDOWNS');
    const growth = screen.getByText('AUDIENCE GROWTH');
    const button = screen.getByRole('button', { name: '30 DAYS' });
    expect(growth.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.parentElement).toContainElement(button);
  });

  it('every list that can grow is a scroll box a keyboard can reach', () => {
    render(<AdminAnalyticsPanel />);
    ['Most reached sections', 'Most viewed projects and most read posts', 'Every country', 'Cities', 'Pages', 'Messages by country']
      .forEach((name) => {
        expect(screen.getByRole('group', { name })).toHaveAttribute('tabindex', '0');
      });
  });
});

describe('AdminAnalyticsPanel — waiting and failing', () => {
  it('a failed report shows LoadError, and no zeros', () => {
    hooks.useAnalytics.mockReturnValue(failed({ error: new Error('Network Error') }));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText(/COULDN’T LOAD YOUR ANALYTICS/)).toHaveTextContent('check your internet connection');
    expect(screen.queryByText('VISITORS')).not.toBeInTheDocument();
    expect(screen.queryByText('No visitors in this period yet.')).not.toBeInTheDocument();
  });

  it('a failed growth chart leaves the report standing', () => {
    hooks.useGrowth.mockReturnValue(failed());
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText(/COULDN’T LOAD AUDIENCE GROWTH/)).toBeInTheDocument();
    expect(screen.getByText('VISITORS')).toBeInTheDocument();
  });

  it('paints no count while loading', () => {
    hooks.useAnalytics.mockReturnValue(loading());
    hooks.useGrowth.mockReturnValue(loading());
    hooks.useLiveAnalytics.mockReturnValue(loading());
    render(<AdminAnalyticsPanel />);
    expect(screen.queryByText('VISITORS')).not.toBeInTheDocument();
    expect(screen.queryByText('ON THE SITE NOW')).not.toBeInTheDocument();
  });

  it('an empty period says so in plain words', () => {
    const none = {
      ...REPORT,
      totals: { visitors: 0, views: 0, messages: 0, email: 0, cv: 0, github: 0, live: 0 },
      breakdowns: { country: [], city: [], referrer: [], device: [], browser: [], hour: [], section: [] },
      pages: [], mostViewed: { projects: [], posts: [] }, messagesByCountry: [], daily: [],
      signIns: { ok: 0, failed: 0, byMethod: {} },
    };
    hooks.useAnalytics.mockReturnValue(ok(none));
    render(<AdminAnalyticsPanel />);
    expect(screen.getByText('No visitors in this period yet.')).toBeInTheDocument();
    expect(screen.getByText('No sections counted in this period.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Visitors by country' })).not.toBeInTheDocument();
  });
});

describe('AdminAnalyticsPanel — download', () => {
  it('saves the file the server sent', async () => {
    const blob = new Blob(['day,dim,key,count']);
    const mutate = vi.fn((_v, { onSuccess }) => onSuccess(blob));
    hooks.useExportAnalytics.mockReturnValue({ mutate, isPending: false, isError: false });
    render(<AdminAnalyticsPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'DOWNLOAD CSV' }));
    expect(saveBlob).toHaveBeenCalledWith(blob, 'site-numbers-2026-11-06.csv');
  });

  it('says so in plain words when it fails', () => {
    hooks.useExportAnalytics.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: true, error: new Error('x') });
    render(<AdminAnalyticsPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
  });
});
