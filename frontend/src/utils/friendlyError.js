// frontend/src/utils/friendlyError.js
//
// PF-144 (owner, 2026-11-03): "use user friendly error messages for each and
// every error … don't use any difficult technical terms … simple industry
// standard error messages".
//
// THE ONE PLACE an error becomes words for a person. Every screen — public or
// admin — passes its caught error here, so the same problem always reads the
// same way. The rule for every message (the common UX standard, e.g. Nielsen
// Norman / GOV.UK error-message guidance):
//   • say WHAT happened, in everyday words;
//   • say WHAT TO DO next;
//   • never a status code, a field name, or a word like "server", "token",
//     "ID", "HTTP" — `JARGON` below lists them, and a guard test fails the
//     build if one appears in a message the site can show.
//
// The SERVER'S own message is shown only when it is already plain (a "please
// fix this" sentence written for people — every backend message was rewritten
// to that standard in the same ticket). A 5xx never shows the server's text:
// whatever went wrong there is ours, not the reader's.

/**
 * Words a visitor should never have to read. Whole words, any case.
 * Kept to the genuinely technical: "request" ("request a new code") and
 * "stack" ("Tech stack") are everyday words here and are allowed; "ID" is
 * allowed only as the admin's own field label "Credential ID".
 */
export const JARGON = /\b(HTTP|IP|(?<!Credential )IDs?|tokens?|servers?|backend|database|undefined|null|NaN|slugs?|payload|endpoint|bad request|request failed|format|configured|replica|transactions?|ObjectId|CastError|Mongo\w*|JSON|stack trace|exception|status code)\b/i;

export const MESSAGES = Object.freeze({
  offline:   "We can't connect right now. Please check your internet connection and try again.",
  slow:      'This is taking longer than usual. Please try again in a moment.',
  busy:      'Too many attempts. Please wait a few minutes and try again.',
  ourSide:   'Something went wrong on our side. Please try again in a moment.',
  session:   'Your session has ended. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  notFound:  "We couldn't find that. It may have been moved or deleted.",
  tooBig:    'That file is too large. Please choose one under 4 MB.',
  fileType:  "That file type isn't supported. Please choose a PNG, JPEG or WebP picture.",
  generic:   "That didn't work. Please check and try again.",
});

/** A message written for people — non-empty, short, and free of jargon. */
export const isPlain = (message) =>
  typeof message === 'string' && message.trim().length > 0 && message.length <= 300 && !JARGON.test(message);

/**
 * Any caught error → one plain sentence (or two).
 *
 * @param {unknown} err       what the request threw (axios-shaped or not)
 * @param {object}  [opts]
 * @param {string}  [opts.fallback]  a plainer, screen-specific default for a
 *                                   4xx the server gave no usable words for
 * @param {string}  [opts.notFound]  what a 404 means HERE ("That post …")
 */
export function friendlyError(err, { fallback, notFound } = {}) {
  const response = err?.response;
  if (!response) {
    // No answer at all: offline, the site unreachable, or it timed out.
    return err?.code === 'ECONNABORTED' ? MESSAGES.slow : MESSAGES.offline;
  }

  const { status } = response;
  const said = response.data?.message;

  if (status === 429) return isPlain(said) ? said : MESSAGES.busy;
  // 503 is the one 5xx whose words help (e.g. "Pictures can't be uploaded
  // right now") — and only when they are plain.
  if (status === 503 && isPlain(said)) return said;
  if (status >= 500) return MESSAGES.ourSide;

  if (isPlain(said)) return said;
  if (status === 401) return MESSAGES.session;
  if (status === 403) return MESSAGES.forbidden;
  if (status === 404) return notFound || MESSAGES.notFound;
  if (status === 413) return MESSAGES.tooBig;
  if (status === 415) return MESSAGES.fileType;
  return fallback || MESSAGES.generic;
}
