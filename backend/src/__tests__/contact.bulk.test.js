const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const authHeader = async () => {
  const user = await User.create({ email: 'admin@test.com', password: 'TestPass@1234!' });
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};

const makeMessages = (count) => Contact.insertMany(Array.from({ length: count }, (_, i) => ({
  name: `Sender ${i}`, email: `s${i}@example.com`, message: 'A message long enough to be valid.',
})));

const bulk = (body, headers) => request(app).post('/api/contact/bulk').set(headers).send(body);

describe('POST /api/contact/bulk (PF-153)', () => {
  it('refuses a signed-out request, without describing the body', async () => {
    const [m] = await makeMessages(1);
    const res = await request(app).post('/api/contact/bulk').send({ action: 'delete', ids: [String(m._id)] });
    expect(res.status).toBe(401);
    expect(await Contact.countDocuments()).toBe(1);
  });

  it('deletes only the chosen messages', async () => {
    const [a, b, c] = await makeMessages(3);
    const res = await bulk({ action: 'delete', ids: [String(a._id), String(b._id)] }, await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect((await Contact.find().lean()).map((m) => String(m._id))).toEqual([String(c._id)]);
  });

  it('marks only the chosen messages read', async () => {
    const [a, b] = await makeMessages(2);
    const res = await bulk({ action: 'read', ids: [String(a._id)] }, await authHeader());
    expect(res.status).toBe(200);
    expect((await Contact.findById(a._id)).read).toBe(true);
    expect((await Contact.findById(b._id)).read).toBe(false);
  });

  it('a message already gone is not a failure', async () => {
    const [a] = await makeMessages(1);
    const res = await bulk({ action: 'delete', ids: [String(a._id), String(new mongoose.Types.ObjectId())] }, await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
  });

  it('takes 200 ids, the batch the client sends, within the body limit', async () => {
    const ids = Array.from({ length: 200 }, () => String(new mongoose.Types.ObjectId()));
    const res = await bulk({ action: 'read', ids }, await authHeader());
    expect(res.status).toBe(200);
  });

  it.each([
    ['no ids', { action: 'delete', ids: [] }],
    ['ids that are no list', { action: 'delete', ids: 'abc' }],
    ['201 ids', { action: 'delete', ids: Array.from({ length: 201 }, () => '507f1f77bcf86cd799439011') }],
    ['a broken id', { action: 'delete', ids: ['nope'] }],
    ['an array inside the list', { action: 'delete', ids: [['507f1f77bcf86cd799439011']] }],
    ['an operator inside the list', { action: 'delete', ids: [{ $ne: null }] }],
    ['an unknown action', { action: 'star', ids: ['507f1f77bcf86cd799439011'] }],
    ['no action', { ids: ['507f1f77bcf86cd799439011'] }],
  ])('refuses %s and changes nothing', async (_name, body) => {
    await makeMessages(2);
    const res = await bulk(body, await authHeader());
    expect(res.status).toBe(400);
    expect(await Contact.countDocuments()).toBe(2);
  });
});
