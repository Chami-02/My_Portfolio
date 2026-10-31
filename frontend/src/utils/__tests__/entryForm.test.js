import { describe, it, expect } from 'vitest';
import {
  certificateToForm, certificatePayload, certificateFormErrors,
  educationToForm, educationPayload, educationFormErrors,
  isEntryDirty, moveId, dropId,
} from '../entryForm';

const fields = (errors) => errors.map((e) => e.field);

describe('certificates', () => {
  it('a draft needs only a title', () => {
    expect(certificateFormErrors({ ...certificateToForm(null), title: 'X', published: false })).toEqual([]);
    expect(fields(certificateFormErrors({ ...certificateToForm(null), published: false }))).toEqual(['title']);
  });

  it('publishing needs an issuer and an issue date', () => {
    const errors = certificateFormErrors({ ...certificateToForm(null), title: 'X', published: true });
    expect(fields(errors)).toEqual(['issuer', 'issued']);
  });

  it('a verify link must be https, and an expiry cannot come before the issue', () => {
    const form = { ...certificateToForm(null), title: 'X', issuer: 'Y', issued: '2025-06', published: true };
    expect(fields(certificateFormErrors({ ...form, verifyUrl: 'http://a.com/x' }))).toEqual(['verifyUrl']);
    expect(fields(certificateFormErrors({ ...form, verifyUrl: 'https://a.com/x' }))).toEqual([]);
    expect(fields(certificateFormErrors({ ...form, expires: '2025-05' }))).toEqual(['expires']);
    expect(fields(certificateFormErrors({ ...form, expires: '2025' }))).toEqual([]);
  });

  it('the payload is trimmed and carries the button\'s intent, never the picture', () => {
    const payload = certificatePayload({ ...certificateToForm(null), title: '  X  ' }, { publish: true });
    expect(payload).toMatchObject({ title: 'X', published: true });
    expect(payload).not.toHaveProperty('image');
    expect(payload).not.toHaveProperty('slug');
  });
});

describe('education', () => {
  it('school, start and end are required on every save; the degree never is (owner, 2026-10-31)', () => {
    const blank = educationToForm(null);
    expect(educationFormErrors({ ...blank, published: false }))
      .toEqual(['school', 'start', 'end'].map((field) => ({ field, message: 'This field is required.' })));
    const dated = { ...blank, school: 'W', start: '2019', end: '2021' };
    expect(educationFormErrors({ ...dated, published: false })).toEqual([]);
    expect(educationFormErrors({ ...dated, published: true })).toEqual([]);
  });

  it('a school website is optional, and must be https', () => {
    const form = { ...educationToForm(null), school: 'W', start: '2019', end: '2021', published: false };
    expect(educationFormErrors(form)).toEqual([]);
    expect(fields(educationFormErrors({ ...form, website: 'http://a.com' }))).toEqual(['website']);
    expect(educationFormErrors({ ...form, website: 'https://www.westminster.ac.uk' })).toEqual([]);
    expect(educationPayload({ ...form, website: ' https://a.com ' }, { publish: false }).website).toBe('https://a.com');
  });

  it('a mistyped date says what is wrong', () => {
    const form = { ...educationToForm(null), school: 'W', end: '2021', published: false };
    expect(educationFormErrors({ ...form, start: '2019-jux' })[0].message).toBe('Type a month: JAN–DEC or 1–12.');
    expect(educationFormErrors({ ...form, start: '19' })[0].message).toMatch(/^Type a year from 1980 to \d{4}\.$/);
    expect(educationFormErrors({ ...form, start: '-06' })[0].message).toBe('Add the year too.');
  });

  it('an end before the start is refused', () => {
    const form = { ...educationToForm(null), school: 'W', degree: 'BSc', start: '2022-09', published: true };
    expect(fields(educationFormErrors({ ...form, end: '2022-08' }))).toEqual(['end']);
    expect(fields(educationFormErrors({ ...form, end: '2022' }))).toEqual([]);
  });

  it('the payload carries no skills and no proof link (owner, 2026-10-31)', () => {
    const payload = educationPayload({ ...educationToForm(null), school: 'W' }, { publish: false });
    expect(payload).not.toHaveProperty('skills');
    expect(payload).not.toHaveProperty('proofUrl');
  });

  it('a stored entry round-trips into the form unchanged (not dirty)', () => {
    const saved = { school: 'W', degree: 'BSc', start: '2022', end: '', published: true };
    const form = educationToForm(saved);
    const opts = { toForm: educationToForm, toPayload: educationPayload };
    expect(isEntryDirty(form, saved, opts)).toBe(false);
    expect(isEntryDirty({ ...form, grade: 'First' }, saved, opts)).toBe(true);
  });
});

describe('ordering', () => {
  it('moves one step, and not past either end', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });

  it('drops an id BEFORE a position, from either side', () => {
    expect(dropId(['a', 'b', 'c', 'd'], 'a', 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(dropId(['a', 'b', 'c', 'd'], 'd', 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(dropId(['a', 'b', 'c', 'd'], 'a', 4)).toEqual(['b', 'c', 'd', 'a']);
    expect(dropId(['a', 'b', 'c', 'd'], 'b', 1)).toEqual(['a', 'b', 'c', 'd']);
  });
});
