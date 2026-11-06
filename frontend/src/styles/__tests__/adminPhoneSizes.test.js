// PF-149 (owner, 2026-11-06): smaller admin screens on a phone. CSS-Module rules are
// invisible to Vitest's DOM, so these read the sheets with postcss. Comments are
// never visited, so prose naming a value cannot pass for a rule.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The declarations of `.name`, inside the phone block only. */
const phoneRule = (file, name) => {
  const found = {};
  postcss.parse(readFileSync(join(src, file), 'utf8')).walkAtRules('media', (media) => {
    if (!media.params.includes('max-width: 560px')) return;
    media.walkRules((rule) => {
      const names = rule.selectors.map((s) => s.trim());
      if (names.includes(`.${name}`)) rule.walkDecls((d) => { found[d.prop] = d.value; });
    });
  });
  return found;
};

const SHARED = 'styles/admin.module.css';
const LOGIN  = 'pages/AdminLoginPage.module.css';

describe('fields on a phone', () => {
  // iOS Safari zooms the whole page into a focused field with smaller text.
  it.each([
    [SHARED, 'input'], [SHARED, 'textarea'], [SHARED, 'select'], [SHARED, 'inputMono'], [SHARED, 'inputPill'],
    [LOGIN, 'input'],
    ['components/admin/panels/AdminMessagesPanel.module.css', 'searchInput'],
  ])('%s .%s has 16px text, so iPhones do not zoom', (file, name) => {
    expect(phoneRule(file, name)['font-size']).toBe('16px');
  });

  it('the sign-in field keeps room for the eye', () => {
    // A `padding` shorthand here would beat .passwordWrap's room on the right,
    // and the eye would sit on top of the typed password.
    const rule = phoneRule(LOGIN, 'input');
    expect(rule.padding).toBeUndefined();
    expect(rule['padding-right']).toBeUndefined();
    expect(rule['min-height']).toBe('40px');
  });

  it('text boxes start small, and can still be dragged taller', () => {
    expect(phoneRule(SHARED, 'textarea').height).toBe('72px');
    expect(phoneRule(SHARED, 'textarea').resize).toBeUndefined(); // the base rule's `vertical` stands
  });
});

describe('controls on a phone', () => {
  it.each(['btnPrimary', 'btnOutline', 'btnDanger'])('.%s is 36px', (name) => {
    expect(phoneRule(SHARED, name)['min-height']).toBe('36px');
  });

  it('cards are compact', () => {
    expect(phoneRule(SHARED, 'panel').padding).toBe('12px');
  });
});
