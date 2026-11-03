// PF-144 — one plain sentence for every failure (owner, 2026-11-03).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { friendlyError, isPlain, MESSAGES, JARGON } from '../friendlyError';

const res = (status, message) => ({ response: { status, data: message === undefined ? {} : { message } } });

describe('friendlyError — every kind of failure', () => {
  it.each([
    ['no internet / site unreachable', { code: 'ERR_NETWORK' }, MESSAGES.offline],
    ['a timeout',                      { code: 'ECONNABORTED' }, MESSAGES.slow],
    ['nothing at all thrown',          undefined, MESSAGES.offline],
    ['too many tries, no words',       res(429), MESSAGES.busy],
    ['a crash on our side',            res(500, 'TypeError: x is undefined'), MESSAGES.ourSide],
    ['a bad gateway',                  res(502), MESSAGES.ourSide],
    ['a 503 with technical words',     res(503, 'File storage is not configured on this server'), MESSAGES.ourSide],
    ['a session that ended, no words', res(401), MESSAGES.session],
    ['not allowed',                    res(403), MESSAGES.forbidden],
    ['not found, no words',            res(404), MESSAGES.notFound],
    ['too big',                        res(413), MESSAGES.tooBig],
    ['wrong file type',                res(415), MESSAGES.fileType],
    ['a 400 with technical words',     res(400, 'Invalid project ID format'), MESSAGES.generic],
  ])('%s → a plain sentence', (_name, err, expected) => {
    expect(friendlyError(err)).toBe(expected);
  });

  it("shows the server's own words when they are plain", () => {
    expect(friendlyError(res(400, 'Please enter a valid email address.'))).toBe('Please enter a valid email address.');
    expect(friendlyError(res(429, 'You have sent several messages already. Please try again in an hour.')))
      .toBe('You have sent several messages already. Please try again in an hour.');
    expect(friendlyError(res(503, "Uploads aren't working right now. Please try again later.")))
      .toBe("Uploads aren't working right now. Please try again later.");
  });

  it('NEVER shows a 5xx message, however plain — whatever broke there is ours', () => {
    expect(friendlyError(res(500, 'Something odd happened'))).toBe(MESSAGES.ourSide);
  });

  it('a screen can give its own fallback and its own "not found"', () => {
    expect(friendlyError(res(400), { fallback: "Your message couldn't be sent." })).toBe("Your message couldn't be sent.");
    expect(friendlyError(res(404), { notFound: "That post isn't here." })).toBe("That post isn't here.");
  });

  it('every built-in message is itself plain, and says what to do', () => {
    for (const m of Object.values(MESSAGES)) {
      expect(isPlain(m)).toBe(true);
      expect(m).toMatch(/[.!]$/);
    }
  });
});

// ── the guard: no jargon in any hard-coded failure message on any screen ─────
// Reads every component, page and util (tests excluded) and checks each
// literal handed to an error-showing call: set…Error(…), onError(…),
// failures / problems .push(…), `fallback:` and LoadError's text.
describe('no hard-coded failure message on any screen uses jargon', () => {
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return ['__tests__', 'test'].includes(f) ? [] : walk(p);
    return /\.jsx?$/.test(f) ? [p] : [];
  });
  // One-line literals only — a literal never spans a line break here, and a
  // pattern that could would swallow whole blocks of code.
  const CALL = /(?:set\w*Errors?\(\[?|onError\(|(?:failures|problems)\.push\(|fallback:\s*|\? )\s*(['`"])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
  const found = walk(SRC).flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    return [...src.matchAll(CALL)]
      // Only the words a person reads: a template's ${…} slots are code.
      .map((m) => ({ where: `${relative(SRC, file)}:${src.slice(0, m.index).split('\n').length}`, text: m[2].replace(/\$\{[^}]*\}/g, '') }))
      .filter(({ text }) => /[a-z]{2,} [a-z]{2,}/i.test(text));
  });

  it('finds the messages (the scan is not vacuous)', () => {
    expect(found.length).toBeGreaterThan(20);
  });

  it('none contains a technical word', () => {
    expect(found.filter(({ text }) => JARGON.test(text)).map(({ where, text }) => `${where}: ${text}`)).toEqual([]);
  });
});
