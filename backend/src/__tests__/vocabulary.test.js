const Vocabulary = require('../../src/models/Vocabulary');

describe('Vocabulary model (PF-61)', () => {

  it('accepts a valid tech entry', () => {
    const v = new Vocabulary({ type: 'tech', value: 'React' });
    expect(v.validateSync()).toBeUndefined();
  });

  it('accepts a valid tag entry', () => {
    const v = new Vocabulary({ type: 'tag', value: 'DevOps' });
    expect(v.validateSync()).toBeUndefined();
  });

  it('rejects an invalid type', () => {
    const v = new Vocabulary({ type: 'category', value: 'React' });
    const err = v.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.type).toBeDefined();
  });

  it('requires a value', () => {
    const v = new Vocabulary({ type: 'tech' });
    expect(v.validateSync().errors.value).toBeDefined();
  });

  it('allows real tech names with dots, plus, hash and slash', () => {
    for (const name of ['Node.js', 'C++', 'C#', 'CI/CD', 'Tailwind-CSS']) {
      const v = new Vocabulary({ type: 'tech', value: name });
      expect(v.validateSync()).toBeUndefined();
    }
  });

  it('rejects angle brackets', () => {
    const v = new Vocabulary({ type: 'tech', value: '<script>' });
    expect(v.validateSync().errors.value).toBeDefined();
  });

  it('rejects a value over 40 characters', () => {
    const v = new Vocabulary({ type: 'tech', value: 'x'.repeat(41) });
    expect(v.validateSync().errors.value).toBeDefined();
  });

  it('trims whitespace', () => {
    const v = new Vocabulary({ type: 'tech', value: '  React  ' });
    expect(v.value).toBe('React');
  });

  it('defaults order to 0', () => {
    const v = new Vocabulary({ type: 'tech', value: 'React' });
    expect(v.order).toBe(0);
  });

});