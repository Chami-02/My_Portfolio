// PF-123 — a contact message is saved AND emailed to the owner. The email is
// a NOTIFICATION: it never fails the submission, and never fails silently.
//
// Through the real route, controller and mailer; only nodemailer's network
// call is mocked. The send runs in the background (waitUntil), so each test
// waits for the observable END of that background work — `notifiedAt` set,
// or the log line — never a fixed sleep.
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const request    = require('supertest');
const nodemailer = require('nodemailer');
const app        = require('../app');
const Contact    = require('../models/Contact');
const About      = require('../models/About');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

const ORIGINAL = { ...process.env };
const OWNER    = 'owner@example.com';
const APP_PASSWORD = 'abcdabcdabcdabcd';
const sendMail = jest.fn();

const VALID = Object.freeze({
  name:    'Test Visitor',
  email:   'visitor@example.com',
  message: 'Hello — I would like to talk about a project with you.',
});

// contactLimiter (5 stored per hour) is live under test — each case posts
// from its own address (`trust proxy 1` honours X-Forwarded-For).
let ip = 0;
const post = (body) => request(app).post('/api/contact')
  .set('X-Forwarded-For', `10.123.0.${++ip}`).send(body);

/** Polls until `check()` is truthy; fails the test after `ms`. */
const eventually = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('condition never became true');
    await new Promise((r) => setTimeout(r, 20));
  }
};

let warn, error;

beforeAll(connectTestDB);
beforeEach(() => {
  process.env.GMAIL_USER = OWNER;
  process.env.GMAIL_APP_PASSWORD = APP_PASSWORD;
  sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  nodemailer.createTransport.mockReset().mockReturnValue({ sendMail });
  warn  = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  process.env = { ...ORIGINAL };
  warn.mockRestore();
  error.mockRestore();
  await clearDB();
});
afterAll(disconnectTestDB);

describe('POST /api/contact — the owner is emailed (PF-123)', () => {
  it('saves the message, answers 201, emails the owner, and records notifiedAt', async () => {
    const res = await post(VALID);
    expect(res.status).toBe(201);

    const saved = await eventually(async () => {
      const doc = await Contact.findOne({ email: VALID.email });
      return doc?.notifiedAt && doc;
    });
    expect(saved.notifiedAt).toBeInstanceOf(Date);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('sends it TO the owner, with Reply-To the visitor, in text AND html', async () => {
    await post(VALID);
    await eventually(() => sendMail.mock.calls.length);

    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe(OWNER);
    expect(mail.replyTo).toBe(VALID.email);
    expect(mail.subject).toBe(`New portfolio message from ${VALID.name}`);
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain(VALID.message);
      expect(body).toContain(VALID.email);
      expect(body).toContain('This message is saved in the Messages section of the admin panel.');
      expect(body).toContain('Please reply within 24 hours!!');
    }
  });

  // Owner's layout (2026-10-20): Date and Time on separate lines, YYYY/MM/DD,
  // 12-hour clock with AM/PM, in the owner's zone. Expected values are worked out by
  // plain offset arithmetic (Asia/Colombo is UTC+5:30, Asia/Tokyo UTC+9, no
  // daylight saving in either) — independent of the Intl code under test.
  const expectedIn = (createdAt, offsetMinutes) => {
    const iso = new Date(createdAt.getTime() + offsetMinutes * 60_000).toISOString();
    const h24 = Number(iso.slice(11, 13));
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return {
      date: iso.slice(0, 10).replace(/-/g, '/'),
      time: `${h12}:${iso.slice(14, 16)} ${h24 < 12 ? 'AM' : 'PM'}`,
    };
  };

  it('dates it YYYY/MM/DD with the 12-hour time on its own line, in Asia/Colombo by default', async () => {
    await post(VALID);
    await eventually(() => sendMail.mock.calls.length);

    const saved = await Contact.findOne({ email: VALID.email });
    const { date, time } = expectedIn(saved.createdAt, 330);
    const { text, html } = sendMail.mock.calls[0][0];
    expect(text).toContain(`\nDate:  ${date}\nTime:  ${time} (Asia/Colombo)\n`);
    expect(html).toContain(`<b>Date:</b> ${date}<br><b>Time:</b> ${time} (Asia/Colombo)`);
  });

  it('follows the About panel time zone (one field, every render site)', async () => {
    await About.create({ timezone: 'Asia/Tokyo' });
    await post(VALID);
    await eventually(() => sendMail.mock.calls.length);

    const saved = await Contact.findOne({ email: VALID.email });
    const { date, time } = expectedIn(saved.createdAt, 540);
    expect(sendMail.mock.calls[0][0].text).toContain(`Date:  ${date}\nTime:  ${time} (Asia/Tokyo)`);
  });

  it('the reply reminder is red, below a solid line, in the html version', async () => {
    await post(VALID);
    await eventually(() => sendMail.mock.calls.length);

    const { html } = sendMail.mock.calls[0][0];
    const hr = html.indexOf('<hr style="border:none;border-top:1px solid');
    expect(hr).toBeGreaterThan(html.indexOf(VALID.message));
    expect(html).toMatch(/<p style="[^"]*color:#d32f2f[^"]*">Please reply within 24 hours!!<\/p>/);
    expect(html.indexOf('Please reply')).toBeGreaterThan(html.indexOf('This message is saved'));
  });

  it('everything the visitor typed is ESCAPED in the html — no markup, no links', async () => {
    await post({
      ...VALID,
      name:    '<b>Eve</b>',
      message: 'Click <a href="https://evil.example">here</a> & "win" <script>x()</script>',
    });
    await eventually(() => sendMail.mock.calls.length);

    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toMatch(/<a |<script|<b>Eve/);
    expect(html).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;here&lt;/a&gt; &amp; &quot;win&quot;');
  });

  it('a line break in the name can never reach the subject (no forged headers)', async () => {
    await post({ ...VALID, name: 'Eve\r\nBcc: victim@example.com' });
    await eventually(() => sendMail.mock.calls.length);

    const { subject } = sendMail.mock.calls[0][0];
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe('New portfolio message from Eve Bcc: victim@example.com');
  });

  it('a FAILED send still answers 201, keeps the message, leaves notifiedAt null, and logs it', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH' }));

    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/received/i);

    await eventually(() => error.mock.calls.length);
    const saved = await Contact.findOne({ email: VALID.email });
    expect(saved).not.toBeNull();
    expect(saved.notifiedAt).toBeNull();

    // The line names the failure — and never carries the app password.
    const line = error.mock.calls.flat().join(' ');
    expect(line).toMatch(/Contact email failed/);
    expect(line).toMatch(/EAUTH/);
    expect(line).not.toContain(APP_PASSWORD);
  });

  it('the visitor never waits for Gmail: 201 arrives while the send is still pending', async () => {
    let finish;
    sendMail.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(sendMail).toHaveBeenCalledTimes(1);   // started, not settled
    expect((await Contact.findOne({ email: VALID.email })).notifiedAt).toBeNull();

    finish({ messageId: 'x' });
    await eventually(async () => (await Contact.findOne({ email: VALID.email })).notifiedAt);
  });

  it('with mail NOT configured: saved, 201, nothing sent, and a warning says so', async () => {
    delete process.env.GMAIL_APP_PASSWORD;

    const res = await post(VALID);
    expect(res.status).toBe(201);

    await eventually(() => warn.mock.calls.length);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/not configured/);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect((await Contact.findOne({ email: VALID.email })).notifiedAt).toBeNull();
  });

  it('a refused (400) submission emails nothing', async () => {
    const res = await post({ ...VALID, message: 'short' });
    expect(res.status).toBe(400);
    await new Promise((r) => setTimeout(r, 100));
    expect(sendMail).not.toHaveBeenCalled();
  });

  // PF-123 — the sender's approximate location, from Vercel's IP headers.
  const ON_VERCEL_FROM_NY = {
    'x-vercel-ip-city': 'New%20York', 'x-vercel-ip-country-region': 'NY', 'x-vercel-ip-country': 'US',
  };

  it('on Vercel: saves the location and shows it in the email (text and html)', async () => {
    process.env.VERCEL = '1';
    await post(VALID).set(ON_VERCEL_FROM_NY);
    await eventually(() => sendMail.mock.calls.length);

    expect((await Contact.findOne({ email: VALID.email })).location).toBe('New York, NY, United States');
    const { text, html } = sendMail.mock.calls[0][0];
    expect(text).toMatch(/\(Asia\/Colombo\)\nFrom:  New York, NY, United States \(approx\.\)\n/);
    expect(html).toContain('<br><b>From:</b> New York, NY, United States (approx.)</p>');
  });

  it('the location is ESCAPED in the html', async () => {
    process.env.VERCEL = '1';
    await post(VALID).set({ 'x-vercel-ip-city': '%3Cb%3EEvil%3C%2Fb%3E' });
    await eventually(() => sendMail.mock.calls.length);
    expect(sendMail.mock.calls[0][0].html).toContain('<b>From:</b> &lt;b&gt;Evil&lt;/b&gt; (approx.)');
  });

  it('no location → null, and no From line in the email', async () => {
    await post(VALID).set(ON_VERCEL_FROM_NY);   // off Vercel: headers ignored
    await eventually(() => sendMail.mock.calls.length);

    expect((await Contact.findOne({ email: VALID.email })).location).toBeNull();
    const { text, html } = sendMail.mock.calls[0][0];
    expect(text).not.toMatch(/From:/);
    expect(html).not.toMatch(/From:/);
  });

  it('a visitor cannot set their own location in the body', async () => {
    process.env.VERCEL = '1';
    await post({ ...VALID, location: 'Paris, France' });
    await eventually(() => sendMail.mock.calls.length);
    expect((await Contact.findOne({ email: VALID.email })).location).toBeNull();
  });

  it('a visitor cannot set notifiedAt themselves', async () => {
    sendMail.mockRejectedValue(new Error('down'));
    await post({ ...VALID, notifiedAt: '2020-01-01T00:00:00.000Z' });
    await eventually(() => error.mock.calls.length);
    expect((await Contact.findOne({ email: VALID.email })).notifiedAt).toBeNull();
  });
});

// Fixed instants, so the 12-hour clock is pinned at ANY time of day the suite
// runs (through the route, one run only ever sees one half of the day).
describe('formatSent (PF-123)', () => {
  const { formatSent } = require('../controllers/contactController');

  it.each([
    ['afternoon is PM, never 15',          '2026-01-05T09:37:00Z', 'Asia/Colombo', '2026/01/05', '3:07 PM'],
    ['morning is AM',                      '2026-01-05T03:35:00Z', 'Asia/Colombo', '2026/01/05', '9:05 AM'],
    ['noon is 12 PM',                      '2026-06-01T06:30:00Z', 'Asia/Colombo', '2026/06/01', '12:00 PM'],
    ['crosses midnight into the next day', '2026-12-31T19:00:00Z', 'Asia/Colombo', '2027/01/01', '12:30 AM'],
    ['midnight is 12 AM, never 0',         '2026-03-09T15:00:00Z', 'Asia/Tokyo',   '2026/03/10', '12:00 AM'],
  ])('%s', (_label, iso, zone, date, time) => {
    expect(formatSent(new Date(iso), zone)).toEqual({ date, time });
  });
});
