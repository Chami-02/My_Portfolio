// frontend/src/utils/__tests__/skillForm.test.js — PF-114
import { describe, it, expect } from 'vitest';
import {
  LEVELS, emptySkillForm, skillToForm, formToPayload, isSkillDirty,
  skillFormErrors, cardIds, moveWithin, isOrderDirty, levelRank,
  sortedSections, defaultSectionKey, layoutFrom, mergeLayout, moveInLayout,
  layoutChanges, isLayoutDirty, sectionErrors, newSectionErrors,
} from '../skillForm';

// Frozen: a helper that sorted or mutated its input would THROW here rather
// than leave a quietly re-ordered fixture for the next test.
const SKILLS = Object.freeze([
  Object.freeze({ _id: 'c', name: 'Vite',  category: 'frontend', level: 'beginner', order: 9 }),
  Object.freeze({ _id: 'a', name: 'React', category: 'frontend', level: 'advanced', order: 2 }),
  Object.freeze({ _id: 'x', name: 'Git',   category: 'devops',   level: 'beginner', order: 5 }),
  Object.freeze({ _id: 'b', name: 'Next',  category: 'frontend', level: 'beginner', order: 4 }),
]);

const SECTIONS = Object.freeze([
  Object.freeze({ _id: 'cd', key: 'devops',   label: 'DevOps',   order: 2 }),
  Object.freeze({ _id: 'cf', key: 'frontend', label: 'Frontend', order: 1 }),
  Object.freeze({ _id: 'cs', key: 'soft',     label: 'Soft',     order: 3 }),
]);
const KEYS = ['frontend', 'devops', 'soft'];

describe('the level enum mirrors backend/src/models/Skill.js', () => {
  it('in the schema\'s own order', () => {
    expect(LEVELS).toEqual(['beginner', 'intermediate', 'advanced']);
  });
});

describe('sections (PF-114)', () => {
  it('sorts by order without touching the input', () => {
    expect(sortedSections(SECTIONS).map((c) => c.key)).toEqual(['frontend', 'devops', 'soft']);
  });

  it('defaults a new skill to frontend, else the first section', () => {
    expect(defaultSectionKey(SECTIONS)).toBe('frontend');
    expect(defaultSectionKey([SECTIONS[0], SECTIONS[2]])).toBe('devops');
    expect(defaultSectionKey([])).toBe('');
  });
});

describe('emptySkillForm', () => {
  it('is a factory — two calls never share an object', () => {
    const one = emptySkillForm();
    one.name = 'mutated';
    expect(emptySkillForm().name).toBe('');
  });

  it('defaults to the prototype\'s frontend / beginner, or a given section', () => {
    expect(emptySkillForm()).toEqual({ name: '', category: 'frontend', level: 'beginner' });
    expect(emptySkillForm('soft').category).toBe('soft');
  });
});

describe('skillToForm / formToPayload / isSkillDirty', () => {
  it('round-trips a stored skill', () => {
    expect(formToPayload(skillToForm(SKILLS[1])))
      .toEqual({ name: 'React', category: 'frontend', level: 'advanced' });
  });

  it('trims the name in the payload', () => {
    expect(formToPayload({ name: '  React ', category: 'frontend', level: 'beginner' }).name).toBe('React');
  });

  it('whitespace typed and deleted is not an edit', () => {
    expect(isSkillDirty({ ...skillToForm(SKILLS[1]), name: 'React  ' }, SKILLS[1])).toBe(false);
  });

  it.each([
    ['name',     { name: 'React 19' }],
    ['category', { category: 'other' }],
    ['level',    { level: 'beginner' }],   // re-grading IS an edit
  ])('a changed %s is dirty', (_f, patch) => {
    expect(isSkillDirty({ ...skillToForm(SKILLS[1]), ...patch }, SKILLS[1])).toBe(true);
  });

  it('an untouched form is clean', () => {
    expect(isSkillDirty(skillToForm(SKILLS[1]), SKILLS[1])).toBe(false);
  });
});

describe('skillFormErrors', () => {
  const ok = { name: 'Rust', category: 'frontend', level: 'beginner' };

  it('passes a complete, new skill', () => {
    expect(skillFormErrors(ok, SKILLS, null, KEYS)).toEqual([]);
  });

  it.each(['', '   '])('requires a name (%j)', (name) => {
    expect(skillFormErrors({ ...ok, name }, SKILLS, null, KEYS))
      .toEqual([{ field: 'name', message: 'Skill name is required.' }]);
  });

  it('refuses an existing name', () => {
    expect(skillFormErrors({ ...ok, name: ' React ' }, SKILLS, null, KEYS)[0].field).toBe('name');
  });

  it('lets the skill being edited keep its own name', () => {
    expect(skillFormErrors({ ...ok, name: 'React' }, SKILLS, 'a', KEYS)).toEqual([]);
  });

  // ⚠️ The server's unique index is case-SENSITIVE; the courtesy layer must
  // not invent a stricter rule than the system has.
  it('is case-sensitive, like the server', () => {
    expect(skillFormErrors({ ...ok, name: 'react' }, SKILLS, null, KEYS)).toEqual([]);
  });

  it('refuses a section that does not exist and a level outside the enum', () => {
    const fields = skillFormErrors({ ...ok, category: 'x', level: 'expert' }, SKILLS, null, KEYS)
      .map((e) => e.field);
    expect(fields).toEqual(['category', 'level']);
  });

  it('accepts an owner-created section', () => {
    expect(skillFormErrors({ ...ok, category: 'soft' }, SKILLS, null, KEYS)).toEqual([]);
  });
});

describe('cardIds / moveWithin / isOrderDirty', () => {
  it('lists one card by order, without sorting the input', () => {
    expect(cardIds(SKILLS, 'frontend')).toEqual(['a', 'b', 'c']);
    expect(cardIds(SKILLS, 'language')).toEqual([]);
  });

  it('moves one step either way', () => {
    expect(moveWithin(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveWithin(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('cannot move past either end, or move an id it does not have', () => {
    const ids = Object.freeze(['a', 'b', 'c']);
    expect(moveWithin(ids, 'a', -1)).toBe(ids);
    expect(moveWithin(ids, 'c', 1)).toBe(ids);
    expect(moveWithin(ids, 'z', 1)).toBe(ids);
  });

  it('is dirty only when a staged order differs', () => {
    expect(isOrderDirty(null, ['a', 'b'])).toBe(false);
    expect(isOrderDirty(['a', 'b'], ['a', 'b'])).toBe(false);
    expect(isOrderDirty(['b', 'a'], ['a', 'b'])).toBe(true);
  });
});

describe('levelRank', () => {
  it('ranks the three levels 1-3 and anything else 0', () => {
    expect(LEVELS.map(levelRank)).toEqual([1, 2, 3]);
    expect([undefined, '', 'expert'].map(levelRank)).toEqual([0, 0, 0]);
  });
});

// ── PF-114: the staged layout — one model for arrows AND drag-and-drop ──────
describe('layout', () => {
  // frontend: React(a,2) Next(b,4) Vite(c,9); devops: Git(x,5); soft: empty
  const stored = () => layoutFrom(SKILLS, SECTIONS);

  it('lists every section, empty ones included, each in order', () => {
    expect(stored()).toEqual({ frontend: ['a', 'b', 'c'], devops: ['x'], soft: [] });
  });

  describe('moveInLayout', () => {
    it('drops before a pill in the SAME box', () => {
      expect(moveInLayout(stored(), 'c', 'frontend', 0).frontend).toEqual(['c', 'a', 'b']);
    });

    // The off-by-one that drag code always gets wrong: removing the dragged
    // pill first shifts every later slot down by one.
    it('drops LATER in the same box at the slot the pointer meant', () => {
      expect(moveInLayout(stored(), 'a', 'frontend', 2).frontend).toEqual(['b', 'a', 'c']);
      expect(moveInLayout(stored(), 'a', 'frontend', 3).frontend).toEqual(['b', 'c', 'a']);
    });

    it('moves a pill INTO another box, including an empty one', () => {
      const next = moveInLayout(stored(), 'b', 'soft', 0);
      expect(next.frontend).toEqual(['a', 'c']);
      expect(next.soft).toEqual(['b']);
      expect(moveInLayout(stored(), 'b', 'devops', 0).devops).toEqual(['b', 'x']);
    });

    it('clamps an index past the end', () => {
      expect(moveInLayout(stored(), 'a', 'devops', 99).devops).toEqual(['x', 'a']);
    });

    it('returns the SAME object for a no-op drop, and never mutates', () => {
      const layout = stored();
      Object.values(layout).forEach(Object.freeze);
      expect(moveInLayout(layout, 'a', 'frontend', 0)).toBe(layout);
      expect(moveInLayout(layout, 'a', 'frontend', 1)).toBe(layout);
      expect(moveInLayout(layout, 'zz', 'frontend', 0)).toBe(layout);
      expect(moveInLayout(layout, 'a', 'nope', 0)).toBe(layout);
    });
  });

  describe('layoutChanges', () => {
    it('is empty for the stored layout', () => {
      expect(layoutChanges(stored(), SKILLS, SECTIONS)).toEqual({ moves: [], reorders: [] });
      expect(isLayoutDirty(stored(), SKILLS, SECTIONS)).toBe(false);
    });

    it('a same-box drag is one reorder and no move', () => {
      const staged = moveInLayout(stored(), 'c', 'frontend', 0);
      expect(layoutChanges(staged, SKILLS, SECTIONS))
        .toEqual({ moves: [], reorders: [['c', 'a', 'b']] });
    });

    // Moves FIRST (the server appends), then a reorder for each box whose
    // order differs — the source box keeps its relative order, so needs none.
    it('a cross-box drag is a move, then a reorder of the target', () => {
      const staged = moveInLayout(stored(), 'b', 'devops', 0);
      expect(layoutChanges(staged, SKILLS, SECTIONS)).toEqual({
        moves: [{ id: 'b', category: 'devops' }],
        reorders: [['a', 'c'], ['b', 'x']],
      });
    });

    it('never sends a reorder for a box left empty', () => {
      const staged = moveInLayout(stored(), 'x', 'soft', 0);
      expect(layoutChanges(staged, SKILLS, SECTIONS).reorders).toEqual([['x']]);
    });
  });

  describe('mergeLayout — a staged drag survives a refetch', () => {
    it('is the stored layout when nothing is staged', () => {
      expect(mergeLayout(null, SKILLS, SECTIONS)).toEqual(stored());
    });

    it('drops a skill deleted meanwhile, and places one added meanwhile', () => {
      const staged = moveInLayout(stored(), 'c', 'frontend', 0);     // c a b
      const now = [
        ...SKILLS.filter((s) => s._id !== 'a'),
        { _id: 'n', name: 'New', category: 'frontend', level: 'beginner', order: 50 },
      ];
      expect(mergeLayout(staged, now, SECTIONS).frontend).toEqual(['c', 'b', 'n']);
    });

    it('keeps a staged cross-box move', () => {
      const staged = moveInLayout(stored(), 'b', 'soft', 0);
      expect(mergeLayout(staged, SKILLS, SECTIONS).soft).toEqual(['b']);
    });
  });
});

describe('section names', () => {
  it('requires a name and caps it at 40', () => {
    expect(sectionErrors({ a: ' ', b: 'x'.repeat(41) }).map((e) => e.field))
      .toEqual(['labels.a', 'labels.b']);
  });

  // ⚠️ Case-INSENSITIVE, mirroring the server: "Tools" and "tools" would be
  // two boxes nobody can tell apart.
  it('refuses two sections with one name, in any case', () => {
    expect(sectionErrors({ a: 'Tools', b: 'tools' }))
      .toEqual([{ field: 'labels.b', message: '"tools" is already a section.' }]);
  });

  it('a new section must be named and must not exist already', () => {
    expect(newSectionErrors('  ', SECTIONS)[0].field).toBe('newLabel');
    expect(newSectionErrors('devops', SECTIONS)[0].message).toBe('"devops" is already a section.');
    expect(newSectionErrors('Cloud', SECTIONS)).toEqual([]);
  });
});
