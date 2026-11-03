// PF-144 — the forgiving search box (owner, 2026-11-03: "full stack" found
// nothing while "full-stack" did). Pure, so tested without a database.
const { searchRegexes, searchCondition, escapeRegex, MAX_WORDS } = require('../utils/searchTerms');

const finds = (q, text) => searchRegexes(q).every((rx) => rx.test(text));

describe('searchRegexes — separators do not matter', () => {
  it.each([
    ['full stack', 'A full-stack MERN portfolio'],
    ['full-stack', 'A full stack app'],
    ['fullstack',  'A full-stack MERN portfolio'],
    ['Full_Stack', 'full-stack'],
    ['nodejs',     'Built with Node.js'],
    ['node js',    'Built with Node.js'],
    ['CI/CD',      'ci cd pipeline'],
  ])('"%s" finds "%s"', (q, text) => {
    expect(finds(q, text)).toBe(true);
  });
});

describe('searchRegexes — words, in any order, ALL required', () => {
  it('two words far apart, either order', () => {
    expect(finds('react docker', 'Docker compose … a React front end')).toBe(true);
  });
  it('one word missing → no match', () => {
    expect(finds('react kubernetes', 'Docker and React')).toBe(false);
  });
  it('blank or not a string → nothing to search', () => {
    expect(searchRegexes('  -  ')).toEqual([]);
    expect(searchRegexes(['a'])).toEqual([]);
    expect(searchCondition('', ['title'])).toBeNull();
  });
});

describe('searchRegexes — the text is data, never a pattern', () => {
  it.each([['.*', 'anything'], ['(', 'a ( b'], ['c++', 'c++ and c#']])('"%s" is literal', (q, text) => {
    expect(() => searchRegexes(q)).not.toThrow();
    expect(finds(q, 'zzz')).toBe(false);
    expect(finds(q, text)).toBe(q !== '.*');
  });
  it('escapeRegex escapes every metacharacter', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
  });
  it(`caps the work a visitor can ask for: at most ${MAX_WORDS} words`, () => {
    expect(searchRegexes('a b c d e f g h i j k')).toHaveLength(MAX_WORDS);
  });
});

describe('searchCondition', () => {
  it('every word must match one of the fields', () => {
    const rx = searchRegexes('full stack');
    expect(searchCondition('full stack', ['title', 'tags'])).toEqual({
      $and: rx.map((r) => ({ $or: [{ title: r }, { tags: r }] })),
    });
  });
});
