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
