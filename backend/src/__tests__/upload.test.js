// The Cloudinary SDK is mocked at the config boundary so no test ever touches
// the real account. That also lets the happy path be covered here rather than
// only manually — the ticket skips it to avoid burning quota, but a mock has
// no quota to burn.
jest.mock('../config/cloudinary', () => ({
  cloudinary: {
    uploader: { upload_stream: jest.fn(), destroy: jest.fn() },
    api:      { resource: jest.fn() },
  },
  isConfigured: jest.fn(() => true),
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const app      = require('../app');
const User     = require('../models/User');
const storage  = require('../services/storage');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
};

// A real 1×1 PNG — genuine magic bytes, 95 bytes on the wire.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('Upload API (PF-63)', () => {

  beforeAll(connectTestDB);
  afterEach(clearDB);
  afterAll(disconnectTestDB);

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', TINY_PNG, 'test.png');

    expect(res.status).toBe(401);
  });

  it('rejects a request with no file', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set(await authHeader());

    expect(res.status).toBe(400);
  });

  it('rejects a file whose magic bytes are not an allowed image', async () => {
    const fake = Buffer.from('this is plain text pretending to be a png');

    const res = await request(app)
      .post('/api/upload')
      .set(await authHeader())
      .attach('file', fake, { filename: 'fake.png', contentType: 'image/png' });

    // Declared type and extension both said PNG; only the bytes gave it away.
    expect([400, 415]).toContain(res.status);
  });

  it('rejects an SVG', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    const res = await request(app)
      .post('/api/upload')
      .set(await authHeader())
      .attach('file', svg, { filename: 'x.svg', contentType: 'image/svg+xml' });

    // SVG is markup: it can carry <script>, so it is excluded deliberately.
    expect([400, 415]).toContain(res.status);
  });

  it('rejects an image over 2 MB', async () => {
    const big = Buffer.concat([TINY_PNG, Buffer.alloc(3 * 1024 * 1024)]);

    const res = await request(app)
      .post('/api/upload')
      .set(await authHeader())
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' });

    expect([413, 400]).toContain(res.status);
  });

  it('names the real type when a recognised format is not allowed', async () => {
    const gif = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(24)]);

    const res = await request(app)
      .post('/api/upload')
      .set(await authHeader())
      .attach('file', gif, { filename: 'anim.png', contentType: 'image/png' });

    // A valid GIF is unsupported, not corrupt — the message must say so.
    expect(res.status).toBe(415);
    expect(res.body.message).toMatch(/image\/gif/);
  });

  it('uploads a valid PNG and returns the stored URL', async () => {
    const spy = jest.spyOn(storage, 'upload').mockResolvedValue({
      url:      'https://res.cloudinary.com/demo/image/upload/v1/portfolio/projects/abc.png',
      publicId: 'portfolio/projects/abc',
      bytes:    95,
      format:   'png',
      width:    1,
      height:   1,
    });

    try {
      const res = await request(app)
        .post('/api/upload')
        .set(await authHeader())
        .attach('file', TINY_PNG, { filename: 'real.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.data.url).toMatch(/^https:\/\//);
      expect(res.body.data).toMatchObject({ width: 1, height: 1, format: 'png' });

      // Images go to /projects as an image resource; PDFs would go to
      // /documents as raw. Getting this wrong breaks deletion silently.
      expect(spy).toHaveBeenCalledWith(expect.any(Buffer), {
        resourceType: 'image',
        folder:       expect.stringContaining('projects'),
      });
    } finally {
      spy.mockRestore();
    }
  });

});
