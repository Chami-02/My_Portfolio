// frontend/src/utils/visits.js
//
// PF-145 — the browser's half of the visitor counter. The server decides what
// is stored (backend visitController); this decides what is sent at all.
//
// A plain `fetch`, not `api.js`: that client attaches the admin's token and
// redirects on a 401, and a count is neither signed in nor worth retrying.
// `keepalive` lets a count finish while the page is being left; a failure is
// swallowed because a visitor must never notice the counter.

import { apiUrl } from '../services/api';
import { session } from '../services/session';
import { isAdminPath } from './nav';

/** The visitor's browser asked not to be followed. The privacy page promises this. */
const askedNotToBeCounted = () => navigator.globalPrivacyControl === true
  || navigator.doNotTrack === '1'
  || window.doNotTrack === '1';

export function shouldCount(pathname) {
  return !isAdminPath(pathname)
    && !session.isOwnerDevice()
    && !navigator.webdriver
    && !askedNotToBeCounted();
}

/** The site the visitor came from, or undefined when it was this site or none. */
export function outsideReferrer(referrer = document.referrer) {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).origin === window.location.origin ? undefined : referrer;
  } catch {
    return undefined;
  }
}

/** Which counted link an anchor is: 'email' | 'cv' | 'github' | 'live' | null. */
export function linkKind(anchor) {
  if (anchor.dataset.visitLink) return anchor.dataset.visitLink;
  const { protocol, hostname, href } = anchor;
  if (protocol === 'mailto:') return 'email';
  if (href === new URL(apiUrl('/resume'), window.location.href).href) return 'cv';
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'github';
  return null;
}

/** PF-149 — the home page's sections, as the backend's fixed list has them. */
export const HOME_SECTIONS = ['hero', 'about', 'skills', 'projects', 'blog', 'contact'];

/**
 * Half of the section has been on screen, or half the screen is showing it. The
 * second half matters for a section taller than two screens, which could never
 * show half of itself at once.
 */
export function hasReached(visiblePx, sectionPx, viewportPx) {
  return visiblePx > 0 && visiblePx >= Math.min(sectionPx, viewportPx) / 2;
}

// ── An engaged visit (owner, 2026-11-06) ────────────────────────────────────
//
// Nothing is sent until the visitor proves they meant to be here, by the rule
// Google Analytics uses for an "engaged session": longer than 10 seconds, or a
// key event (here, a click on a counted link), or a second page. Someone gone
// sooner, or an automated browser that loads a page and leaves, counts nothing.
// Automated browsers that wait or click still get through, so this is a filter,
// not proof. /privacy says the same in plain words.

export const ENGAGED_AFTER_MS = 10_000;

let engaged = false;
let waiting = [];

/** Sent now if the visitor is engaged, otherwise held until they are. */
export function countVisit(payload) {
  if (session.isOwnerDevice()) return;
  if (engaged) sendVisit(payload);
  else waiting.push(payload);
}

export function markEngaged() {
  engaged = true;
  const held = waiting;
  waiting = [];
  // Asked again: signing in during those 10 seconds makes this the owner.
  if (!session.isOwnerDevice()) held.forEach(sendVisit);
}

/**
 * Runs `done` after this much time with the tab showing: a tab opened behind
 * others has not been looked at. Answers the function that stops it.
 */
function afterVisibleTime(ms, done) {
  let timer = null;
  let startedAt = null;
  let shownMs = 0;

  const pause = () => {
    if (startedAt === null) return;
    shownMs += Date.now() - startedAt;
    startedAt = null;
    clearTimeout(timer);
  };
  const stop = () => {
    pause();
    document.removeEventListener('visibilitychange', onChange);
  };
  const resume = () => {
    if (startedAt !== null) return;
    startedAt = Date.now();
    // Stopped first: coming back to the tab later must not run it a second time.
    timer = setTimeout(() => { stop(); done(); }, ms - shownMs);
  };
  const onChange = () => (document.visibilityState === 'hidden' ? pause() : resume());

  document.addEventListener('visibilitychange', onChange);
  if (document.visibilityState !== 'hidden') resume();
  return stop;
}

export function startEngagementClock() {
  return afterVisibleTime(ENGAGED_AFTER_MS, markEngaged);
}

// ── A read (owner, 2026-11-07) ──────────────────────────────────────────────
//
// 6 seconds with the post showing. A read also confirms the visit, like a counted
// click: otherwise someone leaving after 7 seconds is a read with no visit, and
// the two public numbers would disagree. The server allows one a day per person
// per post; the session mark below only saves a request. /privacy says all this.

export const READ_AFTER_MS = 6_000;

const READ_KEY = (slug) => `pg-viewed-${slug}`;

/**
 * Written BEFORE the request. ⚠️ `sessionStorage` throws outright in some privacy
 * modes, and a counter must never break the page: the answer is then "already
 * counted", which under-counts rather than counting every time.
 */
function claimRead(slug) {
  try {
    if (sessionStorage.getItem(READ_KEY(slug))) return false;
    sessionStorage.setItem(READ_KEY(slug), '1');
    return true;
  } catch {
    return false;
  }
}

/** Starts the post's clock, if this visitor is one to count. Answers its stop. */
export function startReadClock(slug) {
  if (!shouldCount(window.location.pathname)) return () => {};
  return afterVisibleTime(READ_AFTER_MS, () => {
    // Asked again: signing in during those 6 seconds makes this the owner.
    if (session.isOwnerDevice()) return;
    if (claimRead(slug)) sendVisit({ type: 'read', slug });
    // Whatever the mark says: everyone who reads a post is a visit (owner).
    markEngaged();
  });
}

/** Tests only: this state lasts as long as the page, so each test starts it fresh. */
export function resetEngagement() {
  engaged = false;
  waiting = [];
}

export function sendVisit(payload) {
  fetch(apiUrl('/visits'), {
    method:      'POST',
    keepalive:   true,
    credentials: 'omit',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
  }).catch(() => {});
}
