// ── The security-alert email template (PF-125, owner 2026-10-27) ─────────────
// One look for every security email the site sends: the reset code and
// "password changed" now; PF-124's change, PF-133's sign-in alerts and PF-140's
// passkey alerts later. The CONTACT email keeps its own plain template
// (contactController) — the owner asked for the two to differ.
//
// Built the way email has to be: tables + inline styles only (Gmail strips
// <style> blocks and ignores flex/grid), web-safe font stacks, explicit colours
// on every element so a mail app's dark mode has nothing to guess.
//
// The site's palette (frontend/src/styles/tokens.css): navy surface #14213D,
// accent #FCA311. The tone colours are darkened so they read on the white card:
// `info` is the accent taken down to #B26B00, `warning` is the red the sign-in
// banner tints with (180,35,31). The site's own --danger #f87171 is made for a
// dark background and fails contrast on white.
//
// ⚠️ Every value that reaches the HTML is escaped here — callers pass plain
// text. A typed address or a location string can never become markup.

const { escapeHtml } = require('../utils/escapeHtml');

const NAVY   = '#14213D';
const ACCENT = '#FCA311';
const INK    = '#1a1a1a';
const MUTED  = '#5b6270';

const TONES = {
  info:    { colour: '#B26B00', tint: '#FFF6E5', label: 'SECURITY CODE' },
  warning: { colour: '#B4231F', tint: '#FDECEC', label: 'SECURITY ALERT' },
};

const SANS = 'Arial,Helvetica,sans-serif';
const MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";

/**
 * @param {{
 *   tone: 'info' | 'warning',
 *   title: string,
 *   intro: string,
 *   highlight?: string,            shown huge and spaced — a one-time code
 *   details?: Array<[string, string]>,
 *   note?: string,                 the "if this wasn't you" line
 *   steps?: string[],              PF-133: "NOT YOU? DO THIS NOW", numbered
 *   action?: { label, url },       PF-133: one button (http/https only)
 * }} alert
 * @returns {{ text: string, html: string }}
 */
const renderAlert = ({ tone, title, intro, highlight, details = [], note, steps = [], action }) => {
  const t = TONES[tone];
  const e = escapeHtml;
  // A link only to a web address — never `javascript:` or anything else a
  // misconfigured FRONTEND_URL could smuggle into an href.
  const button = action && /^https?:\/\//i.test(action.url) ? action : null;

  const text = [
    title,
    '',
    intro,
    ...(highlight ? ['', `    ${highlight}`, ''] : []),
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(note ? ['', note] : []),
    ...(steps.length ? ['', 'NOT YOU? DO THIS NOW', ...steps.map((step, i) => `${i + 1}. ${step}`)] : []),
    ...(button ? ['', `${button.label}: ${button.url}`] : []),
    '',
    '— PARINDRA.DEV · Portfolio CMS security',
  ].join('\n');

  const rows = details.map(([label, value]) => `
<tr>
<td style="padding:6px 0;font-family:${MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};width:110px;vertical-align:top">${e(label)}</td>
<td style="padding:6px 0;font-family:${SANS};font-size:14px;color:${INK}">${e(value)}</td>
</tr>`).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF0F4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F4;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DDE1E8">

<tr><td style="background:${NAVY};padding:20px 28px">
<span style="font-family:${MONO};font-size:14px;font-weight:bold;letter-spacing:2px;color:#FFFFFF">PARINDRA<span style="color:${ACCENT}">.</span>DEV</span>
<span style="font-family:${MONO};font-size:10px;letter-spacing:2px;color:#AEB6C6;padding-left:10px">PORTFOLIO CMS</span>
</td></tr>
<tr><td style="background:${ACCENT};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>

<tr><td style="padding:28px 28px 8px">
<span style="display:inline-block;font-family:${MONO};font-size:10px;font-weight:bold;letter-spacing:2px;color:${t.colour};background:${t.tint};border:1px solid ${t.colour};border-radius:999px;padding:5px 12px">${t.label}</span>
<h1 style="margin:16px 0 10px;font-family:${SANS};font-size:22px;line-height:1.3;color:${NAVY}">${e(title)}</h1>
<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">${e(intro)}</p>
</td></tr>
${highlight ? `
<tr><td style="padding:18px 28px 6px">
<div style="background:${t.tint};border-left:4px solid ${t.colour};border-radius:10px;padding:18px;text-align:center;font-family:${MONO};font-size:34px;font-weight:bold;letter-spacing:10px;color:${NAVY}">${e(highlight)}</div>
</td></tr>` : ''}
${rows ? `
<tr><td style="padding:16px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E6E9EF">${rows}
</table>
</td></tr>` : ''}
${note ? `
<tr><td style="padding:14px 28px 4px">
<p style="margin:0;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${t.colour};font-weight:bold">${e(note)}</p>
</td></tr>` : ''}
${steps.length ? `
<tr><td style="padding:16px 28px 4px">
<div style="background:${t.tint};border-left:4px solid ${t.colour};border-radius:10px;padding:14px 18px">
<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;font-weight:bold;letter-spacing:2px;color:${t.colour}">NOT YOU? DO THIS NOW</p>
<ol style="margin:0;padding-left:20px;font-family:${SANS};font-size:14px;line-height:1.7;color:${INK}">${steps.map((step) => `<li>${e(step)}</li>`).join('')}</ol>
</div>
</td></tr>` : ''}
${button ? `
<tr><td style="padding:18px 28px 4px">
<a href="${e(button.url)}" style="display:inline-block;background:${NAVY};color:#FFFFFF;font-family:${MONO};font-size:12px;font-weight:bold;letter-spacing:2px;text-decoration:none;border-radius:999px;padding:12px 22px">${e(button.label)}</a>
</td></tr>` : ''}

<tr><td style="padding:24px 28px 26px">
<p style="margin:0;padding-top:16px;border-top:1px solid #E6E9EF;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED}">
You receive this because this address is an admin login for parindra.dev's Portfolio CMS.
</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  return { text, html };
};

module.exports = { renderAlert };
