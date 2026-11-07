// PF-153 — through the real route and mailer; only nodemailer's network is stubbed.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const request = require('supertest');
const nodemailer = require('nodemailer');
const app = require('../app');
const Contact = require('../models/Contact');
const SentReply = require('../models/SentReply');
const User = require('../models/User');
const { issueSession } = require('../services/sessionService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const sendMail = jest.fn();
const OWNER = 'owner@test.com';

beforeAll(connectTestDB);
beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key';
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
});
afterEach(async () => {
  process.env.RESEND_API_KEY = '';
  await clearDB();
});
afterAll(disconnectTestDB);

const authHeader = async () => {
  const user = await User.create({ email: OWNER, password: 'TestPass@1234!' });
  const { accessToken } = await issueSession(user);
  return { Authorization: `Bearer ${accessToken}` };
};
const makeMessage = (over = {}) => Contact.create({
  name: 'A Visitor', email: 'visitor@example.com', message: 'Are you available?\nThanks.', ...over,
});
const reply = (id, body, headers) => request(app).post(`/api/contact/${id}/reply`).set(headers).send(body);

describe('POST /api/contact/:id/reply', () => {
  it('refuses a signed-out request, and sends nothing', async () => {
    const m = await makeMessage();
    const res = await request(app).post(`/api/contact/${m._id}/reply`).send({ message: 'Hi' });
    expect(res.status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends from the domain, to the visitor, with answers to the owner', async () => {
    const m = await makeMessage();
    const res = await reply(m._id, { message: 'Yes, I am.' }, await authHeader());
    expect(res.status).toBe(200);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.from).toEqual({ name: 'Parindra Gallage', address: 'contact@mail.parindragallage.com' });
    expect(mail.to).toBe('visitor@example.com');
    expect(mail.replyTo).toBe(OWNER);
    expect(mail.subject).toBe('Re: Your message to Parindra Gallage');
    expect(mail.text).toContain('Yes, I am.');
    expect(mail.text).toContain('> Are you available?\n> Thanks.');
  });

  it('is not marked machine-written: a person wrote it (RFC 3834)', async () => {
    const m = await makeMessage();
    await reply(m._id, { message: 'Yes.' }, await authHeader());
    expect(sendMail.mock.calls[0][0].headers['Auto-Submitted']).toBeUndefined();
  });

  it('other emails stay marked', () => {
    const mailer = require('../services/mailer');
    mailer.send({ to: 'a@b.co', subject: 's', text: 't' });
    expect(sendMail.mock.calls[0][0].headers['Auto-Submitted']).toBe('auto-generated');
  });

  // PF-154: the reply is a SENT row of its own, holding what the email held.
  it('records the reply in SENT and makes the message read', async () => {
    const m = await makeMessage();
    const res = await reply(m._id, { message: '  Yes.  ' }, await authHeader());
    expect(res.body.data.read).toBe(true);
    expect(res.body.recorded).toBe(true);
    expect(res.body.data.replies).toEqual([expect.objectContaining({ message: 'Yes.' })]);

    const rows = await SentReply.find().lean();
    expect(rows).toHaveLength(1);
    const mail = sendMail.mock.calls[0][0];
    expect(rows[0]).toMatchObject({
      contact: m._id, toName: 'A Visitor', toEmail: mail.to, subject: mail.subject, message: 'Yes.',
      original: { message: 'Are you available?\nThanks.', receivedAt: m.createdAt },
    });
    expect(rows[0].sentAt).toBeInstanceOf(Date);
    const stored = await Contact.findById(m._id).lean();
    expect(stored.replies).toBeUndefined();
    expect(stored.read).toBe(true);
  });

  it('the message list carries each message\'s replies, oldest first, from SENT only', async () => {
    const m = await makeMessage();
    const other = await makeMessage({ email: 'b@example.com' });
    const headers = await authHeader();
    await reply(m._id, { message: 'First.' }, headers);
    await reply(m._id, { message: 'Second.' }, headers);
    // A PF-153 row's own copy is never shown: SENT is the one source.
    await Contact.collection.updateOne({ _id: other._id }, { $set: { replies: [{ message: 'Old copy', sentAt: new Date() }] } });
    const res = await request(app).get('/api/contact').set(headers);
    const byId = Object.fromEntries(res.body.data.map((d) => [d._id, d]));
    expect(byId[m._id].replies.map((r) => r.message)).toEqual(['First.', 'Second.']);
    expect(byId[other._id].replies).toBeUndefined();
  });

  it('sent but not recorded: still a success, and it says so — never "not sent"', async () => {
    const create = jest.spyOn(SentReply, 'create').mockRejectedValueOnce(new Error('disk full'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const m = await makeMessage();
    const res = await reply(m._id, { message: 'Yes.' }, await authHeader());
    create.mockRestore();
    log.mockRestore();
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(false);
    expect(res.body.data.read).toBe(true);
    expect(await SentReply.countDocuments()).toBe(0);
  });

  it('deleting the message keeps what was sent to it', async () => {
    const m = await makeMessage();
    const headers = await authHeader();
    await reply(m._id, { message: 'Yes.' }, headers);
    await request(app).delete(`/api/contact/${m._id}`).set(headers).expect(204);
    await request(app).post('/api/contact/bulk').set(headers).send({ action: 'delete', ids: [String(m._id)] });
    expect(await SentReply.countDocuments({ contact: m._id })).toBe(1);
  });

  it('escapes both people\'s words in the HTML', async () => {
    const m = await makeMessage({ message: 'Hi <img src=x onerror=alert(1)>' });
    await reply(m._id, { message: 'See <b>this</b>' }, await authHeader());
    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toContain('<b>this');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;b&gt;this');
  });

  it('a failed send says so plainly, keeps nothing and stays unread', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('smtp down'), { code: 'EAUTH' }));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const m = await makeMessage();
    const res = await reply(m._id, { message: 'Yes.' }, await authHeader());
    log.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Your reply wasn't sent. Please try again in a moment.");
    const stored = await Contact.findById(m._id).lean();
    expect(stored.read).toBe(false);
    expect(await SentReply.countDocuments()).toBe(0);
  });

  it('with mail off, says so and sends nothing', async () => {
    process.env.RESEND_API_KEY = '';
    const m = await makeMessage();
    const res = await reply(m._id, { message: 'Yes.' }, await authHeader());
    expect(res.status).toBe(503);
    expect(sendMail).not.toHaveBeenCalled();
    expect(await SentReply.countDocuments()).toBe(0);
  });

  it('an unknown message is a 404', async () => {
    const res = await reply('507f1f77bcf86cd799439011', { message: 'Yes.' }, await authHeader());
    expect(res.status).toBe(404);
  });

  it.each([
    ['nothing', {}],
    ['only spaces', { message: '   ' }],
    ['an array', { message: ['Yes'] }],
    ['too long', { message: 'a'.repeat(3001) }],
  ])('refuses %s and sends nothing', async (_name, body) => {
    const m = await makeMessage();
    const res = await reply(m._id, body, await authHeader());
    expect(res.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('the longest reply fits the body limit, even in a three-byte script', async () => {
    const m = await makeMessage();
    const res = await reply(m._id, { message: 'අ'.repeat(3000) }, await authHeader());
    expect(res.status).toBe(200);
  });
});
