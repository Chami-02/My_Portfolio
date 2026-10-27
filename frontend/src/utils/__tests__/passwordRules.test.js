// frontend/src/utils/__tests__/passwordRules.test.js — PF-124 / PF-125
import { describe, it, expect } from 'vitest';
import { MIN_LENGTH, lengthOf, passwordChangeErrors, EMPTY_CHANGE } from '../passwordRules';

const fields = (errors) => errors.map((e) => e.field);
const valid = { ...EMPTY_CHANGE, step: 'passwords', currentPassword: 'now', password: 'a long new pass phrase', confirm: 'a long new pass phrase' };

describe('lengthOf', () => {
  it('counts what the reader sees — an emoji is one', () => {
    expect(lengthOf('😀'.repeat(MIN_LENGTH))).toBe(MIN_LENGTH);
  });
});

describe('passwordChangeErrors — step passwords', () => {
  it('passes a valid form', () => {
    expect(passwordChangeErrors(valid)).toEqual([]);
  });

  it('marks every bad field, in screen order', () => {
    expect(fields(passwordChangeErrors({ ...valid, currentPassword: '', password: 'short', confirm: 'x' })))
      .toEqual(['currentPassword', 'password', 'confirm']);
  });

  it(`takes exactly ${MIN_LENGTH} characters, refuses one fewer`, () => {
    const at = 'x'.repeat(MIN_LENGTH);
    expect(passwordChangeErrors({ ...valid, password: at, confirm: at })).toEqual([]);
    const under = 'x'.repeat(MIN_LENGTH - 1);
    expect(fields(passwordChangeErrors({ ...valid, password: under, confirm: under }))).toEqual(['password']);
  });

  it('refuses the current password as the new one', () => {
    const same = { ...valid, currentPassword: valid.password };
    expect(passwordChangeErrors(same)).toEqual([
      { field: 'password', message: 'Must be different from your current password.' },
    ]);
  });

  it("refuses the password with the strength checker's reason", () => {
    expect(passwordChangeErrors({ ...valid, strength: { score: 1, problem: 'Too easy.' } }))
      .toEqual([{ field: 'password', message: 'Too easy.' }]);
  });

  it('a strength not known yet (still loading) refuses nothing — the server decides', () => {
    expect(passwordChangeErrors({ ...valid, strength: null })).toEqual([]);
    expect(passwordChangeErrors({ ...valid, strength: { score: 4, problem: null } })).toEqual([]);
  });

  it('ignores the code on this step', () => {
    expect(passwordChangeErrors({ ...valid, code: 'nonsense' })).toEqual([]);
  });
});

describe('passwordChangeErrors — step code', () => {
  it.each(['123456', ' 123456 '])('accepts %j', (code) => {
    expect(passwordChangeErrors({ ...valid, step: 'code', code })).toEqual([]);
  });
  it.each(['', '12345', '1234567', '12a456'])('refuses %j', (code) => {
    expect(fields(passwordChangeErrors({ ...valid, step: 'code', code }))).toEqual(['code']);
  });
});
