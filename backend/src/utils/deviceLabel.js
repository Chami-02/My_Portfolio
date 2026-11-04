// backend/src/utils/deviceLabel.js
//
// PF-132 — "Chrome on macOS" from a User-Agent header, for the Settings
// Sessions card. Only this label is stored, never the raw header: it is all
// the card shows, and a full User-Agent is a fingerprint (data minimisation).
//
// Hand-written rather than `ua-parser-js`: its v2 is AGPL-licensed, and the
// card needs the handful of browsers and systems below, not every device.
//
// ⚠️ ORDER IS THE LOGIC. Every Chromium browser also says "Chrome/" and
// "Safari/", and every iPhone says "like Mac OS X" — so the more specific
// name must be tested first. iPadOS 13+ sends a Mac User-Agent on purpose
// (desktop-class sites), so an iPad reads as macOS; no header can tell them
// apart, and the label stays true to what the browser claims.

const BROWSERS = [
  ['Edge',    /Edg(e|A|iOS)?\//],
  ['Opera',   /OPR\/|Opera/],
  ['Samsung Internet', /SamsungBrowser\//],
  ['Firefox', /Firefox\/|FxiOS\//],
  ['Chrome',  /Chrome\/|CriOS\//],
  ['Safari',  /Version\/[\d.]+.*Safari\//],
];

const SYSTEMS = [
  ['iOS',      /iPhone|iPad|iPod/],
  ['Android',  /Android/],
  ['ChromeOS', /CrOS/],
  ['Windows',  /Windows/],
  ['macOS',    /Mac OS X|Macintosh/],
  ['Linux',    /Linux/],
];

const first = (list, ua) => list.find(([, pattern]) => pattern.test(ua))?.[0];

/**
 * @param {unknown} userAgent the raw `User-Agent` header
 * @returns {string} "Browser on OS", either half alone, or "Unknown device"
 */
const deviceLabel = (userAgent) => {
  if (typeof userAgent !== 'string' || userAgent.length === 0) return 'Unknown device';
  // A real User-Agent is a few hundred characters; testing a longer one
  // buys nothing and costs regex time on a header the client controls.
  const ua = userAgent.slice(0, 512);
  const browser = first(BROWSERS, ua);
  const system  = first(SYSTEMS, ua);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
};

// PF-145 — the visitor counter's halves of the same header. Only these short
// words are counted, never the header itself.

// Crawlers, link previews, uptime checks and scripted browsers. A browser
// always sends a User-Agent, so a missing one counts as a bot too.
const BOT = /bot\b|bot[/;-]|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget|python|node-fetch|axios\/|go-http|java\/|okhttp|postman|insomnia|phantomjs|selenium|puppeteer|playwright/i;

const isBot = (userAgent) => typeof userAgent !== 'string'
  || userAgent.length === 0
  || BOT.test(userAgent.slice(0, 512));

/** "Chrome", or "Other" when it is none of the browsers above. */
const browserName = (userAgent) => first(BROWSERS, String(userAgent).slice(0, 512)) ?? 'Other';

/**
 * 'phone' | 'tablet' | 'desktop'. An Android tablet leaves "Mobile" out of its
 * header (Google's own advice to site owners); an iPad claims to be a Mac, so
 * it reads as desktop — see the note at the top of this file.
 */
const deviceType = (userAgent) => {
  const ua = String(userAgent).slice(0, 512);
  if (/iPad|Tablet/.test(ua)) return 'tablet';
  if (/iPhone|iPod|Mobile/.test(ua)) return 'phone';
  if (/Android/.test(ua)) return 'tablet';
  return 'desktop';
};

module.exports = { deviceLabel, isBot, browserName, deviceType };
