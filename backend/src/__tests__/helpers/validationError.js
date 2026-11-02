// The error `doc.validate()` rejects with, or undefined when the document is
// valid. Replaces Mongoose's `validateSync()` — deprecated, removed in Mongoose
// 10 (warned on every test run until 2026-11-02) — and, unlike it, runs the
// model's validate middleware (CLAUDE.md: validateSync runs no middleware).
module.exports = (doc) => doc.validate().then(() => undefined, (err) => err);
