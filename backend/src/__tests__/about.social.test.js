const About = require('../models/About');

describe('About — social links (PF-60 Step 1)', () => {

  it('has all five social URL fields, twitter intentionally empty', () => {
    const a = new About({});

    expect(a.social.github).toContain('github.com');
    expect(a.social.linkedin).toContain('linkedin.com');
    expect(a.social.facebook).toContain('facebook.com');
    expect(a.social.instagram).toContain('instagram.com');
    expect(a.social.twitter).toBe('');
  });

  it('holds exactly one email, at the top level', () => {
    const a = new About({});

    expect(a.email).toBe('parindrachameekara@gmail.com');
    expect(a.social.email).toBeUndefined();
  });

  it('bio is already an array of paragraphs — no migration needed', () => {
    const a = new About({});

    expect(Array.isArray(a.bio)).toBe(true);
    expect(a.bio.length).toBeGreaterThan(0);
  });

  it('accepts the defaults as valid', () => {
    expect(new About({}).validateSync()).toBeUndefined();
  });

  it('rejects a social URL with no protocol', () => {
    const a = new About({ social: { facebook: 'facebook.com/someone' } });

    expect(a.validateSync().errors['social.facebook']).toBeDefined();
  });

  it('rejects a social URL with no domain dot', () => {
    const a = new About({ social: { instagram: 'https://instagram' } });

    expect(a.validateSync().errors['social.instagram']).toBeDefined();
  });

  it('allows twitter to stay empty', () => {
    const a = new About({ social: { twitter: '' } });

    expect(a.validateSync()).toBeUndefined();
  });

  it('accepts a twitter URL once one is added', () => {
    const a = new About({ social: { twitter: 'https://twitter.com/someone' } });

    expect(a.validateSync()).toBeUndefined();
  });

  it('rejects an invalid contact email at the model layer', () => {
    const a = new About({ email: 'not-an-email' });

    expect(a.validateSync().errors.email).toBeDefined();
  });

  it('ignores a stray social.email — the schema has no such path', () => {
    const a = new About({ social: { email: 'someone@else.com' } });

    expect(a.validateSync()).toBeUndefined();
    expect(a.social.email).toBeUndefined();
    expect(a.email).toBe('parindrachameekara@gmail.com');
  });

});

// ── PF-112: custom social links ─────────────────────────────────────────────
//
// Anything beyond the five fixed platforms. ⚠️ `url` is REQUIRED here, unlike
// `social.*` where empty means "hide this icon": a fixed key with no URL still
// means something (the platform exists, the account does not), while a custom row
// with no URL means nothing at all.
//
// ⚠️ Model-level, matching this file — `await doc.validate()`, never
// `validateSync()`, which runs no middleware and returns undefined for a valid
// document exactly as it does for one it never checked.
describe('About.socialExtra (PF-112)', () => {
  const withExtra = (rows) => new About({ socialExtra: rows });

  it('defaults to an empty list rather than undefined', () => {
    expect(new About({}).socialExtra).toEqual([]);
  });

  it('stores a named link', async () => {
    const a = withExtra([{ label: 'YouTube', url: 'https://youtube.com/@x' }]);
    await expect(a.validate()).resolves.toBeUndefined();

    expect(a.socialExtra).toHaveLength(1);
    expect(a.socialExtra[0].label).toBe('YouTube');
    expect(a.socialExtra[0].url).toBe('https://youtube.com/@x');
  });

  it('keeps several links in the order they were given', () => {
    const a = withExtra([
      { label: 'Zeta',  url: 'https://z.example' },
      { label: 'Alpha', url: 'https://a.example' },
    ]);
    expect(a.socialExtra.map((r) => r.label)).toEqual(['Zeta', 'Alpha']);
  });

  it('trims both halves', () => {
    const a = withExtra([{ label: '  YouTube  ', url: '  https://youtube.com/@x  ' }]);
    expect(a.socialExtra[0].label).toBe('YouTube');
    expect(a.socialExtra[0].url).toBe('https://youtube.com/@x');
  });

  it.each([
    ['no label', { label: '',        url: 'https://youtube.com/@x' }, /needs a name/i],
    ['no url',   { label: 'YouTube', url: '' },                      /needs a URL/i],
  ])('rejects a row with %s', async (_why, row, message) => {
    await expect(withExtra([row]).validate()).rejects.toThrow(message);
  });

  // ⚠️ NOT the shared urlValidator, which allows empty. A custom row must carry a
  // real http(s) URL — and rejecting `mailto:` and `javascript:` falls out of the
  // same rule, which is the part that matters for a value rendered into an href.
  it.each([
    ['a bare word',      'youtube'],
    ['a mailto',         'mailto:someone@else.dev'],
    ['a javascript URI', 'javascript:alert(1)'],
  ])('rejects %s as a URL', async (_why, url) => {
    await expect(withExtra([{ label: 'X', url }]).validate())
      .rejects.toThrow(/not a valid URL/i);
  });

  it('caps the label length', async () => {
    await expect(withExtra([{ label: 'x'.repeat(41), url: 'https://x.example' }]).validate())
      .rejects.toThrow(/cannot exceed 40/i);
  });
});

// ── PF-112: the location default's missing space ────────────────────────────
// Both public render sites print this value verbatim, so a document created from
// the default read "Galle,Sri Lanka" while a seeded one read "Galle, Sri Lanka" —
// two environments disagreeing on a rendered string, and it reads as a CSS bug.
describe('About.location (PF-112)', () => {
  it('defaults with a space after the comma', () => {
    expect(new About({}).location).toBe('Galle, Sri Lanka');
  });
});
