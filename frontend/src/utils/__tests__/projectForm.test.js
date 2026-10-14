import { describe, it, expect } from 'vitest';
import {
  emptyProjectForm, projectToForm, formToPayload, projectFormErrors,
  isProjectDirty, percentToOpacity, opacityToPercent,
} from '../projectForm';

const SAVED = Object.freeze({
  _id: 'p1', title: 'ClearDrive', description: 'Car marketplace.',
  tech: ['React', 'Docker'], githubUrl: 'https://github.com/a/b', liveUrl: null,
  order: 1, featured: true, published: true,
  backgroundImage: { src: 'https://res.cloudinary.com/x.webp', publicId: 'p/x', opacity: 0.4 },
});

const fields = (errors) => errors.map((e) => e.field);

describe('opacity ↔ slider', () => {
  it.each([[10, 0.1], [75, 0.75], [100, 1], [35, 0.35]])('%i%% → %f', (pct, op) => {
    expect(percentToOpacity(pct)).toBe(op);
  });

  // ⚠️ The schema is 0.1–1.0; outside it the WHOLE save 400s.
  it.each([[0, 0.1], [5, 0.1], [150, 1], [-20, 0.1]])('clamps %i to %f', (pct, op) => {
    expect(percentToOpacity(pct)).toBe(op);
  });

  it('falls back to the schema default on garbage', () => {
    expect(percentToOpacity('x')).toBe(0.75);
  });

  it.each([[0.4, 40], [0.75, 75], [0.33, 35], [0.05, 10], [2, 100], [undefined, 75]])(
    'stored %s → slider %i (snapped to the step of 5, clamped)', (op, pct) => {
      expect(opacityToPercent(op)).toBe(pct);
    });
});

describe('emptyProjectForm', () => {
  it('is a FACTORY — two forms never share an object', () => {
    const a = emptyProjectForm();
    a.title = 'mutated';
    expect(emptyProjectForm().title).toBe('');
  });

  it('a new project defaults to published at 75%', () => {
    expect(emptyProjectForm()).toMatchObject({ published: true, opacity: 75, order: '0' });
  });
});

describe('projectToForm', () => {
  it('maps the API shape', () => {
    expect(projectToForm(SAVED)).toEqual({
      title: 'ClearDrive', description: 'Car marketplace.', tech: 'React, Docker',
      githubUrl: 'https://github.com/a/b', liveUrl: '', order: '1',
      featured: true, published: true, opacity: 40,
    });
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

  // ⚠️ src/publicId travel on the upload route only (PF-111).
  it('sends ONLY opacity under backgroundImage', () => {
    expect(formToPayload(projectToForm(SAVED), { publish: true }).backgroundImage)
      .toEqual({ opacity: 0.4 });
  });

  it('splits tech, trims, nulls a blank live URL and numbers the order', () => {
    const p = formToPayload({ ...emptyProjectForm(), title: ' X ', tech: ' React,, Node ', order: '3' },
      { publish: false });
    expect(p).toMatchObject({ title: 'X', tech: ['React', 'Node'], liveUrl: null, order: 3 });
  });
});

describe('projectFormErrors', () => {
  const complete = { ...projectToForm(SAVED) };

  it('a complete form has no errors', () => {
    expect(projectFormErrors(complete)).toEqual([]);
  });

  it('PUBLISH requires title, GitHub URL, description and a tech — in screen order', () => {
    expect(fields(projectFormErrors({ ...emptyProjectForm(), published: true })))
      .toEqual(['title', 'githubUrl', 'description', 'tech']);
  });

  // The owner's rule: a draft needs ONLY a title.
  it('a DRAFT with only a title is clean', () => {
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
      description: 'y'.repeat(501) }))).toEqual(['title', 'order', 'description']);
  });

  it('accepts a blank order (the server defaults it to 0)', () => {
    expect(projectFormErrors({ ...complete, order: '' })).toEqual([]);
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
    ['title', 'Other'], ['tech', 'React'], ['featured', false], ['opacity', 80], ['liveUrl', 'https://x.io'],
  ])('a change to %s is dirty', (key, value) => {
    expect(isProjectDirty({ ...projectToForm(SAVED), [key]: value }, SAVED)).toBe(true);
  });

  // ⚠️ About CHANGE, never VALIDITY — SAVE must be pressable so the guard can refuse it.
  it('an invalid change is still dirty', () => {
    expect(isProjectDirty({ ...projectToForm(SAVED), githubUrl: '' }, SAVED)).toBe(true);
  });
});
