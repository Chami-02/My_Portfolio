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
});
