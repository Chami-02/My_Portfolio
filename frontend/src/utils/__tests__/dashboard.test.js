import { describe, it, expect } from 'vitest';
import { greetingFor } from '../dashboard';

// Local-time Dates, so the assertion is about the hour the prototype
// reads (`getHours()`), not UTC.
const at = (h, m = 0) => new Date(2026, 8, 16, h, m);

describe('greetingFor', () => {
  it('is GOOD MORNING from midnight up to noon', () => {
    expect(greetingFor(at(0))).toBe('GOOD MORNING');
    expect(greetingFor(at(11, 59))).toBe('GOOD MORNING');
  });

  it('is GOOD AFTERNOON from noon up to 18:00', () => {
    expect(greetingFor(at(12))).toBe('GOOD AFTERNOON');
    expect(greetingFor(at(17, 59))).toBe('GOOD AFTERNOON');
  });

  it('is GOOD EVENING from 18:00 to midnight', () => {
    expect(greetingFor(at(18))).toBe('GOOD EVENING');
    expect(greetingFor(at(23, 59))).toBe('GOOD EVENING');
  });

  it('defaults to now', () => {
    expect(['GOOD MORNING', 'GOOD AFTERNOON', 'GOOD EVENING']).toContain(greetingFor());
  });
});
