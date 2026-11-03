const Project = require('../models/Project');
const validationError = require('./helpers/validationError');

describe('Project — backgroundImage (PF-52)', () => {

  const BASE = {
    title:       'Test',
    description: 'Test description',
    tech:        ['React'],
    githubUrl:   'https://github.com/test/project',
    sections: [{ heading: 'About', body: ['What it does.'] }],  // PF-144: a published project needs a page
    // PF-144: with a slug already set the model's slug hook never asks the
    // database — these are pure validation tests with no connection.
    slug:        'test',
  };

  it('defaults to an empty src', () => {
    const p = new Project(BASE);
    expect(p.backgroundImage.src).toBe('');
  });

  // PF-138 — the CONTRACT half of PF-144: `opacity` left the schema.
  it('has no opacity: a value an old client or backup still sends is dropped', () => {
    const p = new Project({ ...BASE, backgroundImage: { src: '', opacity: 0.5 } });
    expect(p.toObject().backgroundImage).not.toHaveProperty('opacity');
    expect(Project.schema.path('backgroundImage.opacity')).toBeUndefined();
  });

  // ── PF-111 ────────────────────────────────────────────────────────────────
  it('defaults publicId to an empty string', () => {
    const p = new Project(BASE);
    expect(p.backgroundImage.publicId).toBe('');
  });

  it('retains publicId — without it the old file can never be deleted', async () => {
    // Cloudinary deletes by public_id and by nothing else, and a delivery URL
    // cannot be turned back into one. A lost publicId is a permanently
    // unreachable file, which is the whole reason PF-111 exists.
    const p = new Project({
      ...BASE,
      backgroundImage: {
        src: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/projects/a.png',
        publicId: 'portfolio/projects/a',
      },
    });

    expect((await validationError(p))).toBeUndefined();
    expect(p.backgroundImage.publicId).toBe('portfolio/projects/a');
  });

  it('accepts a valid https URL', async () => {
    const p = new Project({
      ...BASE,
      backgroundImage: { src: 'https://example.com/bg.jpg' },
    });

    const err = (await validationError(p));
    expect(err).toBeUndefined();
  });

  it('rejects a data: URI', async () => {
    const p = new Project({
      ...BASE,
      backgroundImage: { src: 'data:image/svg+xml;base64,AAA' },
    });

    const err = (await validationError(p));
    expect(err).toBeDefined();
    expect(err.errors['backgroundImage.src']).toBeDefined();
  });

});
