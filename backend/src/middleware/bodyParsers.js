const express = require('express');

// ── How big a JSON request may be ────────────────────────────────────────────
// 10 kb everywhere, which a stranger can reach with no sign-in. A long blog post
// or project page is the one honest exception: a real post passed 10 kb, and no
// edit to it could be saved at all (found 2026-11-06).
//
// So those two writes skip the small parser, and their ROUTES parse with
// `longJson` AFTER `protect`. A stranger's big body is never even read: it gets
// the same 401 as a small one. Vercel's own cap is 4.5 MB.
const LONG_LIMIT = '256kb';

const smallJson = express.json({ limit: '10kb' });
const longJson  = express.json({ limit: LONG_LIMIT });

const LONG_CONTENT = /^\/api\/(blog|projects)(\/[^/]+)?\/?$/;

/** POST /api/blog, PUT /api/blog/:id, and the same two for projects. */
const isLongContentWrite = (req) => {
  const match = LONG_CONTENT.exec(req.path);
  if (!match) return false;
  return req.method === (match[2] ? 'PUT' : 'POST');
};

const parseJson = (req, res, next) =>
  (isLongContentWrite(req) ? next() : smallJson(req, res, next));

module.exports = { parseJson, longJson };
