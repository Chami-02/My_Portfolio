// frontend/src/utils/__tests__/seasonalEffect.test.js
import { describe, it, expect } from 'vitest';
import { activeEffect, seasonStatus, SEASONAL_MODES } from '../seasonalEffect';

// Local midnight and the last minute of the day: the seasons follow the
// visitor's own calendar, so both ends of a day must agree.
const day = (y, m, d) => new Date(y, m - 1, d, 0, 0, 0);
const dayEnd = (y, m, d) => new Date(y, m - 1, d, 23, 59, 59);

describe('activeEffect — AUTOMATIC follows the owner\'s dates', () => {
  it.each([
    ['30 Oct', 2026, 10, 30, null],
    ['31 Oct', 2026, 10, 31, 'halloween'],
    ['1 Nov',  2026, 11, 1,  'halloween'],
    ['2 Nov',  2026, 11, 2,  'halloween'],
    ['3 Nov',  2026, 11, 3,  null],
    ['30 Nov', 2026, 11, 30, null],
    ['1 Dec',  2026, 12, 1,  'snow'],
    ['25 Dec', 2026, 12, 25, 'snow'],
    ['31 Dec', 2026, 12, 31, 'snow'],
    ['1 Jan',  2027, 1,  1,  'snow'],
    ['2 Jan',  2027, 1,  2,  null],
    ['6 Jun',  2027, 6,  6,  null],
    ['29 Feb in a leap year', 2028, 2, 29, null],
  ])('%s, start and end of the day', (_name, y, m, d, expected) => {
    expect(activeEffect('auto', day(y, m, d))).toBe(expected);
    expect(activeEffect('auto', dayEnd(y, m, d))).toBe(expected);
  });

  it('repeats every year with nobody touching anything', () => {
    for (const year of [2026, 2030, 2040]) {
      expect(activeEffect('auto', day(year, 12, 1))).toBe('snow');
      expect(activeEffect('auto', day(year, 10, 31))).toBe('halloween');
    }
  });
});

describe('activeEffect — the switch overrides the dates', () => {
  const JUNE = day(2027, 6, 6);
  const DECEMBER = day(2026, 12, 25);

  it('SNOW NOW and HALLOWEEN NOW show on any date', () => {
    expect(activeEffect('snow', JUNE)).toBe('snow');
    expect(activeEffect('halloween', JUNE)).toBe('halloween');
    expect(activeEffect('halloween', DECEMBER)).toBe('halloween');
  });

  it('OFF stops it even in the season', () => {
    expect(activeEffect('off', DECEMBER)).toBeNull();
  });

  // A failed load, or a backend from before the field: the dates still work.
  it.each([[undefined], [null], ['nonsense']])('%s counts as AUTOMATIC', (mode) => {
    expect(activeEffect(mode, DECEMBER)).toBe('snow');
    expect(activeEffect(mode, JUNE)).toBeNull();
  });
});

describe('seasonStatus — what the card says', () => {
  it.each([
    [day(2026, 11, 6),   'Automatic. Nothing is showing today. Snow starts on 1 December.'],
    [day(2027, 1, 2),    'Automatic. Nothing is showing today. Leaves and bats start on 31 October.'],
    [day(2027, 10, 30),  'Automatic. Nothing is showing today. Leaves and bats start on 31 October.'],
    [day(2026, 12, 25),  'Automatic. Snow is showing until 1 January.'],
    [day(2027, 1, 1),    'Automatic. Snow is showing until 1 January.'],
    [day(2026, 10, 31),  'Automatic. Leaves and bats are showing until 2 November.'],
  ])('AUTOMATIC on %s', (now, sentence) => {
    expect(seasonStatus('auto', now)).toBe(sentence);
  });

  it('never claims the dates for a manual choice', () => {
    const DECEMBER = day(2026, 12, 25);
    expect(seasonStatus('snow', DECEMBER)).toBe('Snow is showing to every visitor, whatever the date.');
    expect(seasonStatus('halloween', DECEMBER)).toBe('Leaves and bats are showing to every visitor, whatever the date.');
    expect(seasonStatus('off', DECEMBER)).toBe('Off. Nothing is showing, even during the seasons.');
  });

  it('agrees with activeEffect on the whole of a year', () => {
    for (let d = day(2027, 1, 1); d.getFullYear() === 2027; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const saysNothing = seasonStatus('auto', d).includes('Nothing is showing');
      expect(saysNothing).toBe(activeEffect('auto', d) === null);
    }
  });

  it('the modes list matches the four choices', () => {
    expect(SEASONAL_MODES).toEqual(['auto', 'snow', 'halloween', 'off']);
  });
});
