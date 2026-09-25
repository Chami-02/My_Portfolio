// frontend/src/utils/__tests__/aboutForm.test.js
//
// PF-112 — the About panel's form shape.
import { describe, it, expect } from 'vitest';
import {
  BASIC_FIELDS, SOCIAL_FIELDS,
  emptyAboutForm, aboutToForm, formToPayload, isAboutDirty,
} from '../aboutForm';

// ⚠️ FROZEN. A shared mutable fixture is what once disarmed a "does not mutate"
// guard in this repo — an earlier test in the file had already sorted the array,
// so the mutant had nothing left to break. Freezing makes any write throw here
// instead of silently passing.
const ABOUT = Object.freeze({
  name: 'Parindra Gallage',
  title: 'Full-Stack Developer',
  location: 'Galle, Sri Lanka',
  email: 'pcgallege@gmail.com',
  availabilityNote: 'Open to junior roles',
  availableForWork: true,
  bio: Object.freeze(['First paragraph.', 'Second paragraph.']),
  social: Object.freeze({ github: 'https://github.com/Chami-02', linkedin: 'https://linkedin.com/in/x' }),
});

describe('the field tables', () => {
  it('offers five basic fields and five social fields', () => {
    expect(BASIC_FIELDS).toHaveLength(5);
    expect(SOCIAL_FIELDS).toHaveLength(5);
  });

  // ⚠️ The prototype's `socials` array and DESIGN.md §6.3 both list a sixth
  // social entry for Email. About.social has no `email` key by a documented
  // model decision, and the contact address is a BASIC field — so a social
  // email input would be a second control writing one value.
  it('keeps email out of the social fields and in the basic ones', () => {
    expect(SOCIAL_FIELDS.map((f) => f.name)).not.toContain('email');
    expect(BASIC_FIELDS.map((f) => f.name)).toContain('email');
  });
});

describe('emptyAboutForm', () => {
  // ⚠️ THE FACTORY TEST. As a shared constant, every caller would receive the
  // same `bio` array, so one panel pushing a paragraph would mutate the "empty"
  // form handed to the next. Identity, not equality, is what catches that.
  it('hands out a fresh bio array each call', () => {
    const a = emptyAboutForm();
    const b = emptyAboutForm();

    expect(a.bio).toEqual(b.bio);
    expect(a.bio).not.toBe(b.bio);
    expect(a.social).not.toBe(b.social);

    a.bio.push('leaked');
    expect(emptyAboutForm().bio).toHaveLength(2);
  });

  it('defaults to available', () => {
    expect(emptyAboutForm().availableForWork).toBe(true);
  });
});

describe('aboutToForm', () => {
  it('returns a blank form when there is no document yet', () => {
    expect(aboutToForm(undefined)).toEqual(emptyAboutForm());
  });

  it('fills every basic field and the bio', () => {
    const form = aboutToForm(ABOUT);

    expect(form.name).toBe('Parindra Gallage');
    expect(form.availabilityNote).toBe('Open to junior roles');
    expect(form.bio).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it('copies the bio rather than aliasing the document', () => {
    const form = aboutToForm(ABOUT);
    expect(form.bio).not.toBe(ABOUT.bio);
  });

  // ⚠️ The scar this carries: listing the five social keys and stopping there
  // once dropped facebook and instagram from the form — and because the form is
  // what gets submitted, the next save overwrote them with empty strings.
  it('keeps a social key the form does not render', () => {
    const form = aboutToForm({ ...ABOUT, social: { ...ABOUT.social, mastodon: 'https://m.social/@x' } });

    expect(form.social.mastodon).toBe('https://m.social/@x');
    expect(formToPayload(form).social.mastodon).toBe('https://m.social/@x');
  });

  it('fills absent social keys with empty strings', () => {
    expect(aboutToForm(ABOUT).social.twitter).toBe('');
  });

  // ⚠️ `?? true`, never `|| true`. With `||` a stored `false` reads back as
  // `true` and the very next save silently re-publishes the owner as available.
  it('preserves availableForWork: false', () => {
    expect(aboutToForm({ ...ABOUT, availableForWork: false }).availableForWork).toBe(false);
  });

  it('defaults availableForWork to true when the field is missing', () => {
    expect(aboutToForm({ name: 'x' }).availableForWork).toBe(true);
  });
});

describe('formToPayload', () => {
  it('trims every text field', () => {
    const payload = formToPayload({ ...aboutToForm(ABOUT), name: '  Spaced  ', email: ' a@b.co ' });

    expect(payload.name).toBe('Spaced');
    expect(payload.email).toBe('a@b.co');
  });

  it('drops blank paragraphs rather than storing empty ones', () => {
    const payload = formToPayload({ ...aboutToForm(ABOUT), bio: ['Kept.', '   ', ''] });

    expect(payload.bio).toEqual(['Kept.']);
  });

  it('sends availableForWork as a real boolean', () => {
    expect(formToPayload({ ...aboutToForm(ABOUT), availableForWork: false }).availableForWork).toBe(false);
    expect(formToPayload({ ...aboutToForm(ABOUT), availableForWork: true }).availableForWork).toBe(true);
  });

  it('carries no avatar or resume key', () => {
    const payload = formToPayload(aboutToForm(ABOUT));

    expect(payload).not.toHaveProperty('avatar');
    expect(payload).not.toHaveProperty('resume');
  });
});

describe('isAboutDirty', () => {
  it('is false for an untouched form', () => {
    expect(isAboutDirty(aboutToForm(ABOUT), ABOUT)).toBe(false);
  });

  it('ignores whitespace that trims away', () => {
    expect(isAboutDirty({ ...aboutToForm(ABOUT), name: 'Parindra Gallage  ' }, ABOUT)).toBe(false);
  });

  it.each([
    ['a basic field', { name: 'Someone Else' }],
    ['a bio paragraph', { bio: ['Only one.'] }],
    ['a social URL', { social: { ...ABOUT.social, twitter: 'https://x.com/a' } }],
  ])('is true after editing %s', (_what, patch) => {
    expect(isAboutDirty({ ...aboutToForm(ABOUT), ...patch }, ABOUT)).toBe(true);
  });

  // The availability toggle is staged like everything else now, so flipping it
  // has to register as an unsaved change or the marker would not appear for it.
  it('is true after toggling availability', () => {
    expect(isAboutDirty({ ...aboutToForm(ABOUT), availableForWork: false }, ABOUT)).toBe(true);
  });
});
