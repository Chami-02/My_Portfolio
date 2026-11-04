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

export function sendVisit(payload) {
  fetch(apiUrl('/visits'), {
    method:      'POST',
    keepalive:   true,
    credentials: 'omit',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
  }).catch(() => {});
}
