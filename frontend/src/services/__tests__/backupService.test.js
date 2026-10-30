// frontend/src/services/__tests__/backupService.test.js
//
// PF-135 — the wire format the backend reads. The restore MUST leave as a
// real multipart form (the documented `Content-Type: undefined` trap: through
// api.js's JSON default a FormData collapses to '{"file":{}}' and multer sees
// no file), with the password as a field beside the file.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
const get  = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ default: { post, get } }));

const { backupService } = await import('../backupService');

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: { data: { ok: 1 }, problems: ['p'] } });
  get.mockReset().mockResolvedValue({ data: { data: [] } });
});

describe('backupService', () => {
  it('download sends the password as JSON and returns the file and its problems', async () => {
    expect(await backupService.download({ password: 'pw' })).toEqual({ backup: { ok: 1 }, problems: ['p'] });
    expect(post).toHaveBeenCalledWith('/backup', { password: 'pw' });
  });

  it('check sends ONLY the file, as multipart, with the slow timeout', async () => {
    const file = new File(['{}'], 'b.json', { type: 'application/json' });
    await backupService.checkRestore(file);
    const [url, body, config] = post.mock.calls[0];

    expect(url).toBe('/backup/restore/check');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
    expect(body.has('password')).toBe(false);
    expect(config.headers).toEqual({ 'Content-Type': undefined });
    expect(config.timeout).toBe(60_000);
  });

  it('restore sends the file AND the password field, as multipart', async () => {
    const file = new File(['{}'], 'b.json', { type: 'application/json' });
    await backupService.restore({ file, password: 'pw' });
    const [url, body, config] = post.mock.calls[0];

    expect(url).toBe('/backup/restore');
    expect(body.get('file')).toBe(file);
    expect(body.get('password')).toBe('pw');
    expect(config.headers).toEqual({ 'Content-Type': undefined });
  });

  it('safety copies: list by GET, one copy by POST with the password', async () => {
    await backupService.listSafetyCopies();
    await backupService.downloadSafetyCopy({ id: 'abc', password: 'pw' });

    expect(get).toHaveBeenCalledWith('/backup/safety');
    expect(post).toHaveBeenCalledWith('/backup/safety/abc', { password: 'pw' });
  });
});
