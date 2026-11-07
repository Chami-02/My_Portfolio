// PF-154 — the SENT routes: GET /api/contact/sent, DELETE /api/contact/sent/:id,
// POST /api/contact/sent/bulk. Through the real app and routes.
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const SentReply = require('../models/SentReply');
const User = require('../models/User');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const authHeader = async () => {
  const user = await User.create({ email: 'owner@test.com', password: 'TestPass@1234!' });
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};
const makeSent = (over = {}) => SentReply.create({
  contact:  new mongoose.Types.ObjectId(),
  toName:   'A Visitor',
  toEmail:  'visitor@example.com',
  subject:  'Re: Your message to Parindra Gallage',
  message:  'Yes, I am.',
  original: { message: 'Are you available?', receivedAt: new Date('2026-11-01T00:00:00Z') },
  sentAt:   new Date('2026-11-02T00:00:00Z'),
  ...over,
});

describe('GET /api/contact/sent', () => {
  it('refuses a signed-out request', async () => {
    await makeSent();
    const res = await request(app).get('/api/contact/sent');
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
  });

  it('lists every reply newest first, with what each one answered', async () => {
    await makeSent({ toName: 'Old', sentAt: new Date('2026-10-01T00:00:00Z') });
    await makeSent({ toName: 'New', sentAt: new Date('2026-11-05T00:00:00Z') });
    await makeSent({ toName: 'Mid', sentAt: new Date('2026-10-15T00:00:00Z') });
    const res = await request(app).get('/api/contact/sent').set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.toName)).toEqual(['New', 'Mid', 'Old']);
    expect(res.body.data[0]).toMatchObject({
      toEmail: 'visitor@example.com',
      subject: 'Re: Your message to Parindra Gallage',
      original: { message: 'Are you available?' },
    });
    expect(res.body.data[0].__v).toBeUndefined();
  });

  it('an empty SENT is an empty list, not an error', async () => {
    const res = await request(app).get('/api/contact/sent').set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('DELETE /api/contact/sent/:id', () => {
  it('refuses a signed-out request and deletes nothing', async () => {
    const r = await makeSent();
    expect((await request(app).delete(`/api/contact/sent/${r._id}`)).status).toBe(401);
    expect(await SentReply.countDocuments()).toBe(1);
  });

  it('deletes that one reply and no other', async () => {
    const keep = await makeSent();
    const gone = await makeSent();
    const res = await request(app).delete(`/api/contact/sent/${gone._id}`).set(await authHeader());
    expect(res.status).toBe(204);
    expect((await SentReply.find().lean()).map((r) => String(r._id))).toEqual([String(keep._id)]);
  });

  it('one already gone is a plain 404', async () => {
    const res = await request(app).delete(`/api/contact/sent/${new mongoose.Types.ObjectId()}`).set(await authHeader());
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("We couldn't find that sent reply. It may have been deleted already.");
  });

  it('a broken id is a 400, never a 500', async () => {
    const res = await request(app).delete('/api/contact/sent/not-an-id').set(await authHeader());
    expect(res.status).toBe(400);
  });
});

describe('POST /api/contact/sent/bulk', () => {
  it('refuses a signed-out request and deletes nothing', async () => {
    const r = await makeSent();
    const res = await request(app).post('/api/contact/sent/bulk').send({ ids: [String(r._id)] });
    expect(res.status).toBe(401);
    expect(await SentReply.countDocuments()).toBe(1);
  });

  it('deletes exactly the ids sent, and counts them', async () => {
    const [a, b, c] = await Promise.all([makeSent(), makeSent(), makeSent()]);
    const res = await request(app).post('/api/contact/sent/bulk').set(await authHeader())
      .send({ ids: [String(a._id), String(c._id)] });
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect((await SentReply.find().lean()).map((r) => String(r._id))).toEqual([String(b._id)]);
  });

  it('ids already gone are not a failure', async () => {
    const res = await request(app).post('/api/contact/sent/bulk').set(await authHeader())
      .send({ ids: [String(new mongoose.Types.ObjectId())] });
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it.each([
    ['no list', {}],
    ['an empty list', { ids: [] }],
    ['a list that is not one', { ids: 'abc' }],
    ['a broken id', { ids: ['nope'] }],
    ['an array hiding inside the list', { ids: [['507f1f77bcf86cd799439011']] }],
    ['an operator', { ids: [{ $ne: null }] }],
    ['more than 200', { ids: Array.from({ length: 201 }, () => String(new mongoose.Types.ObjectId())) }],
  ])('refuses %s and deletes nothing', async (_name, body) => {
    await makeSent();
    const res = await request(app).post('/api/contact/sent/bulk').set(await authHeader()).send(body);
    expect(res.status).toBe(400);
    expect(await SentReply.countDocuments()).toBe(1);
  });
});
