// frontend/src/utils/__tests__/passwordStrength.test.js — PF-124 follow-up
// The client copy of the server's strength rule, with the REAL zxcvbn.
import { describe, it, expect } from 'vitest';
import {
  contextWords, lettersOf, usesContextWord, loadStrengthChecker, CONTEXT, MIN_SCORE,
} from '../passwordStrength';

describe('contextWords — the same list the server builds', () => {
  it('address name parts, name words, the site name; short words dropped', () => {
    // backend/src/__tests__/passwordPolicy.test.js pins the same output.
    expect(contextWords({
      addresses: ['pcgallege@gmail.com', 'parindrachameekara@gmail.com'],
      name: 'Parindra Chameekara Gallage',
    })).toEqual(['pcgallege', 'parindrachameekara', 'parindra', 'chameekara', 'gallage', 'portfolio']);
    expect(contextWords({ addresses: ['pc@x.com'], name: 'Al Bo' })).toEqual(['portfolio']);
  });
});

describe('usesContextWord', () => {
  const words = ['parindra', 'portfolio'];
  it.each(['parindra sunset lamp', 'P4RINDR@ lamp river', 'my-portf0lio-key'])('catches %j', (p) => {
    expect(usesContextWord(p, words)).toBe(true);
  });
  it('lets an unrelated phrase through', () => {
    expect(usesContextWord('tea leaf hill road', words)).toBe(false);
  });
  it('undoes look-alikes and drops everything but letters', () => {
    expect(lettersOf('P4rindr@ 1!')).toBe('parindraii');
  });
});

describe('loadStrengthChecker (real zxcvbn)', () => {
  it(`passes an ordinary passphrase at score ${MIN_SCORE}`, async () => {
    const check = await loadStrengthChecker();
    expect(check('tea leaf hill road', [])).toEqual({ score: 4, problem: null });
  });

  it.each(['aaaaaaaaaaaaaaa', 'qwertyuiopasdfg', 'password password'])('refuses %j with a reason', async (p) => {
    const check = await loadStrengthChecker();
    const result = check(p, []);
    expect(result.score).toBeLessThan(MIN_SCORE);
    expect(result.problem).toEqual(expect.any(String));
  });

  it('a context word scores 0 with the context sentence', async () => {
    const check = await loadStrengthChecker();
    expect(check('parindra sunset lamp river', ['parindra'])).toEqual({ score: 0, problem: CONTEXT });
  });

  it('loads once — later calls share the checker', async () => {
    expect(await loadStrengthChecker()).toBe(await loadStrengthChecker());
  });
});
