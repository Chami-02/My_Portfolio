const mongoose   = require('mongoose');
const Vocabulary = require('../models/Vocabulary');
const Project    = require('../models/Project');
const Blog       = require('../models/Blog');
const AppError   = require('../utils/AppError');

// Which collection and field each vocabulary type maps onto.
//
// ── `publicFilter`, ADDED IN PF-97 ──────────────────────────────────────
// Which documents of that collection a VISITOR can actually see. Used only
// by `?inUse=true` below, to decide whether a vocabulary value deserves a
// public filter chip.
//
// ⚠️ Blog is `{ published: true }` and Project is `{}` — that asymmetry is
// correct, not an oversight: `models/Project.js` has no published/draft
// field at all, so every project is public, while a blog post is a draft
// until it is not.
const TARGETS = {
  tech: { model: Project, field: 'tech', label: 'projects',
          publicFilter: {} },
  tag:  { model: Blog,    field: 'tags', label: 'blog posts',
          publicFilter: { published: true } },
};

// Guard used by every handler — rejects anything that isn't tag/tech
const resolveType = (type, next) => {
  const target = TARGETS[type];
  if (!target) {
    next(new AppError(`Invalid vocabulary type "${type}" — use "tag" or "tech"`, 400));
    return null;
  }
  return target;
};

// ── GET /api/vocabulary/:type ────────────────────────────────────────────────
// Public. Loads the chip list for the picker.
//
// ── `?inUse=true`, ADDED IN PF-97 ───────────────────────────────────────
// Returns only values that at least one PUBLICLY VISIBLE document actually
// carries. The `/blog` filter-chip row (PF-98) is the caller.
//
// WHY THE ROW CANNOT JUST USE THE FULL POOL: a vocabulary value with no
// published post behind it renders a chip that returns "no posts found".
// That is trivial to produce — add a tag then cancel the post, tag only a
// draft, or delete the last post using a tag (this cascade runs one way
// only, so the row survives). A filter guaranteed to fail is worse than an
// absent one: a visitor cannot tell a stale pool entry from a broken site.
//
// WHY THE ROW CANNOT DERIVE FROM THE POSTS IT FETCHED, as the design does
// (`Blog.dc.html:327`): PF-96 made `?q=`/`?tag=` server-side, so the list
// response is already filtered. Chips derived from it would shrink as you
// filter. The row needs a source independent of the current filter.
//
// ⚠️ OMITTING THE PARAM MUST RETURN THE FULL POOL, and the admin picker
// depends on it: you have to be able to pick a tag BEFORE anything uses it,
// or a new tag could never reach a first post.
const getVocabulary = async (req, res, next) => {
  try {
    const target = resolveType(req.params.type, next);
    if (!target) return;

    const items = await Vocabulary
      .find({ type: req.params.type })
      .sort({ order: 1, value: 1 });

    if (req.query.inUse !== 'true') {
      return res.json({ status: 'success', data: items });
    }

    // `distinct` is the natural fit for a value living in an array field:
    // one query returning every value in use across the visible documents.
    const used = await target.model.distinct(target.field, target.publicFilter);

    // ⚠️ Case-INSENSITIVE. The picker writes the vocabulary's own casing,
    // but the admin form also keeps a free-text tags input, so a post can
    // legitimately carry `react` while the pool holds `React`. An exact
    // compare would drop that chip for no reason a reader could see.
    const usedLower = new Set(used.map((v) => String(v).toLowerCase()));

    res.json({
      status: 'success',
      data:   items.filter((item) => usedLower.has(item.value.toLowerCase())),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/vocabulary/:type/:id/impact ─────────────────────────────────────
// Protected. Tells the confirm modal how much damage a delete would do.
//
// ⚠️ DELIBERATELY COUNTS EVERY DOCUMENT, DRAFTS INCLUDED — do NOT reuse
// `publicFilter` here. It looks like duplicated logic that ought to be
// unified with `?inUse=true` above, and it is not: these answer different
// questions.
//
//   impact       → "what will this delete touch?"   ALL posts. The cascade
//                  strips drafts too, so a published-only count would
//                  understate the damage in the one dialog whose entire
//                  purpose is stating it.
//   ?inUse=true  → "should this be a public chip?"  PUBLISHED only.
//
// Unifying them breaks one or the other: either the confirm lies about
// drafts it is about to edit, or a draft-only tag leaks a dead chip onto
// the public page.
const getDeleteImpact = async (req, res, next) => {
  try {
    const target = resolveType(req.params.type, next);
    if (!target) return;

    const item = await Vocabulary.findById(req.params.id);
    if (!item) return next(new AppError('No vocabulary item found with that ID', 404));

    const affected = await target.model.countDocuments({
      [target.field]: item.value,
    });

    res.json({
      status: 'success',
      data: {
        value:    item.value,
        type:     item.type,
        affected,
        label:    target.label,   // 'projects' or 'blog posts' — for the modal text
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return next(new AppError('Invalid vocabulary ID format', 400));
    }
    next(err);
  }
};

// ── POST /api/vocabulary/:type ───────────────────────────────────────────────
// Protected. Adds a chip to the pool permanently.
const createVocabulary = async (req, res, next) => {
  try {
    if (!resolveType(req.params.type, next)) return;

    const value = String(req.body.value || '').trim();
    if (!value) return next(new AppError('Value is required', 400));

    const item = await Vocabulary.create({ type: req.params.type, value });
    res.status(201).json({ status: 'success', data: item });

  } catch (err) {
    // 11000 = duplicate key — the compound unique index fired
    if (err.code === 11000) {
      return next(new AppError(`"${req.body.value}" already exists in this vocabulary`, 409));
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(e => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── Transaction support probe ────────────────────────────────────────────────
// CHANGED IN PF-62 FOLLOW-UP.
//
// The previous version wrapped startSession()/startTransaction() in a
// try/catch and treated a throw as "standalone server". That catch could
// never fire: both calls are purely client-side and never contact the
// server, so neither can report a topology it knows nothing about. The
// real rejection arrived later — the first operation carrying the session
// came back IllegalOperation (20), landed in the outer catch, and became a
// 500 instead of a fallback. The fallback was unreachable code.
//
// Ask the server instead. `hello` reports `setName` on a replica set member
// and `msg: 'isdbgrid'` on a mongos. A standalone mongod reports neither,
// and standalone is the only topology that cannot run transactions.
//
// Cached for the process lifetime — topology does not change under a running
// server, and this sits in the path of every delete.
let _txSupport = null;

async function supportsTransactions() {
  if (_txSupport !== null) return _txSupport;

  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    _txSupport = Boolean(info.setName || info.msg === 'isdbgrid');
  } catch {
    // Only reached if the probe itself fails on a live connection (e.g. the
    // user lacks permission to run admin commands). Assuming no transaction
    // support is the safe read: the delete still completes, just without
    // atomicity. Callers reach this only after a successful query, so an
    // unready connection cannot poison the cache here.
    _txSupport = false;
  }

  return _txSupport;
}

// ── DELETE /api/vocabulary/:type/:id ─────────────────────────────────────────
// Protected. OPTION B: removes the chip AND strips it from all content.
const deleteVocabulary = async (req, res, next) => {
  let session = null;

  try {
    const target = resolveType(req.params.type, next);
    if (!target) return;

    const item = await Vocabulary.findById(req.params.id);
    if (!item) return next(new AppError('No vocabulary item found with that ID', 404));

    const { model, field } = target;

    // Ask the server what it supports, rather than inferring support from a
    // client-side call not throwing.
    const useTx = await supportsTransactions();

    if (useTx) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const opts = session ? { session } : {};

    // $pull removes every matching element from the array, across all docs
    const strip = await model.updateMany(
      { [field]: item.value },
      { $pull: { [field]: item.value } },
      opts
    );

    await Vocabulary.deleteOne({ _id: item._id }, opts);

    if (session) {
      await session.commitTransaction();
      session.endSession();
      session = null;
    }

    res.json({
      status: 'success',
      data: {
        deleted:       item.value,
        strippedFrom:  strip.modifiedCount,
        label:         target.label,
        transactional: useTx,
      },
    });

  } catch (err) {
    if (session) {
      // Abort gets its own error boundary. A failed abort must not replace
      // the error that actually caused the failure — that is how a useful
      // stack trace turns into a confusing one.
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error('vocabulary delete: abortTransaction failed:', abortErr.message);
      }
      session.endSession();
    }
    if (err.name === 'CastError') {
      return next(new AppError('Invalid vocabulary ID format', 400));
    }
    next(err);
  }
};

module.exports = {
  getVocabulary,
  getDeleteImpact,
  createVocabulary,
  deleteVocabulary,
};