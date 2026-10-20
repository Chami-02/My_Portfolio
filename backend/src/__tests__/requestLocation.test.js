// PF-123 — the sender's approximate location, from Vercel's IP headers.
const { requestLocation } = require('../utils/requestLocation');

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

/** A stand-in for Express's req.get (case-insensitive like the real one). */
const reqWith = (headers) => {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[name.toLowerCase()] };
};

const FULL = {
  'x-vercel-ip-city':           'New%20York',
  'x-vercel-ip-country-region': 'NY',
  'x-vercel-ip-country':        'US',
};

describe('requestLocation', () => {
  beforeEach(() => { process.env.VERCEL = '1'; });

  it('joins city, region and the country NAME', () => {
    expect(requestLocation(reqWith(FULL))).toBe('New York, NY, United States');
  });

  it('URL-decodes the city', () => {
    expect(requestLocation(reqWith({ ...FULL, 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-country': 'BR' })))
      .toBe('São Paulo, SP, Brazil');
  });

  it('keeps a malformed escape as raw text instead of throwing', () => {
    expect(requestLocation(reqWith({ 'x-vercel-ip-city': 'Bad%E0%A4', 'x-vercel-ip-country': 'LK' })))
      .toBe('Bad%E0%A4, Sri Lanka');
  });

  it('leaves out a region code that is only digits (Sri Lanka\'s Western Province is "1")', () => {
    expect(requestLocation(reqWith({ 'x-vercel-ip-city': 'Colombo', 'x-vercel-ip-country-region': '1', 'x-vercel-ip-country': 'LK' })))
      .toBe('Colombo, Sri Lanka');
  });

  it('leaves out the parts Vercel did not send', () => {
    expect(requestLocation(reqWith({ 'x-vercel-ip-country': 'LK' }))).toBe('Sri Lanka');
  });

  it('is null when there are no location headers at all', () => {
    expect(requestLocation(reqWith({}))).toBeNull();
  });

  it('keeps a code it cannot name as it came', () => {
    expect(requestLocation(reqWith({ 'x-vercel-ip-country': 'not-a-code' }))).toBe('not-a-code');
  });

  it('caps every part at 100 characters', () => {
    const out = requestLocation(reqWith({ 'x-vercel-ip-city': 'x'.repeat(500) }));
    expect(out).toHaveLength(100);
  });

  it('ignores the headers OFF Vercel — there, anyone could send them', () => {
    delete process.env.VERCEL;
    expect(requestLocation(reqWith(FULL))).toBeNull();
  });
});
