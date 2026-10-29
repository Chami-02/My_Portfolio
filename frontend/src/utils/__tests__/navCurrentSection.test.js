// PF-142 — the phone menu marks the section the reader is in.
import { describe, it, expect } from 'vitest';
import { currentSectionId } from '../nav';

const IDS = ['about', 'skills', 'projects', 'blog'];
const tops = (map) => (id) => map[id];

describe('currentSectionId', () => {
  it('is the last section whose top has passed the upper third', () => {
    // 812px screen → the line is at 284px.
    expect(currentSectionId(IDS, tops({ about: -900, skills: -100, projects: 280, blog: 1400 }), 812)).toBe('projects');
    expect(currentSectionId(IDS, tops({ about: -900, skills: 100, projects: 300, blog: 1400 }), 812)).toBe('skills');
  });

  it('is null above the first section (the hero) and when nothing is measured', () => {
    expect(currentSectionId(IDS, tops({ about: 600, skills: 1500, projects: 2400, blog: 3300 }), 812)).toBeNull();
    expect(currentSectionId(IDS, () => undefined, 812)).toBeNull();
  });
});
