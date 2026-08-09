const Project = require('../models/Project');

describe('Project — backgroundImage (PF-52)', () => {

  const BASE = {
    title:       'Test',
    description: 'Test description',
    tech:        ['React'],
    githubUrl:   'https://github.com/test/project',
  };

  it('defaults to empty src and 0.75 opacity', () => {
    const p = new Project(BASE);

    expect(p.backgroundImage.src).toBe('');
    expect(p.backgroundImage.opacity).toBe(0.75);
  });

  it('accepts a valid https URL', () => {
    const p = new Project({
      ...BASE,
      backgroundImage: { src: 'https://example.com/bg.jpg', opacity: 0.5 },
    });

    const err = p.validateSync();
    expect(err).toBeUndefined();
  });

  it('rejects a data: URI', () => {
    const p = new Project({
      ...BASE,
      backgroundImage: { src: 'data:image/svg+xml;base64,AAA', opacity: 0.5 },
    });

    const err = p.validateSync();
    expect(err).toBeDefined();
    expect(err.errors['backgroundImage.src']).toBeDefined();
  });

  it('rejects opacity above 1.0', () => {
    const p = new Project({
      ...BASE,
      backgroundImage: { src: 'https://example.com/bg.jpg', opacity: 5 },
    });

    const err = p.validateSync();
    expect(err).toBeDefined();
    expect(err.errors['backgroundImage.opacity']).toBeDefined();
  });

  it('rejects opacity below 0.1', () => {
    const p = new Project({
      ...BASE,
      backgroundImage: { src: 'https://example.com/bg.jpg', opacity: 0.05 },
    });

    const err = p.validateSync();
    expect(err).toBeDefined();
    expect(err.errors['backgroundImage.opacity']).toBeDefined();
  });

});
