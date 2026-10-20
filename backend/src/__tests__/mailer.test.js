// PF-123 — the mailer adapter. nodemailer is mocked at createTransport, so
// nothing here touches the network and the suite needs no Gmail account.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const nodemailer = require('nodemailer');
const mailer     = require('../services/mailer');

const ORIGINAL = { ...process.env };
const sendMail = jest.fn();

const setCreds = (user, pass) => {
  if (user === undefined) delete process.env.GMAIL_USER;         else process.env.GMAIL_USER = user;
  if (pass === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = pass;
};

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
});
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('mailer.isConfigured', () => {
  it('is true only when BOTH the address and the app password are set', () => {
    setCreds('owner@example.com', 'abcdabcdabcdabcd');
    expect(mailer.isConfigured()).toBe(true);
  });

  it.each([
    ['no address',  [undefined, 'abcdabcdabcdabcd']],
    ['no password', ['owner@example.com', undefined]],
    ['both blank',  ['', '']],
  ])('is false with %s', (_label, creds) => {
    setCreds(...creds);
    expect(mailer.isConfigured()).toBe(false);
  });

  it('reads the environment at call time, not at load', () => {
    setCreds(undefined, undefined);
    expect(mailer.isConfigured()).toBe(false);
    setCreds('owner@example.com', 'abcdabcdabcdabcd');
    expect(mailer.isConfigured()).toBe(true);
  });
});

describe('mailer.send', () => {
  beforeEach(() => setCreds('owner@example.com', 'abcdabcdabcdabcd'));

  it('uses Gmail SMTP over TLS with the app password, and short timeouts', async () => {
    await mailer.send({ to: 'owner@example.com', subject: 's', text: 't' });

    const opts = nodemailer.createTransport.mock.calls[0][0];
    expect(opts).toMatchObject({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: 'owner@example.com', pass: 'abcdabcdabcdabcd' },
    });
    // A hung connection must not hold a background send open for minutes.
    for (const t of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) {
      expect(opts[t]).toBeGreaterThan(0);
      expect(opts[t]).toBeLessThanOrEqual(15_000);
    }
  });

  it('sends from the account itself, passing text and replyTo through', async () => {
    await mailer.send({ to: 'owner@example.com', subject: 's', text: 't', replyTo: 'v@example.com' });

    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({
      from: { name: 'Portfolio', address: 'owner@example.com' },
      to: 'owner@example.com', subject: 's', text: 't', replyTo: 'v@example.com',
    });
    expect(mail.html).toBeUndefined();   // text-only unless a caller adds html
  });

  it('passes an html version through when the caller gives one (multipart)', async () => {
    await mailer.send({ to: 'o@example.com', subject: 's', text: 't', html: '<p>t</p>' });
    expect(sendMail.mock.calls[0][0]).toMatchObject({ text: 't', html: '<p>t</p>' });
  });

  it('rejects when the send fails, so the caller decides what that means', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH' }));
    await expect(mailer.send({ to: 'a@b.co', subject: 's', text: 't' })).rejects.toThrow('Invalid login');
  });
});
