// PF-125 — the security-alert email template.
const { renderAlert } = require('../services/alertEmail');

const BASE = Object.freeze({
  tone:    'warning',
  title:   'Your admin password was changed',
  intro:   'Every device has been signed out.',
  details: [['Address', 'owner@example.com'], ['From', 'Colombo, Sri Lanka (approx.)']],
  note:    "If this wasn't you, reset it again.",
});

describe('renderAlert', () => {
  it('escapes every value that reaches the HTML — an address cannot become markup', () => {
    const { html } = renderAlert({
      ...BASE,
      title:   '<img src=x onerror=alert(1)>',
      details: [['Address', '"><a href="https://evil.example">click</a>']],
    });
    expect(html).not.toMatch(/<img src=x/i);
    expect(html).not.toMatch(/<a href="https:\/\/evil/i);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;&gt;&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('a plain-text version carries the same content, for mail apps with no HTML', () => {
    const { text } = renderAlert({ ...BASE, highlight: '123456' });
    expect(text).toContain(BASE.title);
    expect(text).toContain('123456');
    expect(text).toContain('Address: owner@example.com');
    expect(text).toContain(BASE.note);
    expect(text).not.toMatch(/</);
  });

  it.each([
    ['info',    'SECURITY CODE',  '#B26B00'],
    ['warning', 'SECURITY ALERT', '#B4231F'],
  ])('tone %s has its label and colour', (tone, label, colour) => {
    const { html } = renderAlert({ ...BASE, tone });
    expect(html).toContain(label);
    expect(html).toContain(colour);
  });

  it('wears the site brand: navy header, accent rule', () => {
    const { html } = renderAlert(BASE);
    expect(html).toContain('#14213D');
    expect(html).toContain('#FCA311');
  });

  it('leaves out the code box, rows and note when there are none', () => {
    const { html } = renderAlert({ tone: 'info', title: 'T', intro: 'I' });
    expect(html).not.toContain('letter-spacing:10px');   // the code box
    expect(html).not.toContain('text-transform:uppercase;color:#5b6270;width:110px'); // a row
  });

  // PF-133 (owner, 2026-10-29): "if it is not you" must say WHAT to do.
  it('numbers the NOT YOU steps in both versions, escaped', () => {
    const { text, html } = renderAlert({ ...BASE, steps: ['Change it', 'Sign out <b>them</b>'] });
    expect(text).toContain('NOT YOU? DO THIS NOW\n1. Change it\n2. Sign out <b>them</b>');
    expect(html).toContain('NOT YOU? DO THIS NOW');
    expect(html).toContain('<li>Change it</li><li>Sign out &lt;b&gt;them&lt;/b&gt;</li>');
  });

  it('a button to a web address, in both versions', () => {
    const { text, html } = renderAlert({ ...BASE, action: { label: 'OPEN ADMIN', url: 'https://site.example/admin?a=1&b=2' } });
    expect(html).toContain('<a href="https://site.example/admin?a=1&amp;b=2"');
    expect(html).toContain('>OPEN ADMIN</a>');
    expect(text).toContain('OPEN ADMIN: https://site.example/admin?a=1&b=2');
  });

  it.each(['javascript:alert(1)', '//evil.example', ''])('never links to %j', (url) => {
    const { text, html } = renderAlert({ ...BASE, action: { label: 'OPEN ADMIN', url } });
    expect(html).not.toContain('<a ');
    expect(text).not.toContain('OPEN ADMIN');
  });

  it('no steps block and no button when none are given', () => {
    const { text, html } = renderAlert(BASE);
    expect(text).not.toContain('NOT YOU');
    expect(html).not.toContain('NOT YOU');
    expect(html).not.toContain('<a ');
  });
});
