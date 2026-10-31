import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { SECTION_TEXT, sectionText, CERTIFICATE_TEXT_FIELDS } from '../sectionText';

const here = dirname(fileURLToPath(import.meta.url));

describe('sectionText (PF-143)', () => {
  it('uses the owner\'s words, and the default when blank or not loaded', () => {
    expect(sectionText({ certificatesHeading: 'Credentials' }, 'certificatesHeading')).toBe('Credentials');
    expect(sectionText({ certificatesHeading: '   ' }, 'certificatesHeading')).toBe('Certificates');
    expect(sectionText(undefined, 'certificatesViewAll')).toBe('VIEW ALL CERTIFICATES');
  });

  // The defaults are written twice — the schema's and the first paint's. If
  // they drift, a loaded page and a loading page say different things.
  it('every default is the backend schema\'s default, word for word', () => {
    const model = readFileSync(resolve(here, '../../../../backend/src/models/About.js'), 'utf8');
    for (const [name, value] of Object.entries(SECTION_TEXT)) {
      expect(model).toContain(`${name}:`);
      expect(model).toContain(`'${value}'`);
    }
  });

  it('the Certificates panel offers every field, once (Education has none — owner, 2026-10-31)', () => {
    const names = CERTIFICATE_TEXT_FIELDS.map((f) => f.name);
    expect(names.sort()).toEqual(Object.keys(SECTION_TEXT).sort());
  });
});
