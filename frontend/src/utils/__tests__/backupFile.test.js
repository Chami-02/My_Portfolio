// frontend/src/utils/__tests__/backupFile.test.js — PF-135
import { describe, it, expect, afterEach, vi } from 'vitest';
import { backupFileName, backupPickProblem, saveJson, REVOKE_AFTER_MS, MAX_BACKUP_BYTES } from '../backupFile';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('backupFileName', () => {
  it('names the file for the reader\'s LOCAL day, zero-padded', () => {
    // Local midnight-ish, built from local parts so the test holds in any zone.
    const local = new Date(2026, 0, 5, 0, 30);
    expect(backupFileName(local.toISOString())).toBe('portfolio-backup-2026-01-05.json');
    expect(backupFileName(local.toISOString(), 'safety-copy')).toBe('portfolio-safety-copy-2026-01-05.json');
  });
});

describe('backupPickProblem — a courtesy, the server is the gate', () => {
  const file = (name, size) => ({ name, size });
  it('accepts a .json file up to 4 MB (any case)', () => {
    expect(backupPickProblem(file('portfolio-backup.JSON', MAX_BACKUP_BYTES))).toBeNull();
  });
  it('refuses another kind of file', () => {
    expect(backupPickProblem(file('photo.png', 10))).toMatch(/\.json file/);
    expect(backupPickProblem(file('backup.json.png', 10))).toMatch(/\.json file/);
  });
  it('refuses a file over 4 MB', () => {
    expect(backupPickProblem(file('b.json', MAX_BACKUP_BYTES + 1))).toMatch(/bigger than 4 MB/);
  });
});

describe('saveJson', () => {
  it('clicks a download link, and frees the URL only later', () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    saveJson({ a: 1 }, 'f.json');

    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_AFTER_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});
