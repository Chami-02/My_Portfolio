// PF-143 — the words around Certificates. Every visible word there is the
// owner's (owner, 2026-10-30): edited in the panel's "Section text" card,
// stored on the About document. Education's heading is FIXED (owner,
// 2026-10-31: "education is education") — no card, no field.
//
// ⚠️ These defaults are the SAME strings as the backend's `SECTION_TEXT`
// (backend/src/models/About.js) — a test pins it. They are the first-paint
// fallback and what a blank field shows, so the page never differs between
// "not loaded yet" and "loaded, never edited".
export const SECTION_TEXT = {
  certificatesHeading:     'Certificates',
  certificatesViewAll:     'VIEW ALL CERTIFICATES',
  certificatesVerify:      'VERIFY',
  certificatesCardLabel:   'VIEW CERTIFICATE',
  certificatesPageHeading: 'Certificates',
  certificatesPageIntro:   'Courses and exams I have passed. Open one to see it full size, and check it with the issuer.',
};

/** The owner's words for `name`, or the default when blank / not loaded. */
export const sectionText = (about, name) => {
  const value = about?.[name];
  return typeof value === 'string' && value.trim() ? value : SECTION_TEXT[name];
};

/** The "Section text" card's fields, per panel. Limits match aboutController. */
export const CERTIFICATE_TEXT_FIELDS = [
  { name: 'certificatesHeading',     label: 'Heading (home page)',     max: 40,  hint: 'Above the list on the home page.' },
  { name: 'certificatesViewAll',     label: 'View-all button',          max: 40,  hint: 'The link under the list. An arrow is added after it.' },
  { name: 'certificatesVerify',      label: 'Verify button',            max: 30,  hint: 'On every certificate that has a verify link.' },
  { name: 'certificatesCardLabel',   label: 'Card label',               max: 30,  hint: 'On each picture card of the certificates page.' },
  { name: 'certificatesPageHeading', label: 'Certificates page heading', max: 60, hint: 'The big title of the certificates page.' },
  { name: 'certificatesPageIntro',   label: 'Certificates page intro',  max: 300, hint: 'The sentence under that title.', multiline: true },
];
