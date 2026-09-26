// frontend/src/utils/__tests__/formErrors.test.js
//
// The vocabulary every admin panel's validation speaks.
import { describe, it, expect } from 'vitest';
import {
  errorFor, hasError, fieldId, errorId, fieldProps,
  isUsableUrl, isUsableEmail, rowIsBlank,
} from '../formErrors';

const ERRORS = [
  { field: 'email',              message: 'That email address looks off.' },
  { field: 'socialExtra.0.url',  message: 'Add a URL to save this link.' },
  { field: 'socialExtra.1.url',  message: 'Enter a full URL, starting with https://' },
];

describe('errorFor / hasError', () => {
  it('finds a message by its exact path', () => {
    expect(errorFor(ERRORS, 'email')).toBe('That email address looks off.');
    expect(errorFor(ERRORS, 'socialExtra.1.url'))
      .toBe('Enter a full URL, starting with https://');
  });

  it('keeps two rows of the same field apart', () => {
    // ⚠️ The index is part of the path for exactly this reason. A validator
    // keyed on the field NAME would mark every custom link when one was wrong.
    expect(errorFor(ERRORS, 'socialExtra.0.url')).not
      .toBe(errorFor(ERRORS, 'socialExtra.1.url'));
  });

  it('returns undefined for a clean field, never a falsy string', () => {
    // `''` would make `aria-describedby` point at nothing, which some screen
    // readers announce as a blank description.
    expect(errorFor(ERRORS, 'location')).toBeUndefined();
    expect(hasError(ERRORS, 'location')).toBe(false);
  });

  it('survives an absent error list', () => {
    expect(errorFor(undefined, 'email')).toBeUndefined();
    expect(hasError(null, 'email')).toBe(false);
  });
});

describe('fieldId / errorId', () => {
  it('flattens the dotted path into a usable DOM id', () => {
    // Dots are legal in an id but break querySelector and CSS selectors
    // without escaping, which is a trap nobody needs.
    expect(fieldId('about', 'socialExtra.0.url')).toBe('about-socialExtra-0-url');
    expect(fieldId('about', 'email')).toBe('about-email');
  });

  it('derives the describedby id from the same path', () => {
    expect(errorId('about', 'stats.2.value')).toBe('about-stats-2-value-error');
  });

  it('namespaces by panel, so two panels cannot collide', () => {
    expect(fieldId('about', 'title')).not.toBe(fieldId('post', 'title'));
  });
});

describe('fieldProps', () => {
  it('marks an invalid field both visually and semantically', () => {
    // ⚠️ ONE attribute drives both — admin.module.css styles
    // `[aria-invalid='true']` rather than offering a class, so a field that
    // looks wrong is guaranteed to announce wrong.
    expect(fieldProps(ERRORS, 'about', 'email')).toEqual({
      id: 'about-email',
      'aria-invalid': 'true',
      'aria-describedby': 'about-email-error',
    });
  });

  it('leaves a clean field with neither attribute defined', () => {
    expect(fieldProps(ERRORS, 'about', 'location')).toEqual({
      id: 'about-location',
      'aria-invalid': undefined,
      'aria-describedby': undefined,
    });
  });
});

describe('isUsableUrl', () => {
  it('accepts a full http(s) URL', () => {
    expect(isUsableUrl('https://github.com/Chami-02')).toBe(true);
    expect(isUsableUrl('http://example.org/x')).toBe(true);
    expect(isUsableUrl('  https://x.example  ')).toBe(true);
  });

  it('refuses what the SERVER would refuse', () => {
    // ⚠️ The point of mirroring About.js's urlValidator rather than using
    // `new URL()`: `new URL('https://x')` parses happily and the server then
    // 400s it, which moves the error from the field to a banner — worse than
    // no client check at all.
    expect(isUsableUrl('https://x')).toBe(false);       // no dot
    expect(isUsableUrl('github.com/me')).toBe(false);   // no scheme
    expect(isUsableUrl('javascript:alert(1)')).toBe(false);
    expect(isUsableUrl('')).toBe(false);
    expect(isUsableUrl(undefined)).toBe(false);
  });
});

describe('isUsableEmail', () => {
  it('accepts an ordinary address', () => {
    expect(isUsableEmail('pcgallege@gmail.com')).toBe(true);
  });

  it('refuses a malformed one', () => {
    expect(isUsableEmail('pcgallege@')).toBe(false);
    expect(isUsableEmail('pcgallege@gmail')).toBe(false);
    expect(isUsableEmail('not an address')).toBe(false);
    expect(isUsableEmail('')).toBe(false);
  });
});

describe('rowIsBlank', () => {
  it('is true only when EVERY value is blank', () => {
    expect(rowIsBlank({ label: '', url: '' }, ['label', 'url'])).toBe(true);
    expect(rowIsBlank({ label: '   ', url: '  ' }, ['label', 'url'])).toBe(true);
    expect(rowIsBlank({ label: 'X', url: '' }, ['label', 'url'])).toBe(false);
  });

  it('survives a missing row', () => {
    expect(rowIsBlank(undefined, ['label', 'url'])).toBe(true);
  });
});
