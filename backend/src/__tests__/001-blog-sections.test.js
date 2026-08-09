const { parseContentToSections } = require('../migrations/001-blog-sections');

describe('Migration 001 — parseContentToSections (PF-59)', () => {

  it('splits on markdown headings', () => {
    const md = `## Introduction
This is the first paragraph.

## Lessons
- Plan before coding
- Keep commits small`;

    const out = parseContentToSections(md);

    expect(out).toHaveLength(2);
    expect(out[0].heading).toBe('Introduction');
    expect(out[0].body[0]).toBe('This is the first paragraph.');
    expect(out[1].heading).toBe('Lessons');
    expect(out[1].bullets).toHaveLength(2);
  });

  it('handles content with no headings', () => {
    const out = parseContentToSections('Just a plain paragraph with no structure.');

    expect(out).toHaveLength(1);
    expect(out[0].heading).toBe('Introduction');
    expect(out[0].body[0]).toContain('plain paragraph');
  });

  it('joins multi-line paragraphs', () => {
    const md = `## Test
This sentence continues
onto a second line.`;

    const out = parseContentToSections(md);
    expect(out[0].body).toHaveLength(1);
    expect(out[0].body[0]).toBe('This sentence continues onto a second line.');
  });

  it('handles both asterisk and dash bullets', () => {
    const md = `## Test
- dash bullet
* star bullet`;

    const out = parseContentToSections(md);
    expect(out[0].bullets).toEqual(['dash bullet', 'star bullet']);
  });

  it('returns empty array for empty input', () => {
    expect(parseContentToSections('')).toEqual([]);
    expect(parseContentToSections(null)).toEqual([]);
  });

  it('never loses text — worst case is one section', () => {
    const weird = '!!!@@@###';
    const out   = parseContentToSections(weird);
    expect(out.length).toBeGreaterThan(0);
  });

});
