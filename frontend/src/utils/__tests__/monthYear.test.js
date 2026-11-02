import { describe, it, expect } from 'vitest';
import {
  formatMonthYear, splitMonthYear, isFuture, compareMonthYear, dateRange, yearChoices,
  parseMonth, parseDay, typedMonthYear, monthYearProblem, daysIn,
} from '../monthYear';

const NOW = new Date(2026, 9, 30); // 30 OCT 2026, local

describe('monthYear', () => {
  it('formats a year, or a month and year, with three-letter months', () => {
    expect(formatMonthYear('2025-06')).toBe('JUN 2025');
    expect(formatMonthYear('2025-12')).toBe('DEC 2025');
    expect(formatMonthYear('2019')).toBe('2019');
    expect(formatMonthYear('')).toBe('');
    expect(formatMonthYear('2008-05-04')).toBe('04 MAY 2008');
  });

  it('splits a stored date', () => {
    expect(splitMonthYear('2025-06')).toEqual({ year: '2025', month: '06', day: '' });
    expect(splitMonthYear('2008-05-04')).toEqual({ year: '2008', month: '05', day: '04' });
    expect(splitMonthYear('')).toEqual({ year: '', month: '', day: '' });
  });

  it('reads a TYPED month: a number or at least three letters of its name', () => {
    for (const typed of ['6', '06', 'jun', 'JUN', 'June', ' june ']) expect(parseMonth(typed)).toBe('06');
    expect(parseMonth('sept')).toBe('09');
    expect(parseMonth('12')).toBe('12');
    expect(parseMonth('')).toBe('');
    for (const typed of ['0', '13', 'ju', 'jux', 'x', '6a']) expect(parseMonth(typed)).toBeNull();
  });

  it('turns typed boxes into the stored value, keeping a typo AS TYPED so the save is refused', () => {
    expect(typedMonthYear('2025', 'jun')).toBe('2025-06');
    expect(typedMonthYear('2025', '')).toBe('2025');
    expect(typedMonthYear('', '')).toBe('');
    expect(typedMonthYear('2025', 'jux')).toBe('2025-jux');
    expect(typedMonthYear('', 'jun')).toBe('-06');
    expect(typedMonthYear('20', '')).toBe('20');
  });

  it('knows each month\'s days, leap years included', () => {
    expect(daysIn('2024', 'feb')).toBe(29);   // divisible by 4
    expect(daysIn('2025', 'feb')).toBe(28);
    expect(daysIn('2100', '2')).toBe(28);     // a century, not divisible by 400
    expect(daysIn('2000', '2')).toBe(29);     // divisible by 400
    expect(daysIn('2025', 'apr')).toBe(30);
    expect(daysIn('2025', 'jan')).toBe(31);
    expect(daysIn('', 'feb')).toBe(29);       // no year yet: 29 is still possible
    expect(daysIn('2025', '')).toBe(31);      // no month yet
  });

  it('takes an optional DAY (owner, 2026-10-31: "04/5/2008")', () => {
    expect(parseDay('4')).toBe('04');
    expect(parseDay('31')).toBe('31');
    expect(parseDay('')).toBe('');
    for (const bad of ['0', '32', 'x', '4.']) expect(parseDay(bad)).toBeNull();
    expect(typedMonthYear('2008', '5', '4')).toBe('2008-05-04');
    expect(typedMonthYear('2008', 'may', '')).toBe('2008-05');
    expect(typedMonthYear('2008', '', '4')).toBe('2008--04');
    expect(typedMonthYear('2008', 'may', '40')).toBe('2008-05-40');
  });

  it('names what is wrong with a date — or nothing', () => {
    expect(monthYearProblem('', NOW)).toBeNull();
    expect(monthYearProblem('2025', NOW)).toBeNull();
    expect(monthYearProblem('2032-12', NOW)).toBeNull();
    expect(monthYearProblem('1980', NOW)).toBeNull();
    expect(monthYearProblem('2025-jux', NOW)).toBe('Type a month: JAN–DEC or 1–12.');
    expect(monthYearProblem('2025-', NOW)).toBe('Type a month: JAN–DEC or 1–12.');
    expect(monthYearProblem('-06', NOW)).toBe('Add the year too.');
    expect(monthYearProblem('2008-05-04', NOW)).toBeNull();
    expect(monthYearProblem('2024-02-29', NOW)).toBeNull();
    expect(monthYearProblem('2008--04', NOW)).toBe('Add the month too.');
    expect(monthYearProblem('2008-05-40', NOW)).toBe('Type a day: 1–31.');
    expect(monthYearProblem('2008-04-31', NOW)).toBe('APR 2008 has only 30 days.');
    expect(monthYearProblem('2025-02-29', NOW)).toBe('FEB 2025 has only 28 days.');
    expect(monthYearProblem('2024-02-30', NOW)).toBe('FEB 2024 has only 29 days.');
    expect(monthYearProblem('2000-02-29', NOW)).toBeNull();
    for (const bad of ['20', '1979', '2033', '20x5']) {
      expect(monthYearProblem(bad, NOW)).toBe('Type a year from 1980 to 2032.');
    }
  });

  it('knows a future date at its own precision', () => {
    expect(isFuture('2027', NOW)).toBe(true);
    expect(isFuture('2026', NOW)).toBe(false);       // this year is not "future"
    expect(isFuture('2026-11', NOW)).toBe(true);
    expect(isFuture('2026-10', NOW)).toBe(false);
    expect(isFuture('2025-12', NOW)).toBe(false);
    expect(isFuture('', NOW)).toBe(false);
    expect(isFuture('2026-10-31', NOW)).toBe(true);
    expect(isFuture('2026-10-30', NOW)).toBe(false);
  });

  it('compares at the coarser precision', () => {
    expect(compareMonthYear('2025', '2025-06')).toBe(0);
    expect(compareMonthYear('2025-05', '2025-06')).toBeLessThan(0);
    expect(compareMonthYear('2026', '2025-06')).toBeGreaterThan(0);
  });

  it('writes a range, marking an end still to come as expected', () => {
    expect(dateRange('2022-09', '2026-06', NOW)).toBe('SEP 2022 – JUN 2026');
    expect(dateRange('2022-09', '2027-06', NOW)).toBe('SEP 2022 – JUN 2027 (EXPECTED)');
    expect(dateRange('2019', '2021', NOW)).toBe('2019 – 2021');
    expect(dateRange('2022', '', NOW)).toBe('2022 – PRESENT');
    expect(dateRange('2008-05-04', '2021', NOW)).toBe('04 MAY 2008 – 2021');
  });

  it('offers years a few ahead and back to 1980, newest first', () => {
    const years = yearChoices(NOW);
    expect(years[0]).toBe('2032');
    expect(years.at(-1)).toBe('1980');
  });
});
