import { describe, it, expect } from 'vitest';
import { cn }                   from '../../utils/cn';

describe('cn (class name utility)', () => {
  it('joins multiple class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, '', 'bar')).toBe('foo bar');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('works with conditional class', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('excludes inactive conditional class', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });
});