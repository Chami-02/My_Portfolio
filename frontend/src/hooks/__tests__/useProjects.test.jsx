// PF-144 — the project list's cache identity and the page query's key.
import { describe, it, expect } from 'vitest';
import { projectListParams, PROJECTS_KEY } from '../useProjects';

describe('projectListParams', () => {
  it('no filter, blank filters and "All" are ONE key — {}', () => {
    expect(projectListParams()).toEqual({});
    expect(projectListParams({ q: '  ', tech: 'All', category: '' })).toEqual({});
  });

  it('trims the query and keeps one category', () => {
    expect(projectListParams({ q: ' car ', category: ['Web App', 'API'] })).toEqual({ q: 'car', category: 'Web App' });
  });

  it('sorts tech into a COPY — one key whatever the click order, the caller untouched', () => {
    const picked = Object.freeze(['React', 'Docker']);
    expect(projectListParams({ tech: picked })).toEqual({ tech: ['Docker', 'React'] });
    expect(projectListParams({ tech: ['Docker', 'React'] })).toEqual(projectListParams({ tech: picked }));
  });

  it('every key stays under PROJECTS_KEY, so mutations still invalidate it', () => {
    expect(PROJECTS_KEY).toEqual(['projects']);
  });
});
