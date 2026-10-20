// PF-123 — the panel's date and time. Fixed instants, so the 12-hour clock is
// pinned whatever time of day the suite runs. Same cases as the backend's
// formatSent test: the two are mirrors.
import { describe, it, expect } from 'vitest';
import { formatSent, DEFAULT_ZONE } from '../messageTime';

describe('formatSent', () => {
  it.each([
    ['afternoon is PM, never 15',          '2026-01-05T09:37:00Z', 'Asia/Colombo', '2026/01/05', '3:07 PM'],
    ['morning is AM',                      '2026-01-05T03:35:00Z', 'Asia/Colombo', '2026/01/05', '9:05 AM'],
    ['noon is 12 PM',                      '2026-06-01T06:30:00Z', 'Asia/Colombo', '2026/06/01', '12:00 PM'],
    ['crosses midnight into the next day', '2026-12-31T19:00:00Z', 'Asia/Colombo', '2027/01/01', '12:30 AM'],
    ['midnight is 12 AM, never 0',         '2026-03-09T15:00:00Z', 'Asia/Tokyo',   '2026/03/10', '12:00 AM'],
  ])('%s', (_label, iso, zone, date, time) => {
    expect(formatSent(iso, zone)).toEqual({ date, time });
  });

  it('defaults to the About model default zone', () => {
    expect(DEFAULT_ZONE).toBe('Asia/Colombo');
  });
});
