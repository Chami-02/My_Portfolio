// frontend/src/services/__tests__/aboutService.test.js
//
// PF-112 — the first multipart uploads in this codebase.
//
// ⚠️ DRIVEN THROUGH THE REAL AXIOS PIPELINE with a scripted adapter, following
// api.test.js's precedent, and here that is not a style choice — it is the only
// instrument that can see the bug.
//
// `api.js` sets `Content-Type: application/json` as an INSTANCE DEFAULT, and
// axios's own transformRequest (node_modules/axios/lib/defaults/index.js:56)
// converts a FormData body to JSON when that header is present:
//
//     if (isFormData) {
//       return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
//     }
//
// A File is not JSON-serialisable, so it collapses to `{}` and the request goes
// out as '{"file":{}}'. Multer then parses no multipart body, req.file is
// undefined, and the server answers 400 "No file uploaded". Nothing throws
// anywhere on this side.
//
// A test that mocked `api` would pass against the broken version, because the
// transform it needs to observe lives between the service call and the adapter.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '../api';
import { aboutService } from '../aboutService';

const calls = [];
const originalAdapter = api.defaults.adapter;

/** Record every request as axios hands it to the transport, post-transform. */
const install = (payload = { ok: true }) => {
  calls.length = 0;
  api.defaults.adapter = async (config) => {
    calls.push(config);
    return {
      data: { status: 'success', data: payload },
      status: 200, statusText: 'OK', headers: {}, config,
    };
  };
};

const contentTypeOf = (config) =>
  String(config.headers.get?.('Content-Type') ?? config.headers['Content-Type'] ?? '');

const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'me.png', { type: 'image/png' });

const pdfFile = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'cv.pdf', { type: 'application/pdf' });

beforeEach(() => install());
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('multipart uploads survive the JSON instance default', () => {
  it.each([
    ['uploadAvatar', () => aboutService.uploadAvatar(pngFile()), '/about/avatar'],
    ['uploadResume', () => aboutService.uploadResume(pdfFile()), '/about/resume'],
  ])('%s sends a real FormData body', async (_name, call, url) => {
    await call();

    expect(calls).toHaveLength(1);
    const [config] = calls;

    expect(config.method).toBe('put');
    expect(config.url).toBe(url);

    // ⚠️ THE ASSERTION THAT CATCHES THE TRAP. Under the JSON default this is the
    // string '{"file":{}}' — a plain, successful-looking request with no file in
    // it. `toBeInstanceOf` is what distinguishes the two.
    expect(config.data).toBeInstanceOf(FormData);
    expect(typeof config.data).not.toBe('string');
  });

  it.each([
    ['uploadAvatar', () => aboutService.uploadAvatar(pngFile()), 'me.png'],
    ['uploadResume', () => aboutService.uploadResume(pdfFile()), 'cv.pdf'],
  ])('%s puts the File under the field name multer expects', async (_name, call, fileName) => {
    await call();

    const body = calls[0].data;
    const sent = body.get('file');            // middleware/upload.js's uploadSingle('file')

    expect(sent).toBeInstanceOf(File);
    expect(sent.name).toBe(fileName);
  });

  it('does not send application/json on an upload', async () => {
    await aboutService.uploadAvatar(pngFile());

    expect(contentTypeOf(calls[0])).not.toMatch(/application\/json/);
  });

  // ⚠️ The other half of the same rule. Setting 'multipart/form-data' explicitly
  // is also wrong: it omits the boundary parameter, which only the browser can
  // generate, and multer then fails to parse a body that IS multipart. Deleting
  // the header is what lets axios fill in the whole value.
  it('leaves the boundary to the browser rather than naming multipart itself', async () => {
    await aboutService.uploadResume(pdfFile());

    expect(contentTypeOf(calls[0])).not.toBe('multipart/form-data');
  });

  it('still sends JSON for the ordinary profile save', async () => {
    await aboutService.update({ name: 'Parindra' });

    expect(contentTypeOf(calls[0])).toMatch(/application\/json/);
    expect(calls[0].data).toBe('{"name":"Parindra"}');
  });
});

describe('the delete routes', () => {
  it.each([
    ['removeAvatar', () => aboutService.removeAvatar(), '/about/avatar'],
    ['removeResume', () => aboutService.removeResume(), '/about/resume'],
  ])('%s issues a DELETE and carries no body', async (_name, call, url) => {
    await call();

    expect(calls[0].method).toBe('delete');
    expect(calls[0].url).toBe(url);
    expect(calls[0].data).toBeUndefined();
  });
});

describe('response unwrapping', () => {
  it('unwraps data.data, not the envelope', async () => {
    install({ avatar: { url: 'https://cdn/x.png' }, hasAvatar: true });

    await expect(aboutService.uploadAvatar(pngFile()))
      .resolves.toEqual({ avatar: { url: 'https://cdn/x.png' }, hasAvatar: true });
  });
});
