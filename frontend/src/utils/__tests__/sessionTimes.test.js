// PF-132 — the Sessions card's "ACTIVE … AGO".
import { describe, it, expect } from 'vitest';
import { activeText } from '../sessionTimes';

const NOW = Date.parse('2026-10-29T12:00:00.000Z');
const MIN = 60 * 1000;
const at  = (msAgo) => new Date(NOW - msAgo).toISOString();

describe('activeText', () => {
  it.each([
    [0,                     'ACTIVE IN THE LAST 15 MIN'],
    [15 * MIN - 1,          'ACTIVE IN THE LAST 15 MIN'],   // one refresh interval: no finer claim
    [15 * MIN,              'ACTIVE 15 MIN AGO'],
    [59 * MIN,              'ACTIVE 59 MIN AGO'],
    [60 * MIN,              'ACTIVE 1 H AGO'],
    [23 * 60 * MIN,         'ACTIVE 23 H AGO'],
    [24 * 60 * MIN,         'ACTIVE 1 DAY AGO'],
    [6 * 24 * 60 * MIN,     'ACTIVE 6 DAYS AGO'],
  ])('%i ms ago → %s', (ms, text) => {
    expect(activeText(at(ms), NOW)).toBe(text);
  });

  it('a clock a little ahead of the server never says "-1 MIN"', () => {
    expect(activeText(at(-5 * MIN), NOW)).toBe('ACTIVE IN THE LAST 15 MIN');
  });

  it('an unreadable date says nothing', () => {
    expect(activeText('not a date', NOW)).toBe('');
    expect(activeText(undefined, NOW)).toBe('');
  });
});
