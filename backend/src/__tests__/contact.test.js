const request = require('supertest');
const app     = require('../app');
const Contact = require('../models/Contact');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const VALID_MESSAGE = {
  name:    'Test User',
  email:   'test@example.com',
  message: 'This is a valid test message that is long enough for validation.',
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