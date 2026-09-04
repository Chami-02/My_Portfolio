import { describe, it, expect } from 'vitest';
import { emptyForm, emptySection, postToForm, formToPayload, formErrors,
         tagList, hasTag, toggleTag, removeTag } from '../blogForm';

// A post shaped exactly as `GET /api/blog/admin/all` returns one: the
// aggregation excludes only `content`, so every server-owned field below is
// genuinely present in the payload the panel receives.
const API_POST = Object.freeze({
  _id:                '651f1a2b3c4d5e6f70819293',
  title:              'How I Built My MERN Portfolio',
  slug:               'how-i-built-my-mern-portfolio',
  excerpt:            'Eight sprints, forty-four tickets, and a pipeline that says no.',
  tags:               ['React', 'Node.js'],
  published:          true,
  readingTimeMinutes: 6,
  publishedAt:        '2026-07-14T00:00:00.000Z',
  createdAt:          '2026-08-30T10:00:00.000Z',
  updatedAt:          '2026-08-30T10:00:00.000Z',
  views:              42,
  sections: Object.freeze([
    Object.freeze({ heading: 'Introduction', body: Object.freeze(['A real paragraph.']), bullets: Object.freeze([]) }),
    Object.freeze({ heading: 'Planning',     body: Object.freeze([]), bullets: Object.freeze(['Jira', 'Branching']) }),
  ]),
});

describe('emptySection / emptyForm — factories, not shared constants', () => {

  // The bug this guards is silent and confusing on screen: with a shared
  // constant, typing into one section's paragraph appears in every section.
  it('gives each call its own arrays', () => {
    const a = emptySection();
    const b = emptySection();

    a.body.push('typed into A');

    expect(b.body).toEqual(['']);
    expect(a.body).not.toBe(b.body);
  });

  it('gives each form its own sections array', () => {
    const a = emptyForm();
    const b = emptyForm();

    a.sections.push(emptySection());

    expect(b.sections).toHaveLength(1);
  });

  it('starts a new section with one empty paragraph to type into', () => {
    expect(emptySection()).toEqual({ heading: '', body: [''], bullets: [] });
  });
});

describe('postToForm', () => {

  it('populates the editor from the post’s real sections', () => {
    const form = postToForm(API_POST);

    expect(form.sections).toHaveLength(2);
    expect(form.sections[0].heading).toBe('Introduction');
    expect(form.sections[0].body).toEqual(['A real paragraph.']);
    expect(form.sections[1].bullets).toEqual(['Jira', 'Branching']);
  });

  it('joins tags into the comma-separated field', () => {
    expect(postToForm(API_POST).tags).toBe('React, Node.js');
  });

  // The heart of PF-97's server-side half. Each of these is a server-owned
  // value that the old `setForm({ ...post })` PUT straight back.
  it.each(['_id', 'slug', 'views', 'createdAt', 'updatedAt', 'publishedAt', 'readingTimeMinutes', 'content'])(
    'does not carry %s into the form',
    (field) => {
      expect(postToForm(API_POST)).not.toHaveProperty(field);
    },
  );

  it('copies section arrays rather than aliasing the cached post', () => {
    const post = {
      title: 'T', excerpt: 'E', tags: [], published: false,
      sections: [{ heading: 'H', body: ['one'], bullets: [] }],
    };
    const form = postToForm(post);

    form.sections[0].body.push('two');

    // Aliasing here would mutate TanStack Query's cached object, so an
    // abandoned edit would still show up in the list behind the form.
    expect(post.sections[0].body).toEqual(['one']);
  });

  it('falls back to one blank section for a post with no sections', () => {
    expect(postToForm({ title: 'T', excerpt: 'E' }).sections).toEqual([emptySection()]);
  });

  it('survives being handed nothing at all', () => {
    expect(() => postToForm()).not.toThrow();
    expect(postToForm().title).toBe('');
  });
});

describe('formToPayload', () => {

  it('is lossless for a post opened and saved unchanged', () => {
    const payload = formToPayload(postToForm(API_POST));

    expect(payload).toEqual({
      title:     API_POST.title,
      excerpt:   API_POST.excerpt,
      tags:      ['React', 'Node.js'],
      published: true,
      sections: [
        { heading: 'Introduction', body: ['A real paragraph.'], bullets: [] },
        { heading: 'Planning',     body: [], bullets: ['Jira', 'Branching'] },
      ],
    });
  });

  it('never emits content, even when the form somehow holds one', () => {
    expect(formToPayload({ ...emptyForm(), content: 'legacy markdown' }))
      .not.toHaveProperty('content');
  });

  it('drops blank paragraphs and bullets', () => {
    const payload = formToPayload({
      title: 'T', excerpt: 'E', tags: '', published: false,
      sections: [{ heading: 'H', body: ['kept', '   ', ''], bullets: ['', 'also kept'] }],
    });

    expect(payload.sections[0].body).toEqual(['kept']);
    expect(payload.sections[0].bullets).toEqual(['also kept']);
  });

  it('drops a section left completely empty by an abandoned Add Section', () => {
    const payload = formToPayload({
      title: 'T', excerpt: 'E', tags: '', published: false,
      sections: [
        { heading: 'Real', body: ['text'], bullets: [] },
        emptySection(),
      ],
    });

    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].heading).toBe('Real');
  });

  it('keeps a headed but textless section so formErrors can report it', () => {
    const payload = formToPayload({
      title: 'T', excerpt: 'E', tags: '', published: false,
      sections: [{ heading: 'Headed', body: [''], bullets: [] }],
    });

    expect(payload.sections).toHaveLength(1);
  });

  it('trims and splits tags, discarding empties', () => {
    expect(formToPayload({ ...emptyForm(), tags: ' React , , Docker ,' }).tags)
      .toEqual(['React', 'Docker']);
  });
});

describe('formErrors', () => {

  const VALID = {
    title: 'A Title', excerpt: 'An excerpt.', tags: 'React', published: true,
    sections: [{ heading: 'Intro', body: ['Body text.'], bullets: [] }],
  };

  it('passes a well-formed post', () => {
    expect(formErrors(VALID)).toEqual([]);
  });

  it('reports a missing title', () => {
    expect(formErrors({ ...VALID, title: '   ' })).toContain('Title is required.');
  });

  it('reports a missing excerpt', () => {
    expect(formErrors({ ...VALID, excerpt: '' })).toContain('Excerpt is required.');
  });

  it('reports an over-long excerpt at the same 300 the server enforces', () => {
    expect(formErrors({ ...VALID, excerpt: 'x'.repeat(301) }))
      .toContain('Excerpt cannot exceed 300 characters.');
  });

  it('reports a post with no sections left', () => {
    expect(formErrors({ ...VALID, sections: [emptySection()] }))
      .toContain('Add at least one section — a post needs a body.');
  });

  it('reports a section missing its heading', () => {
    expect(formErrors({ ...VALID, sections: [{ heading: '', body: ['text'], bullets: [] }] }))
      .toContain('Section 01 needs a heading.');
  });

  it('reports a section with no paragraphs and no bullets', () => {
    expect(formErrors({ ...VALID, sections: [{ heading: 'Headed', body: ['  '], bullets: [] }] }))
      .toContain('Section 01 needs at least one paragraph or bullet.');
  });

  it('numbers the offending section by its position', () => {
    const errors = formErrors({
      ...VALID,
      sections: [
        { heading: 'Fine',   body: ['text'], bullets: [] },
        { heading: 'Broken', body: [],       bullets: [] },
      ],
    });

    expect(errors).toContain('Section 02 needs at least one paragraph or bullet.');
    expect(errors).not.toContain('Section 01 needs at least one paragraph or bullet.');
  });

  // Validating the raw form instead of the payload would pass this.
  it('sees through whitespace-only text', () => {
    expect(formErrors({ ...VALID, title: ' ', excerpt: '\t' }))
      .toEqual(expect.arrayContaining(['Title is required.', 'Excerpt is required.']));
  });
});

// ── PF-97: the tag chip picker's bridge ───────────────────────────────
// Form state holds tags as one comma-separated STRING (that is what the
// text input binds to); the picker reasons about them as a list.
describe('tag helpers', () => {

  describe('tagList', () => {
    it('splits, trims and drops empties', () => {
      expect(tagList(' React , , Docker ,')).toEqual(['React', 'Docker']);
    });

    it('returns an empty list for nothing at all', () => {
      expect(tagList('')).toEqual([]);
      expect(tagList(undefined)).toEqual([]);
      expect(tagList(null)).toEqual([]);
    });
  });

  describe('hasTag', () => {
    it('finds a tag regardless of case', () => {
      expect(hasTag('React, Docker', 'react')).toBe(true);
      expect(hasTag('React, Docker', 'REACT')).toBe(true);
    });

    it('does not match a partial word', () => {
      // "React" must not report as present because "React Native" is.
      expect(hasTag('React Native', 'React')).toBe(false);
    });

    it('is false on an empty field', () => {
      expect(hasTag('', 'React')).toBe(false);
    });
  });

  describe('toggleTag', () => {
    it('adds a tag that is absent', () => {
      expect(toggleTag('React', 'Docker')).toBe('React, Docker');
    });

    it('removes a tag that is present', () => {
      expect(toggleTag('React, Docker', 'React')).toBe('Docker');
    });

    // The trap: a case-sensitive compare would ADD a second "react"
    // beside the existing "React" instead of removing it.
    it('removes case-insensitively', () => {
      expect(toggleTag('React, Docker', 'react')).toBe('Docker');
    });

    it('never produces a duplicate when re-adding in another case', () => {
      const once  = toggleTag('', 'React');
      const twice = toggleTag(once, 'react');
      expect(tagList(twice)).toHaveLength(0);
    });

    // The vocabulary's own capitalisation is what should land on the post,
    // so an added tag keeps the casing it was given.
    it('preserves the casing of the value it stores', () => {
      expect(toggleTag('', 'Node.js')).toBe('Node.js');
      expect(toggleTag('React', 'GitHub Actions')).toBe('React, GitHub Actions');
    });

    it('adds to an empty field without a leading separator', () => {
      expect(toggleTag('', 'React')).toBe('React');
    });
  });

  describe('removeTag', () => {
    it('removes case-insensitively and leaves the rest in order', () => {
      expect(removeTag('React, Docker, MERN', 'docker')).toBe('React, MERN');
    });

    it('is a no-op when the tag is not there', () => {
      expect(removeTag('React, Docker', 'Python')).toBe('React, Docker');
    });

    it('handles removing the only tag', () => {
      expect(removeTag('React', 'React')).toBe('');
    });
  });
});
