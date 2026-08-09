// isConfigured() decides between a clear 503 and an opaque SDK failure, so
// both branches are worth pinning. The module reads process.env at call time,
// so it can be toggled without re-requiring.

const ORIGINAL = { ...process.env };

const setCreds = (cloud, key, secret) => {
  if (cloud  === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;  else process.env.CLOUDINARY_CLOUD_NAME = cloud;
  if (key    === undefined) delete process.env.CLOUDINARY_API_KEY;     else process.env.CLOUDINARY_API_KEY    = key;
  if (secret === undefined) delete process.env.CLOUDINARY_API_SECRET;  else process.env.CLOUDINARY_API_SECRET = secret;
};

afterEach(() => { process.env = { ...ORIGINAL }; });

describe('cloudinary isConfigured', () => {

  const { isConfigured } = require('../config/cloudinary');

  it('is true when all three credentials are present', () => {
    setCreds('demo', 'key123', 'secret456');

    expect(isConfigured()).toBe(true);
  });

  it('is false when the cloud name is missing', () => {
    setCreds(undefined, 'key123', 'secret456');

    expect(isConfigured()).toBe(false);
  });

  it('is false when the api key is missing', () => {
    setCreds('demo', undefined, 'secret456');

    expect(isConfigured()).toBe(false);
  });

  it('is false when the api secret is missing', () => {
    setCreds('demo', 'key123', undefined);

    expect(isConfigured()).toBe(false);
  });

  it('is false when a credential is present but empty', () => {
    setCreds('demo', 'key123', '');

    expect(isConfigured()).toBe(false);
  });

  it('is false when nothing is set at all', () => {
    setCreds(undefined, undefined, undefined);

    expect(isConfigured()).toBe(false);
  });

});
