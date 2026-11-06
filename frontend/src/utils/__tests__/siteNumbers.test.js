import { describe, expect, it } from 'vitest';
import { shortCount, updatedText } from '../siteNumbers';

describe('shortCount', () => {
  it.each([
    [0, '0'],
    [12, '12'],
    [999, '999'],
    [1000, '1k'],
    [1299, '1.2k'],
    [1999, '1.9k'],
    [999_999, '999.9k'],
    [1_000_000, '1M'],
    [2_590_000, '2.5M'],
  ])('%i → %s, rounded down', (value, text) => {
    expect(shortCount(value)).toBe(text);
  });
});

describe('updatedText', () => {
  const now = new Date('2026-11-06T12:00:00Z').getTime();
  const ago = (ms) => new Date(now - ms).toISOString();

  it('under a minute is just now', () => {
    expect(updatedText(ago(59_000), now)).toBe('Updated just now');
  });

  it('counts minutes and hours', () => {
    expect(updatedText(ago(60_000), now)).toBe('Updated 1 minute ago');
    expect(updatedText(ago(12 * 60_000), now)).toBe('Updated 12 minutes ago');
    expect(updatedText(ago(3 * 3_600_000), now)).toBe('Updated 3 hours ago');
  });

  it('a visitor whose clock runs behind sees just now, never a negative age', () => {
    expect(updatedText(new Date(now + 300_000).toISOString(), now)).toBe('Updated just now');
  });
});
