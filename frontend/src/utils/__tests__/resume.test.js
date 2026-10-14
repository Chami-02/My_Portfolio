// frontend/src/utils/__tests__/resume.test.js
//
// PF-112 — where a DOWNLOAD CV anchor points.
//
// ⚠️ These assert the THREE ATTRIBUTES TOGETHER, which is the whole reason
// cvAnchorProps is a function rather than three exported strings. The empty
// state is not just a different href: it also has to drop `download` and add the
// explanatory title. A copy of this logic getting two of the three right would
// look entirely normal and behave wrong — the hero anchor was exactly that for
// three sprints.
import { describe, it, expect } from 'vitest';
import { cvAnchorProps, CV_HREF, CV_EMPTY_HREF, CV_EMPTY_TITLE } from '../resume';

describe('cvAnchorProps', () => {
  it('points at the download endpoint when a résumé is stored', () => {
    expect(cvAnchorProps(true)).toEqual({
      href: CV_HREF, download: true, title: undefined,
    });
  });

  it('falls back to the prototype’s inert anchor when there is none', () => {
    expect(cvAnchorProps(false)).toEqual({
      href: CV_EMPTY_HREF, download: false, title: CV_EMPTY_TITLE,
    });
  });

  // `download` must be exactly `false`, not undefined or '': React omits a
  // boolean attribute only for `false`, and a `download` left on an inert
  // `#contact` href makes the browser try to download the page itself.
  it('sets download to a literal false in the empty state', () => {
    expect(cvAnchorProps(false).download).toBe(false);
  });

  it('carries no title once the file exists, so no tooltip contradicts it', () => {
    expect(cvAnchorProps(true).title).toBeUndefined();
  });

  it('resolves through apiUrl rather than a hardcoded path', () => {
    // The backend is a DIFFERENT ORIGIN in production, so a literal
    // '/api/resume' would 404 live while working behind the dev proxy.
    expect(CV_HREF).toMatch(/\/resume$/);
  });

  it('keeps the empty anchor pointing inside the page', () => {
    expect(CV_EMPTY_HREF).toBe('#contact');
    expect(CV_EMPTY_TITLE).toMatch(/admin panel/i);
  });
});
