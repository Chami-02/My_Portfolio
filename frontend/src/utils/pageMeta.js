// frontend/src/utils/pageMeta.js
//
// PF-153 (owner, 2026-11-07) — what Google reads for each page. This is a
// single-page app: the server sends one index.html for every address, so these are
// set in the browser, and Google reads them after running the JavaScript.
//
// ⚠️ NOT React 19's hoisted <title>. It ADDS an element after index.html's, and a
// document uses its FIRST <title>, so the page's own title would silently lose.
// Existing tags are edited, and created only when index.html has none.
//
// React-free and directly unit-testable.

export const SITE_URL = 'https://parindragallage.com';
const SITE_NAME = 'Parindra Gallage';
const LD_ID = 'page-structured-data';

export const pageTitle = (title) => (title ? `${title} — ${SITE_NAME}` : null);

/** One tag in <head>, found or made. */
const headTag = (selector, make) => {
  const found = document.head.querySelector(selector);
  if (found) return found;
  const made = make();
  document.head.appendChild(made);
  return made;
};

const makeMeta = (name) => () => {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  return el;
};

const makeCanonical = () => {
  const el = document.createElement('link');
  el.setAttribute('rel', 'canonical');
  return el;
};

/**
 * Sets this page's words and answers the function that puts the site's own back,
 * so a page with none of its own (the admin) never shows the last page's title.
 *
 * @param meta.title        without the site's name; omit to keep index.html's
 * @param meta.description  a page's own summary; omit to keep index.html's
 * @param meta.path         the page's one true address, for `canonical`
 * @param meta.noindex      a page search results should not list
 * @param meta.structured   schema.org data for this page
 */
export function applyPageMeta({ title, description, path, noindex, structured }) {
  const descriptionTag = document.head.querySelector('meta[name="description"]');
  const before = { title: document.title, description: descriptionTag?.getAttribute('content') };

  const full = pageTitle(title);
  if (full) document.title = full;
  if (description && descriptionTag) descriptionTag.setAttribute('content', description);
  if (path) {
    headTag('link[rel="canonical"]', makeCanonical).setAttribute('href', `${SITE_URL}${path}`);
  }
  if (noindex) headTag('meta[name="robots"]', makeMeta('robots')).setAttribute('content', 'noindex');
  if (structured) {
    const script = headTag(`#${LD_ID}`, () => {
      const el = document.createElement('script');
      el.id = LD_ID;
      el.type = 'application/ld+json';
      return el;
    });
    // Data, never run, so the CSP's script hash does not apply (index.html's own).
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...structured });
  }

  return () => {
    document.title = before.title;
    if (descriptionTag && before.description !== undefined) {
      descriptionTag.setAttribute('content', before.description);
    }
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelector('meta[name="robots"]')?.remove();
    document.getElementById(LD_ID)?.remove();
  };
}
