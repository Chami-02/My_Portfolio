// frontend/src/utils/resetError.js
//
// PF-125 — what the forgot-password page says when a request fails.
// React-free, like loginError.js, so each branch is unit-testable.
//
// Every answer the server sends is already written for the reader — the 400s
// ("That code is wrong or has expired…", "Password must be at least 15
// characters", "…data leak…") and the limiters' 429s — so they are shown as
// they come. What this adds is the case the server cannot word: no answer.
import { friendlyError } from './friendlyError';

export function resetErrorMessage(err) {
  // PF-144: the shared plain wording (utils/friendlyError.js) — the server's
  // own sentence when it is plain, never a status code.
  return friendlyError(err, { fallback: "That didn't work. Please try again." });
}
