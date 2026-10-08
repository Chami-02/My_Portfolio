const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app     = require('../app');
const Contact = require('../models/Contact');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const VALID_MESSAGE = {
  name:    'Test User',
  email:   'test@example.com',
  message: 'This is a valid test message that is long enough for validation.',
};

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

describe('POST /api/contact', () => {
  it('accepts a valid contact submission and returns 201', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send(VALID_MESSAGE);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/received/i);
  });

  it('saves the message to the database', async () => {
    await request(app).post('/api/contact').send(VALID_MESSAGE);
    const saved = await Contact.findOne({ email: VALID_MESSAGE.email });
    expect(saved).not.toBeNull();
    expect(saved.name).toBe(VALID_MESSAGE.name);
    expect(saved.read).toBe(false);
  });

  it('rejects empty name', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...VALID_MESSAGE, name: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name is required/i);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...VALID_MESSAGE, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  it('rejects message shorter than 10 characters', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...VALID_MESSAGE, message: 'too short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/10 characters/i);
  });

  it('rejects completely empty body', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});

describe('GET /api/contact', () => {
  it('returns all messages for an authenticated admin', async () => {
    await Contact.create(VALID_MESSAGE);
    await Contact.create({
      ...VALID_MESSAGE,
      email: 'read@example.com',
      read: true,
    });

    const res = await request(app)
      .get('/api/contact')
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].read).toBe(false);
  });
});

describe('PATCH /api/contact/:id/read', () => {
  it('marks a message as read', async () => {
    const message = await Contact.create(VALID_MESSAGE);

    const res = await request(app)
      .patch(`/api/contact/${message._id}/read`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.read).toBe(true);
  });

  it('returns 404 when marking a missing message', async () => {
    const res = await request(app)
      .patch('/api/contact/000000000000000000000000/read')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/contact/:id', () => {
  it('deletes a message', async () => {
    const message = await Contact.create(VALID_MESSAGE);

    const res = await request(app)
      .delete(`/api/contact/${message._id}`)
      .set(await authHeader());

    expect(res.status).toBe(204);
    await expect(Contact.findById(message._id)).resolves.toBeNull();
  });

  it('returns 404 when deleting a missing message', async () => {
    const res = await request(app)
      .delete('/api/contact/000000000000000000000000')
      .set(await authHeader());

    expect(res.status).toBe(404);
  });
});

// ── PF-115 — the owner's STAR (owner, 2026-10-07) ──────────────────────────
describe('PATCH /api/contact/:id/star', () => {
  it('stars and unstars a message — an explicit value, not a flip', async () => {
    const message = await Contact.create(VALID_MESSAGE);
    expect(message.starred).toBe(false);

    const on = await request(app).patch(`/api/contact/${message._id}/star`)
      .set(await authHeader()).send({ starred: true });
    expect(on.status).toBe(200);
    expect(on.body.data.starred).toBe(true);

    // The same request twice must leave it starred — a toggle would unstar.
    const again = await request(app).patch(`/api/contact/${message._id}/star`)
      .set(await authHeader()).send({ starred: true });
    expect(again.body.data.starred).toBe(true);

    const off = await request(app).patch(`/api/contact/${message._id}/star`)
      .set(await authHeader()).send({ starred: false });
    expect(off.body.data.starred).toBe(false);
  });

  it('does not touch the read flag', async () => {
    const message = await Contact.create(VALID_MESSAGE);
    const res = await request(app).patch(`/api/contact/${message._id}/star`)
      .set(await authHeader()).send({ starred: true });
    expect(res.body.data.read).toBe(false);
  });

  it.each([[{}], [{ starred: 'yes' }], [{ starred: 1 }]])(
    'refuses a body that is not a boolean: %j',
    async (body) => {
      const message = await Contact.create(VALID_MESSAGE);
      const res = await request(app).patch(`/api/contact/${message._id}/star`)
        .set(await authHeader()).send(body);
      expect(res.status).toBe(400);
      expect((await Contact.findById(message._id)).starred).toBe(false);
    },
  );

  it('returns 404 for a missing message and 400 for a malformed id', async () => {
    const missing = await request(app).patch('/api/contact/000000000000000000000000/star')
      .set(await authHeader()).send({ starred: true });
    expect(missing.status).toBe(404);

    const bad = await request(app).patch('/api/contact/not-an-id/star')
      .set(await authHeader()).send({ starred: true });
    expect(bad.status).toBe(400);
  });

  it('answers 401 without a token — even with a bad body', async () => {
    const message = await Contact.create(VALID_MESSAGE);
    const res = await request(app).patch(`/api/contact/${message._id}/star`).send({ starred: 'x' });
    expect(res.status).toBe(401);
  });

  it('a visitor cannot star their own message through the public form', async () => {
    await request(app).post('/api/contact').send({ ...VALID_MESSAGE, starred: true });
    const [saved] = await Contact.find();
    expect(saved.starred).toBe(false);
  });
});
