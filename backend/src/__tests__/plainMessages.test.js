// PF-144 (owner, 2026-11-03): every message the site can show a person is in
// plain words — "use simple industry standard error messages … don't use any
// difficult technical terms". This guard reads the SOURCE of every message
// the API can send (AppError, express-validator, model validators, rate
// limiters, the backup check) and fails if one contains a technical word.
//
// The jargon list mirrors frontend/src/utils/friendlyError.js `JARGON`, plus
// the programming words a model message tends to leak ("array", "string",
// "document") and "log in" (the site says "sign in" everywhere).
const fs = require('fs');
const path = require('path');

const JARGON = /\b(HTTP|IP|(?<!Credential )IDs?|tokens?|servers?|backend|database|undefined|null|NaN|slugs?|payload|endpoint|bad request|request failed|format|configured|replica|transactions?|ObjectId|CastError|Mongo\w*|JSON|stack trace|exception|status code|array|string|document|schema|log in|login|ids)\b/i;

const SRC = path.resolve(__dirname, '..');
const walk = (dir) => fs.readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  if (fs.statSync(p).isDirectory()) return ['__tests__', 'migrations'].includes(f) ? [] : walk(p);
  return p.endsWith('.js') ? [p] : [];
});

/** Every literal handed to a message-producing construct, with where it is. */
const MESSAGE = /(?:new AppError\(|withMessage\(|message:\s*|problems\.push\(|\[\s*(?:true|isPublished|function[^,]*),\s*)\s*(['`"])((?:(?!\1)[^\\]|\\.)*)\1/g;
const messages = walk(SRC).flatMap((file) => {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(MESSAGE)]
    .map((m) => ({ where: `${path.relative(SRC, file)}:${src.slice(0, m.index).split('\n').length}`, text: m[2] }))
    .filter(({ text }) => /[a-z]{2,} [a-z]{2,}/i.test(text));   // sentences, not keys
});

describe('every message the API can send is in plain words', () => {
  it('finds the messages (the scan is not vacuous)', () => {
    expect(messages.length).toBeGreaterThan(200);
  });

  it('none contains a technical word', () => {
    const offenders = messages.filter(({ text }) => JARGON.test(text)).map(({ where, text }) => `${where}: ${text}`);
    expect(offenders).toEqual([]);
  });

  it('the jargon list catches what it should, and lets plain words through', () => {
    for (const bad of ['Invalid project ID format', 'Request failed (HTTP 500)', 'Too many requests from this IP', 'Tech array cannot be empty', 'Please log in again']) {
      expect(bad).toMatch(JARGON);
    }
    for (const ok of ["We couldn't find that project.", 'Check it, or request a new one.', 'Credential ID cannot exceed 100 characters.', 'Pick or type a tech stack']) {
      expect(ok).not.toMatch(JARGON);
    }
  });
});
