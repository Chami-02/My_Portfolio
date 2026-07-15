const request = require('supertest');
const jwt     = require('jsonwebtoken');
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
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
