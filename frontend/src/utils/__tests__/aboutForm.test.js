// frontend/src/utils/__tests__/aboutForm.test.js
//
// PF-112 — the About panel's form shape.
import { describe, it, expect } from 'vitest';
import {
  BASIC_FIELDS, SOCIAL_FIELDS,
  emptyAboutForm, aboutToForm, formToPayload, isAboutDirty, aboutFormErrors,
} from '../aboutForm';

// ⚠️ FROZEN. A shared mutable fixture is what once disarmed a "does not mutate"
// guard in this repo — an earlier test in the file had already sorted the array,
// so the mutant had nothing left to break. Freezing makes any write throw here
// instead of silently passing.
const ABOUT = Object.freeze({
  // ⚠️ `name` and `title` stay in the FIXTURE on purpose, though the form no
  // longer offers them: the API still returns them, so this is what proves
  // aboutToForm ignores rather than merely omits them.
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
  // ⚠️ THREE basic fields since PF-112, not five. `name` and `title` were
  // removed because editing them changed nothing: both are hardcoded literals on
  // the public site (hero heading, footer, splash). The owner's rule is that
  // location, email and the availability note change with a career and a name
  // does not.
  it('offers three basic fields and five social fields', () => {
    expect(BASIC_FIELDS).toHaveLength(3);
    expect(SOCIAL_FIELDS).toHaveLength(5);
  });

  it('no longer offers name or title', () => {
    const names = BASIC_FIELDS.map((f) => f.name);
    expect(names).not.toContain('name');
    expect(names).not.toContain('title');
    expect(names).toEqual(['location', 'email', 'availabilityNote']);
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

    expect(form.location).toBe('Galle, Sri Lanka');
    expect(form.email).toBe('pcgallege@gmail.com');
    expect(form.availabilityNote).toBe('Open to junior roles');
    expect(form.bio).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  // ⚠️ The form must not CARRY them either. `updateAbout` does `$set: safe`, so a
  // key that reaches the payload is written — a `name: ''` slipping through would
  // blank a required field that the hero still renders from a literal.
  it('carries no name or title into the form or the payload', () => {
    const form = aboutToForm(ABOUT);

    expect(form).not.toHaveProperty('name');
    expect(form).not.toHaveProperty('title');
    expect(formToPayload(form)).not.toHaveProperty('name');
    expect(formToPayload(form)).not.toHaveProperty('title');
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
    const payload = formToPayload({
      ...aboutToForm(ABOUT), location: '  Spaced  ', email: ' a@b.co ',
    });

    expect(payload.location).toBe('Spaced');
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

describe('socialExtra — the custom links', () => {
  const WITH_EXTRA = Object.freeze({
    ...ABOUT,
    socialExtra: Object.freeze([
      Object.freeze({ label: 'YouTube', url: 'https://youtube.com/@x' }),
    ]),
  });

  it('defaults to an empty list', () => {
    expect(aboutToForm(ABOUT).socialExtra).toEqual([]);
    expect(emptyAboutForm().socialExtra).toEqual([]);
  });

  it('round-trips a row through the payload', () => {
    const form = aboutToForm(WITH_EXTRA);

    expect(form.socialExtra).toEqual([{ label: 'YouTube', url: 'https://youtube.com/@x' }]);
    expect(formToPayload(form).socialExtra)
      .toEqual([{ label: 'YouTube', url: 'https://youtube.com/@x' }]);
  });

  // ⚠️ COPIED, not aliased. Without the inner spread the form's rows would BE the
  // objects the query cache holds, so typing in one would mutate cached data in
  // place — and REVERT, which re-derives from that same cache, would then
  // "restore" the edit it was asked to discard.
  it('copies each row rather than aliasing the cached document', () => {
    const form = aboutToForm(WITH_EXTRA);

    expect(form.socialExtra[0]).not.toBe(WITH_EXTRA.socialExtra[0]);
    expect(form.socialExtra).not.toBe(WITH_EXTRA.socialExtra);
  });

  // `+ ADD LINK` creates a blank row by design, so a half-filled row is the
  // normal in-progress state. Sending it would 400 the whole save on a schema
  // that requires both halves.
  it.each([
    ['both halves missing', { label: '', url: '' }],
    ['no URL',              { label: 'YouTube', url: '' }],
    ['no name',             { label: '', url: 'https://youtube.com/@x' }],
  ])('drops a row with %s', (_why, row) => {
    const form = { ...aboutToForm(ABOUT), socialExtra: [row] };
    expect(formToPayload(form).socialExtra).toEqual([]);
  });

  it('keeps the rows in the order they were added', () => {
    const form = {
      ...aboutToForm(ABOUT),
      socialExtra: [
        { label: 'Zeta', url: 'https://z.example' },
        { label: 'Alpha', url: 'https://a.example' },
      ],
    };
    expect(formToPayload(form).socialExtra.map((r) => r.label)).toEqual(['Zeta', 'Alpha']);
  });

  it('counts as an unsaved change', () => {
    const form = { ...aboutToForm(ABOUT), socialExtra: [{ label: 'X', url: 'https://x.example' }] };
    expect(isAboutDirty(form, ABOUT)).toBe(true);
  });

  /*
   * ⚠️ THIS TEST WAS REVERSED on 2026-09-25, and both halves are worth keeping.
   *
   * It used to read "is not dirty when a blank row is added, since it would not
   * be sent", and that was the honest consequence of comparing PAYLOADS: an
   * incomplete row is dropped by formToPayload, so a freshly-added one compared
   * equal to no row at all.
   *
   * The owner reported what that actually feels like — press `+ ADD LINK`, type
   * a name, press SAVE, nothing happens, and the row is gone on the next
   * render. SAVE was dim, so there was no way to be told why.
   *
   * The rule now: adding a row IS a change, so SAVE lights up and
   * `aboutFormErrors` can refuse it and point at the empty field. Dirtiness is
   * about CHANGE, never about VALIDITY.
   */
  it('IS dirty when a blank row is added — SAVE must be pressable to refuse it', () => {
    const form = { ...aboutToForm(ABOUT), socialExtra: [{ label: '', url: '' }] };
    expect(isAboutDirty(form, ABOUT)).toBe(true);
  });

  it('is dirty for a half-filled row too', () => {
    const form = { ...aboutToForm(ABOUT), socialExtra: [{ label: 'YouTube', url: '' }] };
    expect(isAboutDirty(form, ABOUT)).toBe(true);
  });

  it('goes clean again when the unfinished row is removed', () => {
    // The × is the documented way out of a stray `+ ADD LINK`, so it has to
    // restore the form to untouched — otherwise the only escape is REVERT,
    // which throws away every other edit as well.
    const added   = { ...aboutToForm(ABOUT), socialExtra: [{ label: '', url: '' }] };
    const removed = { ...added, socialExtra: [] };
    expect(isAboutDirty(added, ABOUT)).toBe(true);
    expect(isAboutDirty(removed, ABOUT)).toBe(false);
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
    ['a basic field', { location: 'Colombo, Sri Lanka' }],
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

describe('stats — the About section\'s stat cards', () => {
  const WITH_STATS = Object.freeze({
    ...ABOUT,
    stats: Object.freeze([
      Object.freeze({ label: 'Projects Built', value: '5+' }),
      Object.freeze({ label: 'Learning',       value: 'Continuous' }),
    ]),
  });

  it('starts empty on a blank form', () => {
    expect(emptyAboutForm().stats).toEqual([]);
  });

  it('is a FACTORY, so one form\'s stats never reach another\'s', () => {
    // ⚠️ The same trap blogForm.js records. A shared constant hands every caller
    // the same array, so one panel pushing a row mutates the "empty" form every
    // later caller receives.
    const a = emptyAboutForm();
    a.stats.push({ label: 'Leaked', value: '1' });
    expect(emptyAboutForm().stats).toEqual([]);
  });

  it('reads the stored rows in order', () => {
    expect(aboutToForm(WITH_STATS).stats).toEqual([
      { label: 'Projects Built', value: '5+' },
      { label: 'Learning',       value: 'Continuous' },
    ]);
  });

  it('COPIES each row rather than aliasing the cache\'s objects', () => {
    // ⚠️ Without the inner spread these are the very objects TanStack Query
    // holds, so typing in a stat mutates cached data in place — and REVERT,
    // which re-derives the form from that same cache, "restores" the edit. The
    // frozen fixture is what makes this observable: an aliased row would throw
    // on write instead of quietly succeeding.
    const form = aboutToForm(WITH_STATS);
    form.stats[0].value = '99+';

    expect(WITH_STATS.stats[0].value).toBe('5+');
    expect(aboutToForm(WITH_STATS).stats[0].value).toBe('5+');
  });

  it('survives a document with no stats at all', () => {
    expect(aboutToForm(ABOUT).stats).toEqual([]);
  });

  it('trims both halves on the way out', () => {
    const form = { ...aboutToForm(ABOUT), stats: [{ label: '  Commits  ', value: ' 900+ ' }] };
    expect(formToPayload(form).stats).toEqual([{ label: 'Commits', value: '900+' }]);
  });

  it('DROPS a half-filled row instead of sending it', () => {
    // ⚠️ The sub-schema marks both `required`, so one half-filled row 400s the
    // ENTIRE save — losing every other edit on the form with it. `+ ADD STAT`
    // creates an empty row by design, so an unfinished one is the normal state.
    const form = {
      ...aboutToForm(ABOUT),
      stats: [
        { label: 'Good',  value: '1' },
        { label: 'Label only', value: '' },
        { label: '',      value: 'Value only' },
        { label: '',      value: '' },
      ],
    };
    expect(formToPayload(form).stats).toEqual([{ label: 'Good', value: '1' }]);
  });

  it('sends [] for a list the owner has emptied, never omitting the key', () => {
    // ⚠️ `updateAbout` does `$set: safe`, which writes only the keys it is
    // given. Omitting `stats` would leave the old rows in the database while
    // the panel showed none — the save would look like it worked.
    const payload = formToPayload({ ...aboutToForm(WITH_STATS), stats: [] });
    expect(payload.stats).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(payload, 'stats')).toBe(true);
  });

  it('marks the form dirty when a stat is edited, added or removed', () => {
    const clean = aboutToForm(WITH_STATS);
    expect(isAboutDirty(clean, WITH_STATS)).toBe(false);

    expect(isAboutDirty(
      { ...clean, stats: [{ label: 'Projects Built', value: '6+' }, clean.stats[1]] },
      WITH_STATS,
    )).toBe(true);

    expect(isAboutDirty(
      { ...clean, stats: [...clean.stats, { label: 'New', value: '1' }] },
      WITH_STATS,
    )).toBe(true);

    expect(isAboutDirty({ ...clean, stats: [clean.stats[0]] }, WITH_STATS)).toBe(true);
  });

  /*
   * ⚠️ REVERSED on 2026-09-25 — see the matching note under socialExtra.
   * This used to assert the opposite, on the reasoning that a row the payload
   * drops should not move the dirty flag. That reasoning is sound and the
   * conclusion was still wrong: it left SAVE dim, which is precisely what made
   * the owner's incomplete stat unreportable AND unsaveable with no
   * explanation. An invalid form must be dirty so that SAVE can refuse it.
   */
  it('IS dirty for a blank stat row — SAVE must be pressable to refuse it', () => {
    const clean = aboutToForm(WITH_STATS);
    const withBlank = { ...clean, stats: [...clean.stats, { label: '', value: '' }] };
    expect(isAboutDirty(withBlank, WITH_STATS)).toBe(true);
  });

  it('is dirty for a half-filled stat row — the owner\'s reported case', () => {
    const clean = aboutToForm(WITH_STATS);
    const half  = { ...clean, stats: [...clean.stats, { label: 'Commits', value: '' }] };
    expect(isAboutDirty(half, WITH_STATS)).toBe(true);
  });

  it('reorders as a change', () => {
    const clean = aboutToForm(WITH_STATS);
    const swapped = { ...clean, stats: [clean.stats[1], clean.stats[0]] };
    expect(isAboutDirty(swapped, WITH_STATS)).toBe(true);
  });
});

describe('aboutFormErrors — what refuses the save', () => {
  const clean = () => aboutToForm(ABOUT);
  const fields = (form) => aboutFormErrors(form).map((e) => e.field);

  it('passes a clean form', () => {
    expect(aboutFormErrors(clean())).toEqual([]);
  });

  /*
   * ⚠️ THE TWO HALVES OF THE SOCIAL RULE, PINNED TOGETHER IN ONE DESCRIBE.
   *
   * They sit side by side in the same card and look identical — an empty text
   * input — and they are opposite cases. Owner, 2026-09-25: "there is a twitter
   * Url and its empty its ok… but when i add a link tab pressing + icon in that
   * tab it should be fill before saving."
   *
   * Testing only the error half would pass against an implementation that also
   * refuses a blank Twitter — and THAT implementation makes `socialEntries()`'s
   * "an empty URL renders nothing" rule unreachable from the panel, because
   * clearing a URL would no longer be savable. The exemption needs a guard of
   * its own or it is one tidy-up away from disappearing.
   */
  describe('the five FIXED social fields', () => {
    it('allows every one of them to be empty', () => {
      const form = { ...clean(), social: {
        github: '', linkedin: '', facebook: '', instagram: '', twitter: '',
      } };
      expect(aboutFormErrors(form)).toEqual([]);
    });

    it('allows the empty twitter field the site actually ships with', () => {
      expect(aboutFormErrors(clean())).toEqual([]);
      expect(clean().social.twitter).toBe('');
    });

    it('refuses one that is filled in but not a URL', () => {
      const form = { ...clean(), social: { ...clean().social, github: 'github.com/me' } };
      expect(fields(form)).toEqual(['social.github']);
      expect(aboutFormErrors(form)[0].message).toMatch(/starting with https/i);
    });
  });

  describe('a custom link row — the OPPOSITE rule', () => {
    it('refuses a completely blank row, naming its NAME field', () => {
      // Named against the first input in the row, because the guard focuses
      // whatever the first error points at and that should be where you type.
      const form = { ...clean(), socialExtra: [{ label: '', url: '' }] };
      expect(fields(form)).toEqual(['socialExtra.0.label']);
      expect(aboutFormErrors(form)[0].message).toMatch(/remove the row/i);
    });

    it('refuses a name with no URL', () => {
      const form = { ...clean(), socialExtra: [{ label: 'YouTube', url: '' }] };
      expect(fields(form)).toEqual(['socialExtra.0.url']);
    });

    it('refuses a URL with no name', () => {
      const form = { ...clean(), socialExtra: [{ label: '', url: 'https://youtube.com/@x' }] };
      expect(fields(form)).toEqual(['socialExtra.0.label']);
    });

    it('refuses a malformed URL', () => {
      const form = { ...clean(), socialExtra: [{ label: 'YouTube', url: 'youtube.com' }] };
      expect(fields(form)).toEqual(['socialExtra.0.url']);
    });

    it('refuses a name over the model\'s 40 characters, and says the number', () => {
      const form = { ...clean(), socialExtra: [{ label: 'x'.repeat(41), url: 'https://x.example' }] };
      expect(fields(form)).toEqual(['socialExtra.0.label']);
      expect(aboutFormErrors(form)[0].message).toContain('40');
    });

    it('accepts exactly 40 characters — the boundary, not one inside it', () => {
      const form = { ...clean(), socialExtra: [{ label: 'x'.repeat(40), url: 'https://x.example' }] };
      expect(aboutFormErrors(form)).toEqual([]);
    });

    it('reports each bad row against its OWN index', () => {
      const form = { ...clean(), socialExtra: [
        { label: 'Good',  url: 'https://good.example' },
        { label: 'Bad',   url: '' },
        { label: '',      url: 'https://also.example' },
      ] };
      expect(fields(form)).toEqual(['socialExtra.1.url', 'socialExtra.2.label']);
    });
  });

  describe('a stat row — the owner\'s original example', () => {
    it('refuses a label with no value', () => {
      const form = { ...clean(), stats: [{ label: 'Commits', value: '' }] };
      expect(fields(form)).toEqual(['stats.0.value']);
      expect(aboutFormErrors(form)[0].message).toBe('Add a value to save this stat.');
    });

    it('refuses a value with no label', () => {
      const form = { ...clean(), stats: [{ label: '', value: '900+' }] };
      expect(fields(form)).toEqual(['stats.0.label']);
    });

    it('refuses a completely blank row', () => {
      const form = { ...clean(), stats: [{ label: '', value: '' }] };
      expect(fields(form)).toEqual(['stats.0.label']);
    });

    it('accepts a word value — not every stat counts', () => {
      const form = { ...clean(), stats: [{ label: 'Learning', value: 'Continuous' }] };
      expect(aboutFormErrors(form)).toEqual([]);
    });

    it('accepts NO stats at all — the site falls back', () => {
      expect(aboutFormErrors({ ...clean(), stats: [] })).toEqual([]);
    });
  });

  describe('the contact email', () => {
    it('refuses a malformed address', () => {
      expect(fields({ ...clean(), email: 'pcgallege@' })).toEqual(['email']);
    });

    it('ALLOWS a blank one — the public site falls back to its literal', () => {
      expect(aboutFormErrors({ ...clean(), email: '' })).toEqual([]);
    });
  });

  it('reports EVERY problem at once, not just the first', () => {
    // The banner counts them and each field is marked, so stopping at the
    // first would mean fixing one error and being shown the next — four
    // round trips for one form.
    const form = {
      ...clean(),
      email: 'nope@',
      social: { ...clean().social, github: 'github.com/me' },
      stats: [{ label: 'Commits', value: '' }],
      socialExtra: [{ label: '', url: '' }],
    };
    expect(aboutFormErrors(form)).toHaveLength(4);
  });

  it('ignores whitespace-only input exactly as the payload does', () => {
    const form = { ...clean(), stats: [{ label: '   ', value: '  ' }] };
    expect(fields(form)).toEqual(['stats.0.label']);
  });
});
