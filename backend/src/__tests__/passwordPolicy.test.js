// PF-125 — the shared password policy and the leaked-password check.
const crypto = require('crypto');
const { passwordProblem } = require('../utils/passwordPolicy');
const { isBreached }      = require('../services/breachedPasswords');

describe('passwordProblem — NIST length rule, no composition rules', () => {
  it.each([
    ['14 characters', 'a'.repeat(14), /at least 15/],
    ['65 characters', 'a'.repeat(65), /at most 64/],
    // 20 characters but 80 bytes — bcrypt would silently ignore the tail.
    ['20 four-byte emoji', '😀'.repeat(20), /at most 64/],
    ['not a string', ['a'.repeat(20)], /text/],
  ])('refuses %s', (_name, password, message) => {
    expect(passwordProblem(password)).toMatch(message);
  });

  it.each([
    ['exactly 15, all lower-case', 'a'.repeat(15)],
    ['exactly 64', 'a'.repeat(64)],
    ['a phrase with spaces', 'correct horse battery staple'],
  ])('accepts %s', (_name, password) => {
    expect(passwordProblem(password)).toBeNull();
  });

  it('counts an emoji as ONE character, not two', () => {
    // 14 letters + 1 emoji = 15 characters (16 UTF-16 units).
    expect(passwordProblem(`${'a'.repeat(14)}😀`)).toBeNull();
  });
});

describe('isBreached — Have I Been Pwned range API', () => {
  const password = 'correct horse battery staple';
  const sha1   = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  let fetchSpy, warn;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { fetchSpy.mockRestore(); warn.mockRestore(); });

  const answer = (body, status = 200) => fetchSpy.mockResolvedValue(new Response(body, { status }));

  it('sends ONLY the first 5 characters of the hash, with padding', async () => {
    answer('');
    await isBreached(password);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
    expect(url).not.toContain(sha1.slice(5));
    expect(init.headers['Add-Padding']).toBe('true');
  });

  it('true when the suffix is listed with a count', async () => {
    answer(`0000000000000000000000000000000000A:3\r\n${sha1.slice(5)}:42\r\n`);
    expect(await isBreached(password)).toBe(true);
  });

  it('false when the suffix is absent', async () => {
    answer('0000000000000000000000000000000000A:3\r\n');
    expect(await isBreached(password)).toBe(false);
  });

  it('false for a PADDING line (count 0) — padding is not a leak', async () => {
    answer(`${sha1.slice(5)}:0\r\n`);
    expect(await isBreached(password)).toBe(false);
  });

  it.each([
    ['an HTTP error', () => answer('', 503)],
    ['a network failure', () => fetchSpy.mockRejectedValue(new TypeError('fetch failed'))],
  ])('null (fails open) on %s, and logs it', async (_name, arrange) => {
    arrange();
    expect(await isBreached(password)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/skipped/));
  });
});

// ── PF-124 follow-up: strength — context words + zxcvbn 4 of 4 ─────────────
const { contextWords, strengthProblem } = require('../utils/passwordPolicy');

describe('contextWords', () => {
  it("takes each address's name part, the owner's name words and the site name", () => {
    expect(contextWords({
      addresses: ['pcgallege@gmail.com', 'parindrachameekara@gmail.com'],
      name: 'Parindra Chameekara Gallage',
    })).toEqual(['pcgallege', 'parindrachameekara', 'parindra', 'chameekara', 'gallage', 'portfolio']);
  });

  it('drops words under 4 letters', () => {
    expect(contextWords({ addresses: ['pc@x.com'], name: 'Al Bo' })).toEqual(['portfolio']);
  });
});

describe('strengthProblem', () => {
  const words = contextWords({ addresses: ['pcgallege@gmail.com'], name: 'Parindra Gallage' });

  it.each([
    ['the owner name', 'parindra sunset lamp river'],
    ['a look-alike of it', 'P4rindr@ sunset lamp river'],
    ['the address name', 'my pcgallege account key'],
    ['the site name', 'my portfolio site rocks'],
  ])('refuses %s — context words (NIST blocklist)', (_name, password) => {
    expect(strengthProblem(password, words)).toMatch(/your name, your email address or the site's name/);
  });

  it.each([
    ['repeated characters', 'aaaaaaaaaaaaaaa'],
    ['a keyboard run', 'qwertyuiopasdfg'],
    ['a doubled common word (score 3)', 'password password'],
  ])('refuses %s — zxcvbn under 4', (_name, password) => {
    expect(strengthProblem(password, words)).toEqual(expect.any(String));
  });

  it.each([
    'a long new pass phrase', 'tea leaf hill road', 'my dog loves rice', 'badminton court sunday',
  ])('accepts an ordinary passphrase %j', (password) => {
    expect(strengthProblem(password, words)).toBeNull();
  });
});
