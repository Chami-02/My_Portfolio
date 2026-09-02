const mongoose = require('mongoose');
const slugify  = require('slugify');

const slugifyOptions = {
  lower:  true,
  strict: true,
  trim:   true,
};

function makeSlug(title) {
  return title ? slugify(title, slugifyOptions) : undefined;
}

function countWords(text) {
  return text && text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ── CHANGED IN PF-59 ────────────────────────────────────────────
// Reading time now counts words across all sections.
// Falls back to `content` for any post not yet migrated.
function calculateReadingTimeMinutes(doc) {
  let wordCount = 0;

  if (doc.sections && doc.sections.length > 0) {
    for (const section of doc.sections) {
      wordCount += countWords(section.heading);
      // ── CHANGED IN PF-95 ──────────────────────────────────────
      // Guarded against a missing key. `pre('insertMany')` receives raw
      // POJOs BEFORE `sectionSchema`'s own `default: []` is applied, so a
      // seed section that omits `body` or `bullets` reaches this loop as
      // `undefined` and throws `TypeError: section.bullets is not
      // iterable`. Reproduced through the real hook, not reasoned about.
      for (const para   of (section.body    || [])) wordCount += countWords(para);
      for (const bullet of (section.bullets || [])) wordCount += countWords(bullet);
    }
  } else if (doc.content) {
    wordCount = countWords(doc.content);
  }

  return wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 1;
}
// ──────────────────────────────────────────────────────────────

// ── NEW IN PF-59 ──────────────────────────────────────────────
// One section of a blog post. The reading view renders these
// in order, numbered 01, 02, 03…
//
// A section may have body paragraphs, bullets, or both.
// It may NOT have neither — that would render as an empty heading.
const sectionSchema = new mongoose.Schema(
  {
    heading: {
      type:      String,
      required:  [true, 'Section heading is required'],
      trim:      true,
      maxlength: [200, 'Heading cannot exceed 200 characters'],
    },
    body: {
      type:    [String],   // each element = one paragraph
      default: [],
    },
    bullets: {
      type:    [String],   // each element = one bullet point
      default: [],
    },
  },
  { _id: false }   // sections are positional, not independently addressable
);

// A section with no content at all is meaningless
sectionSchema.pre('validate', function () {
  if (this.body.length === 0 && this.bullets.length === 0) {
    throw new Error('A section must have at least one paragraph or bullet');
  }
});
// ──────────────────────────────────────────────────────────────

const blogSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Blog title is required'],
      trim:      true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type:     String,
      required: true,
      trim:     true,
      // Auto-generated from title before validation
      // e.g. "My First Blog Post" → "my-first-blog-post"
    },
    excerpt: {
      type:      String,
      required:  [true, 'Excerpt is required'],
      trim:      true,
      maxlength: [300, 'Excerpt cannot exceed 300 characters'],
    },
    content: {
      type:     String,
      required: false,        // ← CHANGED: was `required: [true, ...]`
      // Stored as Markdown — frontend renders it to HTML
      // DEPRECATED as of PF-59. Kept for two weeks as a rollback
      // safety net, then removed in a follow-up ticket.
    },

    // ── NEW IN PF-59 ──────────────────────────────────────────
    sections: {
      type:    [sectionSchema],
      default: [],
    },
    // ──────────────────────────────────────────────────────────
    coverImage: {
      type:    String,
      default: null,
    },
    tags: {
      type:    [String],
      default: [],
    },
    published: {
      type:    Boolean,
      default: false,   // Draft by default — you publish from admin panel
    },
    readingTimeMinutes: {
      type:    Number,
      default: 1,
    },

    // ── NEW IN PF-95 ────────────────────────────────────────────
    // The app's own publish date, independent of `createdAt` (which
    // Mongoose owns and stamps identically for every document in the
    // same insertMany batch — see docs/design/Blog.dc.html's
    // JUL/JUN/MAY/APR 2026 teaser dates, unreproducible from `createdAt`
    // alone once more than one post shares an insert).
    //
    // `default: null` rather than omitting the field, so it is always
    // present in API responses instead of sometimes-there-sometimes-not
    // — one less edge case for the frontend fallback and for tests.
    //
    // ⚠️ UPDATED IN PF-96: this IS the sort key now, on both sides.
    // `utils/blogQuery.js` orders every list by `$ifNull: [publishedAt,
    // createdAt]` and `BlogSection.jsx`'s `byRecency()` mirrors it. The
    // `default: null` above is exactly why the sort is an aggregation and
    // not a plain `.sort()` — MongoDB orders null BELOW every real date,
    // so a newly created post would otherwise sort last.
    publishedAt: {
      type:    Date,
      default: null,
    },
    // ─────────────────────────────────────────────────────────────

    views: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
);

function applyDerivedFields(doc, options = {}) {
  const { forceSlug = false, forceReadingTime = false } = options;

  if ((forceSlug || !doc.slug) && doc.title) {
    doc.slug = makeSlug(doc.title);
  }

  const hasReadableContent = (doc.sections && doc.sections.length > 0) || doc.content;

  if ((forceReadingTime || doc.readingTimeMinutes == null) && hasReadableContent) {
    doc.readingTimeMinutes = calculateReadingTimeMinutes(doc);
  }
}

// Auto-generate fields before validation so required slug validation passes.
//
// ── CHANGED IN PF-95 ────────────────────────────────────────────
// `forceReadingTime` used to fire on any content change alone, which
// silently overwrote an explicitly-supplied `readingTimeMinutes` on the
// SAME operation — it never checked whether `readingTimeMinutes` itself
// had been touched.
//
// Not hypothetical, and not only a save()-path concern: BOTH hooks run
// for `insertMany`. `pre('insertMany')` fires first on the raw POJOs
// (mongoose/lib/model.js:3055), then each is constructed via
// `new ThisModel(doc)` and `.$validate()`d (model.js:3085-3096 →
// document.js:2972 → document.js:2765-2769), which fires THIS hook. On a
// freshly-constructed post `sections` is always "modified", so the old
// condition recomputed unconditionally and `pre('insertMany')`'s own
// null-check — which correctly left an explicit value alone — was undone
// one step later. Measured before the fix: an explicit
// `readingTimeMinutes: 6` came back as 3.
//
// The fix adds one condition: skip the recompute if THIS operation also
// explicitly set `readingTimeMinutes`. An edit that changes `sections`
// without supplying a new reading time still recomputes.
//
// `pre('insertMany')` is deliberately UNCHANGED — it was never the bug.
// A second `pre('validate')` hook would not work either: it would run
// after this one and see `isModified('readingTimeMinutes')` already true
// from this hook's own overwrite.
// ───────────────────────────────────────────────────────────────
blogSchema.pre('validate', function () {
  const contentChanged = this.isModified('content') || this.isModified('sections');
  const readingTimeGivenThisOperation = this.isModified('readingTimeMinutes');

  applyDerivedFields(this, {
    forceSlug:        this.isModified('title'),
    forceReadingTime: contentChanged && !readingTimeGivenThisOperation,
  });
});

// insertMany does not run save middleware, so handle bulk seed/import paths too.
blogSchema.pre('insertMany', function (docs) {
  const docsArray = Array.isArray(docs) ? docs : [docs];
  docsArray.forEach((doc) => applyDerivedFields(doc));
});

// Index for fast slug lookups
blogSchema.index({ slug: 1 }, { unique: true });

// ⚠️ PF-96: was `{ published: 1, createdAt: -1 }`, which backed the old
// `.sort({ createdAt: -1 })`. That sort is gone. This index now serves
// the `$match` stage only — the `$sort` runs on a COMPUTED field
// (`$ifNull: [publishedAt, createdAt]`) and no index can back it.
// `publishedAt` is kept in the key so the index still covers the common
// "published posts by publish date" access pattern if the fallback is
// ever dropped in favour of a backfill. See utils/blogQuery.js.
blogSchema.index({ published: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
