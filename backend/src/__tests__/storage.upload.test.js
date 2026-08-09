// The Cloudinary SDK is mocked at the config boundary, so these exercise the
// real storage.upload / storage.destroy logic — the buffer-to-stream plumbing
// and the response mapping — without a network call or an account.
jest.mock('../config/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload_stream: jest.fn(),
      destroy:       jest.fn(),
    },
  },
  isConfigured: jest.fn(() => true),
}));

const { cloudinary } = require('../config/cloudinary');
const storage        = require('../services/storage');

const BUF = Buffer.from('%PDF-1.4 fake body', 'latin1');

/** Make upload_stream invoke its callback with (err, result). */
const mockStream = (err, result) => {
  cloudinary.uploader.upload_stream.mockImplementation((opts, cb) => ({
    end: (buffer) => {
      mockStream.lastOpts   = opts;
      mockStream.lastBuffer = buffer;
      cb(err, result);
    },
  }));
};

const CLOUDINARY_RESULT = {
  secure_url: 'https://res.cloudinary.com/demo/raw/upload/v1/portfolio/documents/abc.pdf',
  public_id:  'portfolio/documents/abc',
  bytes:      1234,
  format:     'pdf',
};

beforeEach(() => jest.clearAllMocks());

describe('storage.upload', () => {

  it('maps the Cloudinary response onto our own shape', async () => {
    mockStream(null, CLOUDINARY_RESULT);

    await expect(storage.upload(BUF, { resourceType: 'raw', folder: 'portfolio/documents' }))
      .resolves.toEqual({
        url:      CLOUDINARY_RESULT.secure_url,
        publicId: CLOUDINARY_RESULT.public_id,
        bytes:    1234,
        format:   'pdf',
      });
  });

  it('uses secure_url, never the plain http url', async () => {
    mockStream(null, { ...CLOUDINARY_RESULT, url: 'http://res.cloudinary.com/insecure.pdf' });

    const out = await storage.upload(BUF, { resourceType: 'raw' });

    // An http:// asset is blocked as mixed content on an https site
    expect(out.url.startsWith('https://')).toBe(true);
  });

  it('passes resource_type and folder through to the SDK', async () => {
    mockStream(null, CLOUDINARY_RESULT);

    await storage.upload(BUF, { resourceType: 'raw', folder: 'portfolio/documents' });

    expect(mockStream.lastOpts).toEqual({
      resource_type: 'raw',
      folder:        'portfolio/documents',
    });
  });

  it('defaults to image when no resourceType is given', async () => {
    mockStream(null, CLOUDINARY_RESULT);

    await storage.upload(BUF);

    expect(mockStream.lastOpts.resource_type).toBe('image');
  });

  it('writes the buffer to the stream rather than base64-encoding it', async () => {
    mockStream(null, CLOUDINARY_RESULT);

    await storage.upload(BUF, { resourceType: 'raw' });

    expect(Buffer.isBuffer(mockStream.lastBuffer)).toBe(true);
    expect(mockStream.lastBuffer).toEqual(BUF);
  });

  it('rejects when Cloudinary reports an error', async () => {
    mockStream(new Error('Invalid API key'), null);

    await expect(storage.upload(BUF, { resourceType: 'raw' }))
      .rejects.toThrow('Invalid API key');
  });

  it('rejects when Cloudinary returns neither error nor result', async () => {
    mockStream(null, null);

    await expect(storage.upload(BUF, { resourceType: 'raw' }))
      .rejects.toThrow('Cloudinary returned no result');
  });

  it('falls back to an empty string when format is absent', async () => {
    mockStream(null, { ...CLOUDINARY_RESULT, format: undefined });

    await expect(storage.upload(BUF)).resolves.toMatchObject({ format: '' });
  });

});

describe('storage.destroy', () => {

  it('forwards the resource type — raw files need it or the delete silently no-ops', async () => {
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

    await expect(storage.destroy('portfolio/documents/abc', 'raw'))
      .resolves.toEqual({ result: 'ok' });

    expect(cloudinary.uploader.destroy)
      .toHaveBeenCalledWith('portfolio/documents/abc', { resource_type: 'raw' });
  });

  it('defaults to image when no resource type is given', async () => {
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

    await storage.destroy('portfolio/images/xyz');

    expect(cloudinary.uploader.destroy)
      .toHaveBeenCalledWith('portfolio/images/xyz', { resource_type: 'image' });
  });

  it('surfaces a "not found" result rather than throwing', async () => {
    // This is what a raw file deleted as an 'image' returns — the silent
    // failure the controller has to notice and log
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'not found' });

    await expect(storage.destroy('portfolio/documents/abc', 'image'))
      .resolves.toEqual({ result: 'not found' });
  });

  it('short-circuits on an empty publicId without calling the SDK', async () => {
    await expect(storage.destroy('')).resolves.toEqual({ result: 'skipped' });

    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

});
