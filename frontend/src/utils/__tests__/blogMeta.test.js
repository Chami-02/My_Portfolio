// frontend/src/utils/__tests__/blogMeta.test.js
import { describe, it, expect, afterEach, vi } from 'vitest';
import { formatDate, formatReadTime } from '../blogMeta';

afterEach(() => { vi.restoreAllMocks(); });

describe('formatDate', () => {
  // ⚠️ PF-104 widened this from the prototype's `JUL 2026` to the full
  // date. Restoring the month-only form to match the frozen export is the
  // thing that was rejected.
  it('renders the full `14 JUL 2026` shape, uppercased', () => {
    expect(formatDate('2026-07-14T09:00:00.000Z')).toBe('14 JUL 2026');
  });

  it.each([
    ['2026-04-11T10:00:00.000Z', '11 APR 2026'],
    ['2026-06-15T12:00:00.000Z', '15 JUN 2026'],
    ['2025-12-15T12:00:00.000Z', '15 DEC 2025'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });

  /**
   * ⚠️ `day: '2-digit'`, not `'numeric'`. The dates stack directly above
   * one another down the grid in mono at .12em tracking, so `4 MAY` beside
   * `14 JUL` is a visibly ragged column. Asserted on a single-digit day,
   * which is the only input that can tell the two options apart.
   */
  it('zero-pads a single-digit day', () => {
    expect(formatDate('2026-05-04T09:00:00.000Z')).toBe('04 MAY 2026');
  });

  /**
   * ⚠️ en-GB abbreviates September to FOUR letters, and this is the real
   * shipped output — the live page reads `SEPT 2026 · 1 MIN READ`.
   *
   * Worth pinning rather than leaving implicit: the design's meta label is
   * mono at .12em tracking and every month in its own fixture data is three
   * letters, so `SEPT` is the one value that is wider than the design ever
   * shows. It is the pinned locale's correct output, not a defect, and it
   * predates PF-98 (the formatter is PF-86's, moved here unchanged).
   */
  it('renders September as SEPT — en-GB uses four letters, and that ships', () => {
    expect(formatDate('2026-09-01T12:00:00.000Z')).toBe('01 SEPT 2026');
  });

  /**
   * ⚠️ Documents a real property rather than asserting a fixed string:
   * `toLocaleDateString` formats in the READER'S timezone, so an instant
   * within a few hours of a month boundary renders as a different month
   * either side of the date line. `2025-12-31T23:59:59Z` is `JAN 2026` in
   * Colombo (UTC+5:30) and `DEC 2025` in London.
   *
   * Pre-existing (PF-86) and deliberately NOT changed here — pinning the
   * formatter to UTC would alter dates that currently render correctly for
   * most readers. This test is timezone-independent on purpose; an assertion
   * on the literal month would pass or fail with the machine's clock, which
   * is how a suite becomes flaky on somebody else's laptop.
   */
  it('formats in local time, so a boundary instant belongs to one of two days', () => {
    // ⚠️ PF-104 made this MORE visible, not different: with a day on
    // screen, any instant near midnight UTC shifts — not just one near a
    // month boundary. Still asserted as a set, so the suite does not fail
    // on somebody else's laptop.
    expect(['31 DEC 2025', '01 JAN 2026'])
      .toContain(formatDate('2025-12-31T23:59:59.000Z'));
  });

  /**
   * ⚠️ The guard that actually earns its place.
   *
   * `toLocaleDateString` with the locale argument DROPPED still returns
   * `JUL 2026` on any en-GB or en-US machine, so every assertion above
   * passes against a version that has lost the pin. The locale is a
   * deliberate decision (a Sinhala or Japanese month name has no styling in
   * this design, and the label is uppercase mono at .12em tracking), so the
   * ARGUMENT is what has to be asserted, not the output.
   *
   * Mutation-checked: deleting `'en-GB'` from blogMeta.js fails this test
   * and this test alone.
   */
  it('passes an explicit locale, not the visitor\'s', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    formatDate('2026-07-14T09:00:00.000Z');

    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(typeof call[0]).toBe('string');
      expect(call[0]).toBe('en-GB');
    }
  });

  /**
   * The NaN guard. A post with neither `publishedAt` nor `createdAt` must
   * render nothing rather than the literal string `INVALID DATE`, which is
   * what an unguarded `toLocaleDateString` produces.
   */
  it.each([undefined, '', 'not-a-date', {}])(
    'returns an empty string rather than INVALID DATE for %s',
    (input) => {
      expect(formatDate(input)).toBe('');
    },
  );

  /**
   * ⚠️ `null` is deliberately NOT in the list above, and the omission is the
   * point: `new Date(null)` is the EPOCH, not an invalid date, so this
   * renders `JAN 1970` rather than ''. The first draft of this test asserted
   * '' for null and failed — the test was wrong, not the code.
   *
   * Left as found rather than guarded. Every call site passes
   * `publishedAt || createdAt`, and `createdAt` is written unconditionally by
   * Mongoose's `timestamps: true` (backend/src/models/Blog.js), so a genuine
   * null cannot reach here. Adding a nullish branch would be surface for an
   * unreachable case; pinning the real behaviour costs nothing and tells the
   * next reader it was considered.
   */
  it('renders the epoch for null, because new Date(null) is not invalid', () => {
    expect(formatDate(null)).toBe('01 JAN 1970');
  });
});

describe('formatReadTime', () => {
  it('renders the schema field, computing nothing', () => {
    expect(formatReadTime(6)).toBe('6 MIN READ');
  });

  it('does not special-case the singular — the design has no such state', () => {
    expect(formatReadTime(1)).toBe('1 MIN READ');
  });
});
