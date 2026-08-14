// frontend/src/styles/__tests__/theme-bridge.test.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const here   = dirname(fileURLToPath(import.meta.url));
const global = readFileSync(resolve(here, '../global.css'), 'utf8');

describe('Tailwind theme bridge (PF-70)', () => {

  it('does not expose channel triplets to Tailwind', () => {
    // rgba(var(--srf), .62) belongs in CSS Modules. A triplet in
    // @theme would generate a utility that produces invalid CSS.
    for (const t of ['gnd', 'srf', 'ln', 'ftr', 'shd']) {
      expect(global).not.toMatch(new RegExp(`--color-${t}\\s*:`));
    }
  });

});
