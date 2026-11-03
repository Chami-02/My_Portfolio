import { describe, it, expect } from 'vitest';
import {
  emptyProjectForm, projectToForm, formToPayload, projectFormErrors,
  isProjectDirty, starterSections,
} from '../projectForm';

const SECTIONS = Object.freeze([
  Object.freeze({ heading: 'Description', body: Object.freeze(['Car marketplace.']), bullets: Object.freeze([]) }),
]);

const SAVED = Object.freeze({
  _id: 'p1', title: 'ClearDrive', description: 'Car marketplace.',
  tech: ['React', 'Docker'], githubUrl: 'https://github.com/a/b', liveUrl: null,
  order: 1, featured: true, published: true, slug: 'cleardrive',
  categories: ['Web App'], role: 'Team lead', client: 'ClearDrive.lk',
  startedOn: '2024-02', endedOn: '', ongoing: true,
  sections: SECTIONS,
  backgroundImage: { src: 'https://res.cloudinary.com/x.webp', publicId: 'p/x', opacity: 0.4 },
});

const fields = (errors) => errors.map((e) => e.field);

describe('emptyProjectForm', () => {
  it('is a FACTORY — two forms never share an object', () => {
    const a = emptyProjectForm();
    a.title = 'mutated';
    a.sections[0].body.push('leak');
    expect(emptyProjectForm().title).toBe('');
    expect(emptyProjectForm().sections[0].body).toEqual(['']);
  });

  it('a new project defaults to published, with the three starter sections', () => {
    expect(emptyProjectForm()).toMatchObject({ published: true, order: '0', ongoing: false, category: '' });
    expect(emptyProjectForm().sections.map((s) => s.heading))
      .toEqual(['Description', 'Key Features', 'Outcome & Impact']);
  });

  it('has no opacity any more (PF-144: the picture is not behind the text)', () => {
    expect(emptyProjectForm()).not.toHaveProperty('opacity');
  });
});

describe('projectToForm', () => {
  it('maps the API shape', () => {
    expect(projectToForm(SAVED)).toEqual({
      title: 'ClearDrive', description: 'Car marketplace.', tech: 'React, Docker',
      githubUrl: 'https://github.com/a/b', liveUrl: '', order: '1',
      featured: true, published: true,
      category: 'Web App', role: 'Team lead', client: 'ClearDrive.lk',
      startedOn: '2024-02', endedOn: '', ongoing: true,
      sections: [{ heading: 'Description', body: ['Car marketplace.'], bullets: [], images: [] }],
    });
  });

  it('copies the sections into NEW arrays (an edit never mutates the query cache)', () => {
    const form = projectToForm(SAVED);
    expect(form.sections[0].body).not.toBe(SAVED.sections[0].body);
  });

  // Only possible before migration 013 — opening and saving it must not be an edit.
  it('a stored project with no sections opens with none, not the starter set', () => {
    expect(projectToForm({ ...SAVED, sections: [] }).sections).toEqual([]);
  });

  // ⚠️ A pre-PF-113 project has no field and IS public — the server's `$ne: false`.
  it('reads a missing `published` as published', () => {
    const legacy = { ...SAVED };
    delete legacy.published;
    expect(projectToForm(legacy).published).toBe(true);
  });

  it('reads a draft as a draft', () => {
    expect(projectToForm({ ...SAVED, published: false }).published).toBe(false);
  });
});

describe('formToPayload', () => {
  it('sends the button pressed as `published`, not the stored state', () => {
    const form = projectToForm(SAVED);
    expect(formToPayload(form, { publish: false }).published).toBe(false);
    expect(formToPayload({ ...form, published: false }, { publish: true }).published).toBe(true);
  });

  // ⚠️ The picture travels on the upload route only (PF-111), and nothing
  // about it is edited here since PF-144.
  it('sends no backgroundImage at all', () => {
    expect(formToPayload(projectToForm(SAVED), { publish: true })).not.toHaveProperty('backgroundImage');
  });

  it('splits tech, trims, nulls a blank live URL and numbers the order', () => {
    const p = formToPayload({ ...emptyProjectForm(), title: ' X ', tech: ' React,, Node ', order: '3' },
      { publish: false });
    expect(p).toMatchObject({ title: 'X', tech: ['React', 'Node'], liveUrl: null, order: 3 });
  });

  it('sends the category as a one-value list, and none as an empty list', () => {
    expect(formToPayload(projectToForm(SAVED), { publish: true }).categories).toEqual(['Web App']);
    expect(formToPayload({ ...projectToForm(SAVED), category: '' }, { publish: true }).categories).toEqual([]);
  });

  // The model refuses an end date on an ongoing project.
  it('an ongoing project sends no end date, whatever the box held', () => {
    const p = formToPayload({ ...projectToForm(SAVED), endedOn: '2025-01', ongoing: true }, { publish: true });
    expect(p).toMatchObject({ ongoing: true, endedOn: '' });
  });

  it('drops blank lines and wholly empty sections, keeps a heading-only one', () => {
    const p = formToPayload({
      ...projectToForm(SAVED),
      sections: [
        { heading: ' Features ', body: ['  '], bullets: [' Fast ', ''] },
        { heading: '', body: [''], bullets: [] },
        { heading: 'Outcome', body: [''], bullets: [] },
      ],
    }, { publish: true });
    expect(p.sections).toEqual([
      { heading: 'Features', body: [], bullets: ['Fast'], images: [] },
      { heading: 'Outcome', body: [], bullets: [], images: [] },
    ]);
  });
});

describe('projectFormErrors', () => {
  const complete = { ...projectToForm(SAVED) };

  it('a complete form has no errors', () => {
    expect(projectFormErrors(complete)).toEqual([]);
  });

  it('PUBLISH requires title, summary, a page, a tech and GitHub URL — in screen order', () => {
    const errors = projectFormErrors({ ...emptyProjectForm(), sections: [], published: true });
    expect(fields(errors)).toEqual(['title', 'description', 'sections', 'tech', 'githubUrl']);
  });

  // Owner, 2026-10-31: a skipped required box says exactly this.
  it('a skipped required box says "This field is required."', () => {
    const errors = projectFormErrors({ ...emptyProjectForm(), published: true });
    expect(errors.find((e) => e.field === 'title').message).toBe('This field is required.');
    expect(errors.find((e) => e.field === 'githubUrl').message).toBe('This field is required.');
  });

  // The starter set: headings with no text are reported on publish, per section.
  it('PUBLISH with the untouched starter sections marks each heading that has no text', () => {
    const errors = projectFormErrors({ ...complete, sections: starterSections() });
    expect(fields(errors)).toEqual(['sections.0.heading', 'sections.1.heading', 'sections.2.heading']);
  });

  it('PUBLISH refuses a section with text but no heading', () => {
    const errors = projectFormErrors({ ...complete, sections: [{ heading: '', body: ['Text'], bullets: [] }] });
    expect(errors).toEqual([{ field: 'sections.0.heading', message: 'Section 01 needs a heading.' }]);
  });

  // The owner's rule: a draft needs ONLY a title.
  it('a DRAFT with only a title is clean — the starter sections too', () => {
    expect(projectFormErrors({ ...emptyProjectForm(), title: 'Half', published: false })).toEqual([]);
  });

  it('a DRAFT still needs a title', () => {
    expect(fields(projectFormErrors({ ...emptyProjectForm(), published: false }))).toEqual(['title']);
  });

  it('a DRAFT still refuses a bad URL that IS filled in', () => {
    expect(fields(projectFormErrors({ ...emptyProjectForm(), title: 'H', published: false,
      githubUrl: 'javascript:alert(1)', liveUrl: 'github.com/x' })))
      .toEqual(['githubUrl', 'liveUrl']);
  });

  it('refuses a non-numeric order and the maxlengths', () => {
    expect(fields(projectFormErrors({ ...complete, order: 'first', title: 'x'.repeat(101),
      description: 'y'.repeat(501), role: 'r'.repeat(81), client: 'c'.repeat(81) })))
      .toEqual(['title', 'description', 'role', 'client', 'order']);
  });

  it('accepts a blank order (the server defaults it to 0)', () => {
    expect(projectFormErrors({ ...complete, order: '' })).toEqual([]);
  });

  it('refuses two categories', () => {
    expect(fields(projectFormErrors({ ...complete, category: 'Web App, API' }))).toEqual(['category']);
  });

  it.each([
    ['a typed month that is not one', { startedOn: '2024-jux' }, 'startedOn'],
    ['an end before the start', { startedOn: '2025-06', endedOn: '2025-01', ongoing: false }, 'endedOn'],
    ['a bad end date', { endedOn: '20', ongoing: false }, 'endedOn'],
  ])('refuses %s', (_name, over, field) => {
    expect(fields(projectFormErrors({ ...complete, ...over }))).toEqual([field]);
  });

  it('ignores the end box while Ongoing is ticked', () => {
    expect(projectFormErrors({ ...complete, ongoing: true, endedOn: 'garbage' })).toEqual([]);
  });
});

// ── PF-144 part 2 — pictures inside a section ──────────────────────────────
describe('section pictures', () => {
  const SAVED_PIC = Object.freeze({ publicId: 'p/a', url: 'https://res.cloudinary.com/x/a.png', width: 1920, height: 1080, caption: 'Dash' });
  const STAGED = () => ({ file: new File(['x'], 'a.png', { type: 'image/png' }), previewUrl: 'blob:a', caption: '' });
  const withPics = (images) => ({
    ...projectToForm(SAVED), sections: [{ heading: 'Screens', body: [], bullets: [], images }],
  });

  it('a stored picture comes into the form as a copy', () => {
    const stored = { ...SAVED, sections: [{ heading: 'S', body: [], bullets: [], images: [SAVED_PIC] }] };
    const form = projectToForm(stored);
    expect(form.sections[0].images).toEqual([SAVED_PIC]);
    expect(form.sections[0].images[0]).not.toBe(SAVED_PIC);
  });

  it('the payload sends ONLY { publicId, caption } — never a url, never a staged file', () => {
    const p = formToPayload(withPics([{ ...SAVED_PIC, caption: ' Dash ' }, STAGED()]), { publish: true });
    expect(p.sections[0].images).toEqual([{ publicId: 'p/a', caption: 'Dash' }]);
  });

  it('a heading + pictures section is kept, and publishes', () => {
    const form = withPics([SAVED_PIC]);
    expect(formToPayload(form, { publish: true }).sections).toHaveLength(1);
    expect(projectFormErrors(form)).toEqual([]);
  });

  it('a staged picture makes the form dirty, even though the payload cannot show it', () => {
    const stored = { ...SAVED, sections: [{ heading: 'Screens', body: [], bullets: [], images: [] }] };
    const form = projectToForm(stored);
    expect(isProjectDirty(form, stored)).toBe(false);
    form.sections[0].images.push(STAGED());
    expect(isProjectDirty(form, stored)).toBe(true);
  });

  it('more than 4 in a section, or a caption over 120, is refused — on a draft too', () => {
    const five = Array.from({ length: 5 }, () => STAGED());
    expect(projectFormErrors({ ...withPics(five), published: false }))
      .toEqual([{ field: 'sections.0.images', message: 'Section 01 can show at most 4 pictures.' }]);
    expect(fields(projectFormErrors({ ...withPics([{ ...SAVED_PIC, caption: 'x'.repeat(121) }]), published: false })))
      .toEqual(['sections.0.images']);
  });
});

describe('isProjectDirty', () => {
  it('a freshly loaded project is clean', () => {
    expect(isProjectDirty(projectToForm(SAVED), SAVED)).toBe(false);
  });

  it('an untouched new form is clean', () => {
    expect(isProjectDirty(emptyProjectForm(), null)).toBe(false);
  });

  it('whitespace typed and deleted is not an edit', () => {
    expect(isProjectDirty({ ...projectToForm(SAVED), title: 'ClearDrive  ' }, SAVED)).toBe(false);
  });

  it.each([
    ['title', 'Other'], ['tech', 'React'], ['featured', false], ['liveUrl', 'https://x.io'],
    ['category', 'API'], ['role', 'Solo'], ['client', 'Me'], ['startedOn', '2023'], ['ongoing', false],
    ['sections', [{ heading: 'New', body: ['x'], bullets: [] }]],
  ])('a change to %s is dirty', (key, value) => {
    expect(isProjectDirty({ ...projectToForm(SAVED), [key]: value }, SAVED)).toBe(true);
  });

  // ⚠️ About CHANGE, never VALIDITY — SAVE must be pressable so the guard can refuse it.
  it('an invalid change is still dirty', () => {
    expect(isProjectDirty({ ...projectToForm(SAVED), githubUrl: '' }, SAVED)).toBe(true);
  });
});
