// frontend/src/utils/__tests__/social.test.js
//
// PF-112 — which social rows the public site shows, and in what order.
import { describe, it, expect } from 'vitest';
import { socialEntries } from '../social';
import { iconFor, SOCIAL_ICONS } from '../../components/icons/socialIcons';
import { LinkIcon, TwitterIcon } from '../../components/icons/BrandIcons';

// ⚠️ THE FIXTURE IS THE WHOLE TEST for hide-when-blank. One URL blank and the
// others filled is what tells a real filter from no filter at all — a fixture
// with everything populated passes either way, which is the documented "a
// positive assertion passes under a filter that matches everything" trap.
const ABOUT = Object.freeze({
  email: 'pcgallege@gmail.com',
  social: Object.freeze({
    github:    'https://github.com/Chami-02',
    linkedin:  'https://linkedin.com/in/x',
    facebook:  '',                                 // ← blank on purpose
    instagram: 'https://instagram.com/x',
    twitter:   '',                                 // ← blank on purpose
  }),
});

const keys = (about) => socialEntries(about).map((e) => e.key);

describe('socialEntries — which rows exist', () => {
  it('drops every blank URL and keeps every filled one', () => {
    expect(keys(ABOUT)).toEqual(['github', 'linkedin', 'instagram', 'email']);
  });

  it('includes a platform the moment its URL is filled in', () => {
    const withTwitter = { ...ABOUT, social: { ...ABOUT.social, twitter: 'https://x.com/x' } };
    expect(keys(withTwitter)).toContain('twitter');
  });

  // ⚠️ A URL of only whitespace is blank. Without the trim it would pass the
  // truthiness check and render an anchor whose href goes nowhere — the exact
  // dead link the rule exists to prevent.
  it('treats a whitespace-only URL as blank', () => {
    const spaced = { ...ABOUT, social: { ...ABOUT.social, facebook: '   ' } };
    expect(keys(spaced)).not.toContain('facebook');
  });

  it('returns nothing at all for a missing document', () => {
    expect(socialEntries(undefined)).toEqual([]);
    expect(socialEntries({})).toEqual([]);
  });

  it('omits email when there is none rather than linking mailto: to nothing', () => {
    expect(keys({ ...ABOUT, email: '' })).not.toContain('email');
  });
});

describe('socialEntries — order', () => {
  // The Footer's original hardcoded order, preserved so this change moves no row
  // a visitor already knew the position of.
  it('keeps the prototype order and puts email last', () => {
    const all = {
      email: 'a@b.co',
      social: {
        github: 'https://g', linkedin: 'https://l', facebook: 'https://f',
        instagram: 'https://i', twitter: 'https://t',
      },
    };
    expect(keys(all)).toEqual([
      'github', 'linkedin', 'facebook', 'instagram', 'twitter', 'email',
    ]);
  });

  it('puts custom links after the fixed ones and before email', () => {
    const withExtra = {
      ...ABOUT,
      socialExtra: [{ label: 'YouTube', url: 'https://youtube.com/@x' }],
    };
    expect(keys(withExtra)).toEqual([
      'github', 'linkedin', 'instagram', 'extra:YouTube', 'email',
    ]);
  });

  // ⚠️ Sorting them would silently reorder the footer on every save.
  it('keeps custom links in the order they were added', () => {
    const withExtra = {
      ...ABOUT,
      socialExtra: [
        { label: 'Zeta',  url: 'https://z.example' },
        { label: 'Alpha', url: 'https://a.example' },
      ],
    };
    expect(socialEntries(withExtra).filter((e) => e.key.startsWith('extra:'))
      .map((e) => e.label)).toEqual(['Zeta', 'Alpha']);
  });
});

describe('socialEntries — the rendered shape', () => {
  it('marks outbound links external and mailto: not', () => {
    const entries = socialEntries(ABOUT);
    expect(entries.find((e) => e.key === 'github').external).toBe(true);
    expect(entries.find((e) => e.key === 'email').external).toBe(false);
  });

  it('builds the mailto: from the one top-level address', () => {
    expect(socialEntries(ABOUT).find((e) => e.key === 'email').href)
      .toBe('mailto:pcgallege@gmail.com');
  });

  // The Footer wants "GitHub ↗" and Contact wants "GITHUB", so the suffix is the
  // caller's business — baking either in would force the other to strip it.
  it('carries a bare label with no arrow or casing baked in', () => {
    expect(socialEntries(ABOUT).find((e) => e.key === 'github').label).toBe('GitHub');
  });

  it('trims the stored URL', () => {
    const padded = { ...ABOUT, social: { ...ABOUT.social, github: '  https://g.example  ' } };
    expect(socialEntries(padded).find((e) => e.key === 'github').href).toBe('https://g.example');
  });

  it('ignores a socialExtra that is not a list', () => {
    expect(() => socialEntries({ ...ABOUT, socialExtra: 'nope' })).not.toThrow();
    expect(keys({ ...ABOUT, socialExtra: 'nope' })).toEqual(keys(ABOUT));
  });

  it('drops a custom row missing either half', () => {
    const half = {
      ...ABOUT,
      socialExtra: [{ label: 'YouTube', url: '' }, { label: '', url: 'https://x' }],
    };
    expect(keys(half).filter((k) => k.startsWith('extra:'))).toEqual([]);
  });
});

describe('iconFor', () => {
  it('gives each fixed platform its own mark', () => {
    expect(iconFor('twitter')).toBe(TwitterIcon);
    expect(iconFor('github')).toBe(SOCIAL_ICONS.github);
  });

  // ⚠️ FALLS BACK rather than returning undefined. React does not reliably throw
  // for `<undefined />` — for some shapes it renders nothing — so an unmapped key
  // would produce a label with no glyph and no error.
  it('falls back to the generic link mark for a custom row', () => {
    expect(iconFor('extra:YouTube')).toBe(LinkIcon);
    expect(iconFor('nonsense')).toBe(LinkIcon);
    expect(iconFor(undefined)).toBe(LinkIcon);
  });

  // ⚠️ The namespacing is what stops a custom link NAMED "github" stealing the
  // GitHub mark. The key it gets is `extra:github`, which this map never matches.
  it('does not let a custom row named after a platform take its brand mark', () => {
    const entries = socialEntries({
      email: '', social: {}, socialExtra: [{ label: 'github', url: 'https://fake' }],
    });
    expect(entries[0].key).toBe('extra:github');
    expect(iconFor(entries[0].key)).toBe(LinkIcon);
  });
});
