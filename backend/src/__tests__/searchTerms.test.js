// PF-144 — the forgiving search box (owner, 2026-11-03: "full stack" found
// nothing while "full-stack" did). Pure, so tested without a database.
const {
  searchRegexes, searchCondition, escapeRegex, MAX_WORDS, FUZZY_MIN, FUZZY_MAX,
} = require('../utils/searchTerms');

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

// PF-138 (owner, 2026-11-03): "dokcer" should find Docker.
describe('searchRegexes — one spelling mistake is forgiven', () => {
  it.each([
    ['dokcer',  'Docker compose'],   // two neighbours swapped
    ['reactt',  'A React app'],      // an extra letter
    ['mongdb',  'MongoDB Atlas'],    // a missing letter
    ['dpcker',  'docker'],           // a wrong letter
    ['nodjs',   'Built with Node.js'], // a missing letter AND a separator
    ['fulstack', 'A full-stack app'],
    ['tailwidn css', 'Tailwind CSS'],
  ])('"%s" finds "%s"', (q, text) => {
    expect(finds(q, text)).toBe(true);
  });

  it.each([
    ['dcokr',  'docker'],  // two mistakes
    ['dokcre', 'docker'],  // two swaps
    ['xyzzy',  'docker'],
  ])('"%s" does NOT find "%s" — only ONE mistake', (q, text) => {
    expect(finds(q, text)).toBe(false);
  });

  it(`words under ${FUZZY_MIN} letters stay exact`, () => {
    expect(finds('ccs', 'css')).toBe(false);
    expect(finds('nde', 'node')).toBe(false);
    expect(finds('css', 'Tailwind CSS')).toBe(true);
  });

  it(`words over ${FUZZY_MAX} letters stay exact (bounds the pattern's size)`, () => {
    const long = 'internationalisation';
    expect(long.length).toBeGreaterThan(FUZZY_MAX);
    expect(finds(long, long)).toBe(true);
    expect(finds('internationalistion', long)).toBe(false);
  });

  it('a mistake is a letter — a separator never counts as one', () => {
    // "react" with a separator in place of a letter is not "react".
    expect(finds('reacts', 'reac- app')).toBe(false);
  });

  it('the typed text is still data: a metacharacter in a long word is literal', () => {
    expect(() => searchRegexes('c++builder')).not.toThrow();
    expect(finds('c++builder', 'cxxbuilder')).toBe(false);
    expect(finds('c++buildr', 'C++Builder')).toBe(true);
  });

  // The first version let two gaps share a run of separators: 800 chars of
  // "- - -" took ~0.8 s, and it grew with the CUBE of the length.
  it('runs in linear time on a long run of separators (no ReDoS)', () => {
    const rxs = searchRegexes('abcdefghijkl '.repeat(MAX_WORDS));
    const text = '- '.repeat(1500); // big enough to fail in seconds, not hang
    const start = Date.now();
    rxs.forEach((rx) => rx.test(text));
    expect(Date.now() - start).toBeLessThan(1000);
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
