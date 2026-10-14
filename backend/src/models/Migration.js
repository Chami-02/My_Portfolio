const mongoose = require('mongoose');

/**
 * One row per migration that has been applied to THIS database.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Until now, "has migration 008 run against production?" was answered from
 * memory. The scripts are numbered, idempotent and dry-runnable — all correct —
 * but nothing anywhere recorded that one had actually been applied, so the only
 * safe move was to re-run everything and trust idempotency to absorb it.
 *
 * Every mature migration tool (Flyway, Liquibase, Alembic, Rails, Django,
 * Prisma) keeps exactly this table. It is what makes the DATABASE the authority
 * on its own version, instead of a person's recollection.
 *
 * ⚠️ THE COLLECTION IS PER-DATABASE, AND THAT IS THE POINT. `portfolio_dev`,
 * `portfolio_prod`, `portfolio_test` and `portfolio_e2e` each carry their own
 * `migrations` collection, so each one knows its own state. That is why running
 * 008 on dev says nothing about prod — and why the runner can now SAY so rather
 * than leaving it to be remembered.
 */
const migrationSchema = new mongoose.Schema(
  {
    /**
     * The FILENAME, not the number — `008-about-bio-from-site.js`.
     *
     * ⚠️ Unique, which is the real guard against double-application. Two
     * processes racing to apply the same migration have one of them fail on the
     * index rather than both succeeding.
     */
    name: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
    },

    /**
     * SHA-256 of the migration file's contents at the moment it was applied.
     *
     * ⚠️ THIS IS WHAT ENFORCES "never edit a migration that has run in
     * production". That rule has lived in `migrations/README.md` and in
     * `CLAUDE.md` as prose, which means it held only for as long as someone
     * remembered it. Now the runner recomputes this hash on every start and
     * HALTS if a recorded file has changed — because if it changed, the
     * database no longer matches what the script says it did, and every later
     * migration is reasoning from a false premise.
     */
    checksum: {
      type:     String,
      required: true,
    },

    appliedAt: {
      type:    Date,
      default: Date.now,
    },

    /** How long the script took. Useful when one starts getting slow. */
    durationMs: {
      type:    Number,
      default: 0,
    },

    /**
     * True when the row was written by `migrate:baseline` — i.e. the migration
     * was recorded as already-applied WITHOUT being executed.
     *
     * ⚠️ Kept as a distinct flag rather than a missing `durationMs`, because
     * "we ran this" and "we assumed this had already run" are different claims
     * and only one of them is evidence. Baselining is a one-time step for a
     * database that genuinely had these applied by hand; anything after that
     * should be a real run.
     *
     * ⚠⚠ CORRECTED 2026-09-28 (PF-126). This comment used to read "prod and
     * dev both have 001–008 applied by hand". That was wrong twice:
     *
     *   • THE COUNT. There are SEVEN migration files — 001, 003–008. No 002
     *     has ever existed; the gap is intentional.
     *   • PRODUCTION. `sprint-log.md:2195` and `:1022` record **006 and 007 as
     *     NEVER run against production**. Only 004 (`:3250`, confirmed live
     *     2026-08-29) and 005 (`:3021`, run 2026-09-02) are evidenced; 001,
     *     003 and 008 are UNKNOWN.
     *
     * So production must NOT be baselined — that would record 006 and 007 as
     * applied without running them, irreversibly. Run `npm run migrate:dry`
     * against it and read the output per migration instead.
     */
    baseline: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // Explicit, so it can never be pluralised into something else by a
    // Mongoose version change. Operators grep for this name.
    collection: 'migrations',
  }
);

module.exports = mongoose.model('Migration', migrationSchema);
