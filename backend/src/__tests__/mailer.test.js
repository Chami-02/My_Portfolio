// PF-123 — the mailer adapter. nodemailer is mocked at createTransport, so
// nothing here touches the network and the suite needs no Resend account.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const nodemailer = require('nodemailer');
const mailer     = require('../services/mailer');

const ORIGINAL = { ...process.env };
const sendMail = jest.fn();

const setKey = (key) => {
  if (key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = key;
};

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
});
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('mailer.isConfigured', () => {
  it('is true when the API key is set', () => {
    setKey('re_test_key');
    expect(mailer.isConfigured()).toBe(true);
  });

  it.each([
    ['no key',    undefined],
    ['blank key', ''],
  ])('is false with %s', (_label, key) => {
    setKey(key);
    expect(mailer.isConfigured()).toBe(false);
  });

  it('reads the environment at call time, not at load', () => {
    setKey(undefined);
    expect(mailer.isConfigured()).toBe(false);
    setKey('re_test_key');
    expect(mailer.isConfigured()).toBe(true);
  });
});

describe('mailer.send', () => {
  beforeEach(() => setKey('re_test_key'));

  it('uses Resend SMTP over TLS with the API key, and short timeouts', async () => {
    await mailer.send({ to: 'owner@example.com', subject: 's', text: 't' });

    const opts = nodemailer.createTransport.mock.calls[0][0];
    expect(opts).toMatchObject({
      host: 'smtp.resend.com', port: 465, secure: true,
      auth: { user: 'resend', pass: 're_test_key' },
    });
    // A hung connection must not hold a background send open for minutes.
    for (const t of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) {
      expect(opts[t]).toBeGreaterThan(0);
      expect(opts[t]).toBeLessThanOrEqual(15_000);
    }
  });

  it('sends as no-reply by default, with no Reply-To', async () => {
    await mailer.send({ to: 'owner@example.com', subject: 's', text: 't' });

    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({
      from: { name: 'Portfolio security', address: 'no-reply@mail.parindragallage.com' },
      to: 'owner@example.com', subject: 's', text: 't',
    });
    expect(mail.replyTo).toBeUndefined();
    expect(mail.html).toBeUndefined();   // text-only unless a caller adds html
  });

  it('sends as contact when asked, passing replyTo through', async () => {
    await mailer.send({ sender: 'contact', to: 'owner@example.com', subject: 's', text: 't', replyTo: 'v@example.com' });

    const mail = sendMail.mock.calls[0][0];
    expect(mail.from).toEqual({ name: 'Portfolio', address: 'contact@mail.parindragallage.com' });
    expect(mail.replyTo).toBe('v@example.com');
    expect(mail).not.toHaveProperty('sender');   // nodemailer's `sender` is a real header
  });

  it.each(['security', 'contact'])('marks %s mail as machine-written (RFC 3834)', async (sender) => {
    await mailer.send({ sender, to: 'o@example.com', subject: 's', text: 't' });
    expect(sendMail.mock.calls[0][0].headers).toEqual({ 'Auto-Submitted': 'auto-generated' });
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
