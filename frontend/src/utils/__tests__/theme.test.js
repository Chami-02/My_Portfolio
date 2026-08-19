import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  normalise, readTheme, writeTheme, readAppliedTheme,
  applyTheme, toggleLabel, themeModeLabel, THEME_KEY, DEFAULT_THEME,
} from '../theme';

describe('theme utilities (PF-72)', () => {

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalise', () => {
    it('accepts known themes', () => {
      expect(normalise('dark')).toBe('dark');
      expect(normalise('light')).toBe('light');
    });

    it('falls back to the default for anything else', () => {
      expect(normalise('banana')).toBe(DEFAULT_THEME);
      expect(normalise(null)).toBe(DEFAULT_THEME);
      expect(normalise(undefined)).toBe(DEFAULT_THEME);
      expect(normalise('')).toBe(DEFAULT_THEME);
    });
  });

  describe('readTheme', () => {
    it('reads a persisted value', () => {
      localStorage.setItem(THEME_KEY, 'light');
      expect(readTheme()).toBe('light');
    });

    it('defaults when nothing is stored', () => {
      expect(readTheme()).toBe(DEFAULT_THEME);
    });

    it('does not throw when storage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => readTheme()).not.toThrow();
      expect(readTheme()).toBe(DEFAULT_THEME);
    });
  });

  describe('writeTheme', () => {
    it('persists a normalised value', () => {
      writeTheme('light');
      expect(localStorage.getItem(THEME_KEY)).toBe('light');

      writeTheme('banana');
      expect(localStorage.getItem(THEME_KEY)).toBe(DEFAULT_THEME);
    });

    it('does not throw when storage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => writeTheme('light')).not.toThrow();
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme on documentElement', () => {
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('normalises before applying', () => {
      applyTheme('banana');
      expect(document.documentElement.getAttribute('data-theme')).toBe(DEFAULT_THEME);
    });

    // THE ACCENT-OVERRIDE TRAP — an inline custom property on <html>
    // beats the theme block and makes every future token edit dead code.
    it('sets no inline styles on documentElement', () => {
      applyTheme('light');
      expect(document.documentElement.getAttribute('style')).toBeNull();
      expect(document.documentElement.style.getPropertyValue('--acc')).toBe('');
    });
  });

  describe('readAppliedTheme', () => {
    it('reads what the head script applied', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      expect(readAppliedTheme()).toBe('light');
    });

    it('defaults when the attribute is absent', () => {
      expect(readAppliedTheme()).toBe(DEFAULT_THEME);
    });
  });

  describe('toggleLabel', () => {
    it('names the mode you would switch to', () => {
      expect(toggleLabel('dark')).toBe('Light');
      expect(toggleLabel('light')).toBe('Dark');
    });
  });

  describe('themeModeLabel', () => {
    it('matches the prototype themeLabel verbatim (line 1113)', () => {
      expect(themeModeLabel('light')).toBe('DARK MODE');
      expect(themeModeLabel('dark')).toBe('LIGHT MODE');
    });
  });

});
