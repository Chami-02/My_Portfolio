import { describe, it, expect, vi } from 'vitest';
import { isTimeZone, timezoneLabel, timezoneGroups } from '../timezone';

const JAN = new Date('2026-01-15T12:00:00Z');
const JUL = new Date('2026-07-15T12:00:00Z');

describe('timezoneLabel', () => {
  it('prints a place as its UTC offset', () => {
    expect(timezoneLabel('Asia/Colombo', JAN)).toBe('UTC+5:30');
    expect(timezoneLabel('Asia/Kathmandu', JAN)).toBe('UTC+5:45');
    expect(timezoneLabel('America/Sao_Paulo', JAN)).toBe('UTC-3');
  });

  it('follows daylight saving — the reason a place is stored, not an offset', () => {
    expect(timezoneLabel('Europe/London', JAN)).toBe('UTC+0');
    expect(timezoneLabel('Europe/London', JUL)).toBe('UTC+1');
    // The control: a zone without DST reads the same in both halves.
    expect(timezoneLabel('Asia/Colombo', JUL)).toBe(timezoneLabel('Asia/Colombo', JAN));
  });

  it('blank renders nothing', () => {
    expect(timezoneLabel('')).toBe('');
    expect(timezoneLabel(undefined)).toBe('');
  });

  it('a legacy free-text value renders unchanged rather than vanishing', () => {
    expect(timezoneLabel('UTC+5:30')).toBe('UTC+5:30');
  });
});

describe('isTimeZone', () => {
  it.each(['Asia/Colombo', 'Europe/London', 'UTC', 'America/Port-au-Prince'])('accepts %s', (z) => {
    expect(isTimeZone(z)).toBe(true);
  });
  it.each(['', '+05:30', 'UTC+5:30', 'Asia/Colmbo', null, ['Asia/Colombo']])('rejects %s', (z) => {
    expect(isTimeZone(z)).toBe(false);
  });
});

describe('timezoneGroups', () => {
  const groups = timezoneGroups(JAN);
  const all = groups.flatMap((g) => g.options);

  it('lists every place ICU knows, grouped by region', () => {
    expect(all).toHaveLength(Intl.supportedValuesOf('timeZone').length);
    expect(groups.map((g) => g.region)).toEqual(expect.arrayContaining(['Africa', 'America', 'Asia', 'Europe']));
  });

  it('labels each place with its offset, underscores as spaces', () => {
    expect(all.find((o) => o.value === 'Asia/Colombo').label).toBe('Asia/Colombo — UTC+5:30');
    expect(all.find((o) => o.value === 'America/Sao_Paulo').label).toBe('America/Sao Paulo — UTC-3');
  });

  it('every option is a valid place — the dropdown cannot produce a typo', () => {
    expect(all.every((o) => isTimeZone(o.value))).toBe(true);
  });
});

describe('isTimeZone — the SHAPE check, on an engine that accepts offsets', () => {
  // Same reason as the backend's twin: this runtime's ICU rejects "+05:30" by
  // itself; current browsers may not. Simulate one that accepts anything.
  it('rejects offsets even when Intl would accept them; a place still passes', () => {
    // A `function`, not an arrow: the code calls it with `new`.
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function FakeFormat() { return {}; });
    try {
      expect(isTimeZone('+05:30')).toBe(false);
      expect(isTimeZone('-03:00')).toBe(false);
      expect(isTimeZone('Asia/Colombo')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
