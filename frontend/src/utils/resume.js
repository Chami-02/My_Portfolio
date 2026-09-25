// frontend/src/utils/resume.js
//
// PF-112 — where a DOWNLOAD CV anchor points, in one place.
//
// WHY THIS FILE EXISTS. These constants lived in ContactSection.jsx, which was
// the only consumer while the hero's CTA was still a hardcoded `href="#contact"`
// (PF-87 wired one of the prototype's two `[data-cv]` elements and deferred the
// other). PF-112 wires the second, and the same trigger applies that moved
// formatMonth into blogMeta.js in PF-98: a second consumer is when a local
// helper becomes shared.
//
// ⚠️ It is the THREE ATTRIBUTES TOGETHER that matter, which is why this exports
// a function rather than three strings. The empty state is not just a different
// href — it also has to drop `download` and add the explanatory title, and a
// copy of this logic that got two of the three right would look completely
// normal while behaving wrong.

import { apiUrl } from '../services/api';

/**
 * Where `DOWNLOAD CV` points when there is no résumé to download.
 *
 * ⚠️ This is the PROTOTYPE'S OWN empty state, not a fallback invented here. The
 * markup's `href="#contact" download` looks like the same dead-anchor artefact
 * as PF-86's `href="#blog"`, and it is not — `applyResume()` (Portfolio
 * Revolution.dc.html:675) rewrites it at runtime over BOTH `[data-cv]`
 * elements, the hero CTA (line 119) and Contact's (line 505):
 *
 *   résumé present → href = the file, download = its name, title removed
 *   résumé absent  → href = '#contact', download removed,
 *                    title = 'Upload a résumé in the admin panel to enable this'
 *
 * So the design does answer the empty-state question: always show the button,
 * leave it inert, and explain why on hover.
 */
export const CV_EMPTY_HREF  = '#contact';
export const CV_EMPTY_TITLE = 'Upload a résumé in the admin panel to enable this';

/**
 * The public download endpoint — `GET /api/resume`, a 302 to the forced-download
 * URL. Its own mount rather than `/api/about/resume` so the URL is short and
 * survives every replacement (resumeRoutes.js).
 *
 * Built with `apiUrl()` rather than a literal `/api/resume`, because the backend
 * is on a different origin in production: a hardcoded path in an href would 404
 * on the live site while working fine behind the dev proxy.
 */
export const CV_HREF = apiUrl('/resume');

/**
 * Spread onto a DOWNLOAD CV anchor. `hasResume` is `About.hasResume`, a schema
 * virtual (models/About.js) — true only when a url is actually stored, so a
 * crash between upload and save reads as "no résumé" rather than producing a
 * broken download.
 */
export const cvAnchorProps = (hasResume) =>
  hasResume
    ? { href: CV_HREF,       download: true,  title: undefined }
    : { href: CV_EMPTY_HREF, download: false, title: CV_EMPTY_TITLE };
