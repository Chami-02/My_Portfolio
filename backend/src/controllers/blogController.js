const { body } = require('express-validator');
const Blog     = require('../models/Blog');
const AppError = require('../utils/AppError');
const { buildMatch, sortedPipeline } = require('../utils/blogQuery');

// ── Validation rules ────────────────────────────────────────────────────────
const blogRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Blog title is required')
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),
  body('excerpt')
    .trim()
    .notEmpty().withMessage('Excerpt is required')
    .isLength({ max: 300 }).withMessage('Excerpt cannot exceed 300 characters'),
  // ── CHANGED IN PF-97 ──────────────────────────────────────────────────
  // Was `body('content').trim().notEmpty()`, which rejected every
  // sections-shaped post with `400 "Blog content is required"`. PF-59 moved
  // the body from a flat `content` string to `sections[]` and this rule was
  // never moved with it, so the API demanded a field that no post has had
  // since — `seed.js` writes zero of them. The admin panel could not create
  // a post at all.
  //
  // The rule is now "a post needs A body", not "a post needs THAT field".
  // `content` still satisfies it because the column still exists
  // (`models/Blog.js` marks it DEPRECATED, awaiting its own removal ticket)
  // and legacy rows may still carry it.
  //
  // ⚠️ Hung off `sections` rather than a bare `body()` because a custom
  // validator on a named field runs even when that field is ABSENT —
  // measured across all five shapes (missing / `[]` / populated / content
  // only / blank content) before being written this way. A rule that only
  // fired when `sections` was present would wave through the exact request
  // this ticket exists to reject.
  //
  // ⚠️ Section SHAPE is deliberately not validated here. `sectionSchema`'s
  // own `pre('validate')` already rejects a section with neither paragraphs
  // nor bullets, and it arrives as a Mongoose ValidationError that
  // `createPost` below already converts into a readable 400. Verified by
  // probe, not assumed. A second copy of that rule here would be a second
  // source of truth for it.
  body('sections').custom((sections, { req }) => {
    const hasSections = Array.isArray(sections) && sections.length > 0;
    const hasContent  = typeof req.body.content === 'string' && req.body.content.trim() !== '';

    if (!hasSections && !hasContent) {
      throw new Error('A post needs a body — add at least one section');
    }
    return true;
  }),
];

// ── GET /api/blog ─────────────────────────────────────────────────────────────
// Public — returns only PUBLISHED posts, newest first.
//
// PF-96: accepts `?q=` (search) and `?tag=` (filter), and orders by
// publish date instead of `createdAt`. Both the filter semantics and the
// ordering live in utils/blogQuery.js so this endpoint, the admin list and
// the prev/next lookup cannot drift apart. Omitting both params returns
// every published post, exactly as before.
const getAllPosts = async (req, res, next) => {
  try {
    const posts = await Blog.aggregate(
      sortedPipeline({
        match:   buildMatch({ publishedOnly: true, q: req.query.q, tag: req.query.tag }),
        project: { content: 0 },  // full body is dead weight in a list view
      })
    );
    res.json({ status: 'success', data: posts });
  } catch (err) { next(err); }
};

// ── GET /api/blog/admin/all ───────────────────────────────────────────────────
// Protected — returns ALL posts (drafts + published) for admin panel
const getAllPostsAdmin = async (req, res, next) => {
  try {
    // Same ordering and the same `?q=`/`?tag=` handling as the public
    // list — it is one shared builder, so supporting them here costs
    // nothing and stops the admin panel from showing a different order
    // than the site does.
    const posts = await Blog.aggregate(
      sortedPipeline({
        match:   buildMatch({ publishedOnly: false, q: req.query.q, tag: req.query.tag }),
        project: { content: 0 },
      })
    );
    res.json({ status: 'success', data: posts });
  } catch (err) { next(err); }
};

// ── GET /api/blog/:slug ───────────────────────────────────────────────────────
// Public — returns single published post by slug (not ID)
// e.g. /api/blog/how-i-built-my-mern-portfolio
const getPostBySlug = async (req, res, next) => {
  try {
    const post = await Blog.findOne({
      slug:      req.params.slug,
      published: true,
    });

    if (!post) return next(new AppError('Blog post not found', 404));

    // Views are counted by PATCH /api/blog/:slug/view (PF-64), not here.
    // Counting on read double-counted every view and bumped updatedAt,
    // which pushed every post anyone read to the top of the admin panel.

    // ── PF-96: prev/next neighbours ───────────────────────────────────
    // Fetched as the same ordered list the index uses, projected down to
    // two fields. Walking the list is O(n) where a pair of range queries
    // would be O(log n) — deliberate, because a range query is a SECOND
    // expression of the sort order and would have to re-encode the
    // `$ifNull` fallback and the `_id` tiebreak to agree with it. At this
    // collection size the shared-order guarantee is worth more than the
    // query count, and it is the whole point of "one shared sort spec".
    //
    // Wrap-around is transcribed from the design's own step():
    //   docs/design/Blog.dc.html:554-558
    //     const next = (i + dir + POSTS.length) % POSTS.length;
    // so the oldest post's NEXT returns to the newest and both links
    // always exist. Navigation walks the FULL published list and ignores
    // any active search or tag — also the design's behaviour.
    const ordered = await Blog.aggregate(
      sortedPipeline({
        match:   buildMatch({ publishedOnly: true }),
        project: { slug: 1, title: 1 },
      })
    );

    const total = ordered.length;
    const index = ordered.findIndex((p) => p.slug === post.slug);

    // With one post there is nowhere to go, and wrapping would make a
    // post its own previous AND next — a link that appears to navigate
    // and does nothing. `index === -1` cannot happen (the post was just
    // matched by the same published filter) but is handled rather than
    // trusted, because it would otherwise silently return the last post.
    const neighbour = (offset) => {
      if (total < 2 || index === -1) return null;
      const { slug, title } = ordered[(index + offset + total) % total];
      return { slug, title };
    };

    res.json({
      status: 'success',
      // `data` is a compound resource, not the bare post. The reading
      // view needs all three in one request, and nothing consumed this
      // endpoint before PF-96 — `blogService.getBySlug` returns
      // `r.data.data` and has no callers — so no client breaks.
      data: {
        post,
        prev: neighbour(-1),  // towards the NEWER post, as the design has it
        next: neighbour(1),   // towards the OLDER post
      },
    });
  } catch (err) { next(err); }
};

// ── POST /api/blog ────────────────────────────────────────────────────────────
// Protected — admin only
const createPost = async (req, res, next) => {
  try {
    const post = await Blog.create(req.body);
    res.status(201).json({ status: 'success', data: post });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError('A post with that title already exists', 409));
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── PUT /api/blog/:id ─────────────────────────────────────────────────────────
// Protected — admin only
// ⚠️ PF-96 — this used `findByIdAndUpdate`, which runs QUERY middleware,
// not DOCUMENT middleware. `Blog.js`'s derived fields hang off
// `pre('validate')`, a document hook, so it never fired on this path:
// renaming a post left the slug pointing at the old title, and rewriting
// its sections left the old "X MIN READ" figure. `runValidators: true`
// hid this well — schema constraints DID run, so the write looked
// properly validated while the derivation was skipped entirely.
//
// load → assign → save() is the document path, so `pre('validate')` runs
// and both fields re-derive. It costs one extra round trip; that is the
// price of the hooks running at all.
const updatePost = async (req, res, next) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return next(new AppError('Blog post not found', 404));

    // `_id` is immutable and Mongoose throws if it is assigned; the
    // timestamps are Mongoose's own. Stripping them means a client that
    // PUTs back a whole post object it previously GET-ed still works.
    const { _id, createdAt, updatedAt, ...updates } = req.body;
    post.set(updates);

    await post.save();
    res.json({ status: 'success', data: post });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid post ID', 400));
    // save() surfaces these where findByIdAndUpdate did not — a renamed
    // post can now collide on the unique slug index, and full-document
    // validation can fail on a field the request never touched.
    if (err.code === 11000) {
      return next(new AppError('A post with that title already exists', 409));
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return next(new AppError(message, 400));
    }
    next(err);
  }
};

// ── PATCH /api/blog/:id/publish ───────────────────────────────────────────────
// Protected — toggle published/draft status
const togglePublish = async (req, res, next) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return next(new AppError('Blog post not found', 404));

    post.published = !post.published;
    await post.save();

    res.json({
      status:  'success',
      message: `Post "${post.title}" is now ${post.published ? 'published' : 'a draft'}`,
      data:    post,
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/blog/:id ──────────────────────────────────────────────────────
// Protected — admin only
const deletePost = async (req, res, next) => {
  try {
    const post = await Blog.findByIdAndDelete(req.params.id);
    if (!post) return next(new AppError('Blog post not found', 404));
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid post ID', 400));
    next(err);
  }
};
const incrementViews = async (req, res, next) => {
  try {
    const post = await Blog.findOneAndUpdate(
      { slug: req.params.slug, published: true },
      { $inc: { views: 1 } },
      {
        returnDocument: 'after',  // return the document AFTER the update
        runValidators:  false,    // only touching a counter
        timestamps:     false,    // a view is not an edit — reads must not
                                  // bump updatedAt or the admin panel's
                                  // "recently edited" ordering becomes noise
        projection:     'slug views',
      }
    );

    if (!post) {
      return next(new AppError('No published post found with that slug', 404));
    }

    res.json({ status: 'success', data: { slug: post.slug, views: post.views } });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  blogRules,
  getAllPosts,
  getAllPostsAdmin,
  getPostBySlug,
  createPost,
  updatePost,
  togglePublish,
  deletePost,
  incrementViews,
}
