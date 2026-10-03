// PF-113 — the project background is the SECOND multipart upload, through the
// helper moved out of aboutService into ./multipart.js.
//
// Same harness as aboutService.test.js, for the same reason: the trap lives in
// axios's transformRequest, between the service call and the transport, so a
// test that mocked `api` would pass against the broken version. This replaces
// the ADAPTER and records the request exactly as it would leave.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '../api';
import { projectService } from '../projectService';

const calls = [];
const originalAdapter = api.defaults.adapter;

const install = (payload = { ok: true }) => {
  calls.length = 0;
  api.defaults.adapter = async (config) => {
    calls.push(config);
    return { data: { status: 'success', data: payload }, status: 200, statusText: 'OK', headers: {}, config };
  };
};

const contentTypeOf = (config) =>
  String(config.headers.get?.('Content-Type') ?? config.headers['Content-Type'] ?? '');

const webpFile = () =>
  new File([new Uint8Array([0x52, 0x49, 0x46, 0x46])], 'bg.webp', { type: 'image/webp' });

beforeEach(() => install());
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('uploadBackground', () => {
  it('PUTs a real FormData body to the project\'s own background route', async () => {
    await projectService.uploadBackground('abc123', webpFile());

    const [config] = calls;
    expect(config.method).toBe('put');
    expect(config.url).toBe('/projects/abc123/background');
    // Under the JSON default this would be the string '{"file":{}}'.
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.get('file').name).toBe('bg.webp');
  });

  it('sends neither application/json nor a boundary-less multipart header', async () => {
    await projectService.uploadBackground('abc123', webpFile());

    expect(contentTypeOf(calls[0])).not.toMatch(/application\/json/);
    expect(contentTypeOf(calls[0])).not.toBe('multipart/form-data');
  });
});

describe('the other PF-113 calls', () => {
  it('removeBackground DELETEs the background route with no body', async () => {
    await projectService.removeBackground('abc123');

    expect(calls[0].method).toBe('delete');
    expect(calls[0].url).toBe('/projects/abc123/background');
    expect(calls[0].data).toBeUndefined();
  });

  it('getAllAdmin reads the drafts-included list, not the public one', async () => {
    install([{ title: 'Draft' }]);

    await expect(projectService.getAllAdmin()).resolves.toEqual([{ title: 'Draft' }]);
    expect(calls[0].url).toBe('/projects/admin/all');
  });

  it('a normal save is still JSON', async () => {
    await projectService.update('abc123', { title: 'x', published: false });

    expect(contentTypeOf(calls[0])).toMatch(/application\/json/);
    expect(JSON.parse(calls[0].data)).toEqual({ title: 'x', published: false });
  });
});
