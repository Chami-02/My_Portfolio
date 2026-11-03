import { describe, it, expect } from 'vitest';
import { projectPeriod, projectByline, projectCategory, pictureAt } from '../projectMeta';

describe('projectPeriod', () => {
  it.each([
    [{ startedOn: '2024-02', ongoing: true },                       'FEB 2024 – PRESENT'],
    [{ startedOn: '2024-02', endedOn: '2025-05' },                  'FEB 2024 – MAY 2025'],
    [{ startedOn: '2026-05', endedOn: '2026-05' },                  'MAY 2026'],
    [{ startedOn: '2026-05' },                                      'MAY 2026'],
    [{ endedOn: '2025-12' },                                        'DEC 2025'],
    [{ startedOn: '2023', endedOn: '2024' },                        '2023 – 2024'],
    [{ ongoing: true },                                             'ONGOING'],
    [{},                                                            ''],
    // An end date left behind while Ongoing is ticked is not shown.
    [{ startedOn: '2024-02', endedOn: '2024-09', ongoing: true },   'FEB 2024 – PRESENT'],
  ])('%j → %s', (project, expected) => {
    expect(projectPeriod(project)).toBe(expected);
  });
});

describe('projectByline', () => {
  it('joins role and client, leaving out blanks', () => {
    expect(projectByline({ role: 'Team lead', client: 'ClearDrive.lk' })).toBe('Team lead · ClearDrive.lk');
    expect(projectByline({ role: ' ', client: 'Freelance' })).toBe('Freelance');
    expect(projectByline({})).toBe('');
  });
});

describe('projectCategory', () => {
  it('is the first category, or blank', () => {
    expect(projectCategory({ categories: ['Web App'] })).toBe('Web App');
    expect(projectCategory({ categories: [] })).toBe('');
    expect(projectCategory({})).toBe('');
  });
});

describe('pictureAt', () => {
  const CLOUD = 'https://res.cloudinary.com/x/image/upload/v1/portfolio/projects/a.webp';
  it('asks Cloudinary for a limited width in the best format', () => {
    expect(pictureAt(CLOUD, 800)).toBe('https://res.cloudinary.com/x/image/upload/c_limit,w_800,f_auto,q_auto/v1/portfolio/projects/a.webp');
  });
  it('leaves any other address alone', () => {
    expect(pictureAt('https://cdn.test/bg.webp', 800)).toBe('https://cdn.test/bg.webp');
    expect(pictureAt('', 800)).toBe('');
    expect(pictureAt(undefined, 800)).toBeUndefined();
  });
  it('matches the HOST exactly, never the text anywhere in the address', () => {
    for (const trick of [
      'https://other.test/res.cloudinary.com/image/upload/a.webp',
      'https://res.cloudinary.com.other.test/x/image/upload/a.webp',
      'https://other.test/x/image/upload/a.webp?res.cloudinary.com',
      'http://res.cloudinary.com/x/image/upload/a.webp',
      'not a url res.cloudinary.com/image/upload/',
    ]) {
      expect(pictureAt(trick, 800)).toBe(trick);
    }
  });
});
