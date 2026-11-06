// PF-149 — the panel's calculations, against numbers worked out by hand.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  agoText, barPercent, changeFrom, chartPoints, countryLabel, pieSlices, shareOfTop, fullDayOfHours, groupGrowth, growthChange, hourLabel,
  localCities, niceMax, sortRows, topWithOther, totalOf, weekStart, withShares,
} from '../audienceStats';

/** One row per day, visitors = 1..n and views = 10 × that, so a wrong sum shows. */
const daysBetween = (from, to) => {
  const rows = [];
  let n = 1;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    rows.push({ day: d.toISOString().slice(0, 10), visitors: n, views: n * 10 });
    n += 1;
  }
  return rows;
};

describe('weekStart', () => {
  it.each([
    ['2026-11-02', '2026-11-02'], // a Monday stays
    ['2026-11-08', '2026-11-02'], // a Sunday belongs to the week before it
    ['2026-01-01', '2025-12-29'], // a week crossing a new year
    ['2024-03-01', '2024-02-26'], // back across a leap day
  ])('%s starts on %s', (day, monday) => {
    expect(weekStart(day)).toBe(monday);
  });
});

describe('groupGrowth', () => {
  it('sums into weeks, Monday to Sunday', () => {
    const rows = groupGrowth(daysBetween('2026-11-04', '2026-11-10'), 'week');
    expect(rows.map((r) => [r.key, r.visitors, r.views])).toEqual([
      ['2026-11-02', 1 + 2 + 3 + 4 + 5, 150], // Wed 4 → Sun 8
      ['2026-11-09', 6 + 7, 130],             // Mon 9 → Tue 10
    ]);
  });

  it('keeps a week crossing a new year as one row', () => {
    const rows = groupGrowth(daysBetween('2026-12-28', '2027-01-03'), 'week');
    expect(rows).toHaveLength(1);
    expect(rows[0].visitors).toBe(28);
  });

  it('sums into months, a leap February included', () => {
    const rows = groupGrowth(daysBetween('2028-02-01', '2028-03-01'), 'month');
    expect(rows.map((r) => [r.label, r.visitors])).toEqual([
      ['FEB 2028', (29 * 30) / 2],
      ['MAR 2028', 30],
    ]);
  });

  it('sums into years', () => {
    const rows = groupGrowth(daysBetween('2026-12-31', '2027-01-02'), 'year');
    expect(rows.map((r) => [r.key, r.visitors])).toEqual([['2026', 1], ['2027', 5]]);
  });

  it('never loses a count, in any grouping', () => {
    const days = daysBetween('2026-11-04', '2027-03-15');
    const sum = totalOf(days.map((d) => ({ count: d.visitors })));
    ['day', 'week', 'month', 'year'].forEach((unit) => {
      expect(totalOf(groupGrowth(days, unit).map((r) => ({ count: r.visitors })))).toBe(sum);
    });
  });

  it('marks only the newest as running', () => {
    const rows = groupGrowth(daysBetween('2026-11-04', '2026-12-02'), 'month');
    expect(rows.map((r) => r.partial)).toEqual([false, true]);
  });

  it('marks the oldest when counting began part-way through it', () => {
    expect(groupGrowth(daysBetween('2026-11-04', '2026-12-02'), 'month')[0].startsLate).toBe(true);
    expect(groupGrowth(daysBetween('2026-11-01', '2026-12-02'), 'month')[0].startsLate).toBe(false);
    expect(groupGrowth(daysBetween('2026-11-02', '2026-11-20'), 'week')[0].startsLate).toBe(false);
    expect(groupGrowth(daysBetween('2026-11-04', '2026-11-20'), 'day')[0].startsLate).toBe(false);
  });
});

describe('changeFrom', () => {
  it.each([
    [110, 100, { kind: 'up', percent: 10 }],
    [90,  100, { kind: 'down', percent: 10 }],
    [1,   3,   { kind: 'down', percent: 67 }],
    [5,   5,   { kind: 'same' }],
    [5,   0,   { kind: 'new' }],
    [0,   0,   { kind: 'none' }],
    [0,   5,   { kind: 'down', percent: 100 }],
  ])('%i against %i', (now, before, expected) => {
    expect(changeFrom(now, before)).toEqual(expected);
  });

  it('never invents a percentage against a period that was not fully counted', () => {
    expect(changeFrom(50, 3, false)).toEqual({ kind: 'new' });
    expect(changeFrom(0, 3, false)).toEqual({ kind: 'none' });
  });
});

describe('growthChange', () => {
  const bucket = (label, visitors, extra = {}) => ({ label, visitors, views: visitors * 2, partial: false, startsLate: false, ...extra });

  it('compares the newest finished bucket, never the running one', () => {
    const result = growthChange([bucket('A', 10), bucket('B', 20), bucket('C', 1, { partial: true })]);
    expect(result.label).toBe('B');
    expect(result.against).toBe('A');
    expect(result.visitors).toEqual({ kind: 'up', percent: 100 });
  });

  it('says nothing against a bucket counting began part-way through', () => {
    expect(growthChange([bucket('A', 1, { startsLate: true }), bucket('B', 20), bucket('C', 1, { partial: true })])).toBeNull();
  });

  it('says nothing until two finished buckets exist', () => {
    expect(growthChange([bucket('A', 1), bucket('B', 1, { partial: true })])).toBeNull();
  });
});

describe('topWithOther', () => {
  const rows = ['a', 'b', 'c', 'd'].map((key, i) => ({ key, count: 10 - i }));

  it('folds the rest into one row and keeps the sum', () => {
    const result = topWithOther(rows, 2);
    expect(result.map((r) => r.key)).toEqual(['a', 'b', '(other)']);
    expect(result[2].count).toBe(8 + 7);
    expect(totalOf(result)).toBe(totalOf(rows));
  });

  it('adds no Other when everything fits', () => {
    expect(topWithOther(rows, 4)).toHaveLength(4);
  });
});

describe('sortRows', () => {
  it('breaks a tie by name, so the order is stable', () => {
    expect(sortRows([{ key: 'b', count: 1 }, { key: 'a', count: 1 }, { key: 'c', count: 2 }]).map((r) => r.key))
      .toEqual(['c', 'a', 'b']);
  });

  it('leaves the given list alone', () => {
    const rows = Object.freeze([{ key: 'a', count: 1 }, { key: 'b', count: 2 }]);
    expect(() => sortRows(rows)).not.toThrow();
  });
});

describe('withShares', () => {
  it.each([
    [[1, 1, 1], [34, 33, 33]],
    [[1, 2], [33, 67]],
    [[7], [100]],
    [[1, 1, 1, 1, 1, 1, 1], [15, 15, 14, 14, 14, 14, 14]],
  ])('%j always adds up to 100', (counts, percents) => {
    const result = withShares(counts.map((count, i) => ({ key: String(i), count })));
    expect(result.map((r) => r.percent)).toEqual(percents);
    expect(result.reduce((sum, r) => sum + r.percent, 0)).toBe(100);
  });

  it('survives nothing to share', () => {
    expect(withShares([{ key: 'a', count: 0 }])[0].percent).toBe(0);
  });
});

describe('the words', () => {
  it('fills all 24 hours', () => {
    const hours = fullDayOfHours([{ key: '09', count: 4 }]);
    expect(hours).toHaveLength(24);
    expect(hours[9]).toEqual({ key: '09', count: 4 });
    expect(hours[0].count).toBe(0);
  });

  it.each([['00', '12 AM'], ['09', '9 AM'], ['12', '12 PM'], ['23', '11 PM']])('hour %s is %s', (key, label) => {
    expect(hourLabel(key)).toBe(label);
  });

  it('names countries and the counter\'s own keys', () => {
    expect(countryLabel('LK')).toBe('Sri Lanka');
    expect(countryLabel('(unknown)')).toBe('Unknown');
  });

  it('keeps only Sri Lankan cities, without the code', () => {
    expect(localCities([{ key: 'Galle, LK', count: 2 }, { key: 'Galle, GB', count: 1 }, { key: '(unknown)', count: 9 }]))
      .toEqual([{ key: 'Galle', count: 2 }]);
  });

  it.each([[0, 1], [1, 1], [2, 2], [7, 8], [10, 10], [11, 15], [123, 150], [501, 600], [2412, 2500], [801, 1000]])('niceMax(%i) is %i', (value, top) => {
    expect(niceMax(value)).toBe(top);
  });

  it.each([
    [1000, '1 second ago'], [12_000, '12 seconds ago'], [60_000, '1 minute ago'],
    [120_000, '2 minutes ago'], [7_200_000, '2 hours ago'],
  ])('%i ms is %s', (ms, text) => {
    expect(agoText(ms)).toBe(text);
  });
});

describe('the shapes match the numbers', () => {
  it('places line points exactly, hand-worked on a 1000 × 300 drawing', () => {
    expect(chartPoints([0, 50, 100], 100, 1000, 300)).toEqual([
      { x: 0, y: 300 }, { x: 500, y: 150 }, { x: 1000, y: 0 },
    ]);
  });

  it('centres a single point', () => {
    expect(chartPoints([25], 100, 1000, 300)).toEqual([{ x: 500, y: 225 }]);
  });

  it('a higher number always draws higher', () => {
    const [low, high] = chartPoints([10, 90], 100, 1000, 300);
    expect(high.y).toBeLessThan(low.y);
  });

  it.each([[50, 100, 50], [1, 4, 25], [40, 40, 100], [0, 40, 0]])('%i of %i fills %i%%', (value, top, percent) => {
    expect(shareOfTop(value, top)).toBe(percent);
  });

  it('a bar is true to scale, with a sliver for a tiny real count and nothing for zero', () => {
    expect(barPercent(547, 1094)).toBe(50);
    expect(barPercent(1, 1000)).toBe(1.5);
    expect(barPercent(0, 1000)).toBe(0);
  });

  it('pie slices are true to scale, in order, and close the circle', () => {
    const slices = pieSlices([{ key: 'a', count: 50 }, { key: 'b', count: 30 }, { key: 'c', count: 20 }]);
    expect(slices.map((s) => [s.start, s.size])).toEqual([[0, 50], [50, 30], [80, 20]]);
    const last = slices[slices.length - 1];
    expect(last.start + last.size).toBe(100);
  });
});

describe('ad blockers', () => {
  // Measured in the owner's Chrome: a file named analytics.js never loads, and
  // the whole admin page goes with it. Blockers' lists target the word in
  // addresses too, so the panel's requests must not carry it.
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

  it('no file a browser fetches is named analytics.js', () => {
    expect(existsSync(resolve(src, 'utils/analytics.js'))).toBe(false);
  });

  it('the service asks for addresses without the word', () => {
    const urls = readFileSync(resolve(src, 'services/dashboardService.js'), 'utf8').match(/'\/dashboard[^']*'/g);
    expect(urls).toHaveLength(5);
    urls.forEach((url) => expect(url).not.toMatch(/analytics/i));
  });
});
