// PF-153 — through the real route and mailer; only nodemailer's network is stubbed.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const request = require('supertest');
const nodemailer = require('nodemailer');
const app = require('../app');
const Contact = require('../models/Contact');
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

  it('keeps the reply and makes the message read', async () => {
    const m = await makeMessage();
    const res = await reply(m._id, { message: '  Yes.  ' }, await authHeader());
    expect(res.body.data.read).toBe(true);
    const stored = await Contact.findById(m._id).lean();
    expect(stored.replies).toHaveLength(1);
    expect(stored.replies[0].message).toBe('Yes.');
    expect(stored.replies[0].sentAt).toBeInstanceOf(Date);
    expect(stored.read).toBe(true);
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
    expect(stored.replies).toBeUndefined();
    expect(stored.read).toBe(false);
  });

  it('with mail off, says so and sends nothing', async () => {
    process.env.RESEND_API_KEY = '';
    const m = await makeMessage();
    const res = await reply(m._id, { message: 'Yes.' }, await authHeader());
    expect(res.status).toBe(503);
    expect(sendMail).not.toHaveBeenCalled();
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
