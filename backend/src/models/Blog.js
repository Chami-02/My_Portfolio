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
    // ⚠️ DERIVED. Never write this from a client — `applyDerivedFields()`
    // below owns it on every path, and a payload that sets it is ignored
    // because `blogRules` does not accept it.
    readingTimeMinutes: {
      type:    Number,
      default: 1,
    },

    // ── NEW IN PF-103 ───────────────────────────────────────────
    // The author's PIN. null — the normal case — means "compute from the
    // content". A number freezes `readingTimeMinutes` at that value until
    // the pin is cleared.
    //
    // Why a second field rather than an explicit `readingTimeMinutes`:
    // one field cannot answer "was this pinned or computed?", and every
    // reading-time defect this project has had came out of that ambiguity.
    // PF-95's bug was two hooks disagreeing about whether a supplied value
    // was intentional; PF-97 then had to drop the field from the admin
    // payload entirely, because echoing a COMPUTED figure back would have
    // silently frozen it forever. With the pin stored separately, both
    // questions have a stored answer and neither hook has to infer one.
    readingTimeOverride: {
      type:    Number,
      default: null,
      min:     1,
    },
    // ─────────────────────────────────────────────────────────────

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
  const { forceSlug = false } = options;

  if ((forceSlug || !doc.slug) && doc.title) {
    doc.slug = makeSlug(doc.title);
  }

  // ── CHANGED IN PF-103 ─────────────────────────────────────────
  // `readingTimeMinutes` is now a PURE FUNCTION of `readingTimeOverride`
  // and the content, recomputed on every pass. It used to be conditional
  // — a `forceReadingTime` option the caller derived from `isModified()`
  // — and that condition is what made the field's value depend on WHICH
  // hook ran and what else changed in the same operation.
  //
  // Recomputing unconditionally is safe precisely because it is
  // deterministic: same override, same sections, same answer. It also
  // fixes a case the old condition missed, where editing only the title
  // left a stale figure behind because `sections` had not changed.
  // ──────────────────────────────────────────────────────────────
  if (doc.readingTimeOverride != null) {
    doc.readingTimeMinutes = doc.readingTimeOverride;
  } else if ((doc.sections && doc.sections.length > 0) || doc.content) {
    doc.readingTimeMinutes = calculateReadingTimeMinutes(doc);
  }

  // ── NEW IN PF-104 ─────────────────────────────────────────────
  // Stamp the publish date the first time a post is published.
  //
  // THE DEFECT THIS FIXES: nothing on the server ever wrote
  // `publishedAt`. `createPost` passes req.body straight through and
  // `togglePublish` flipped only the boolean, so a post created as a
  // draft in January and published in September kept `publishedAt:
  // null` forever. The list sort falls back to `createdAt`
  // (utils/blogQuery.js), so it appeared as a January post the moment
  // it went live — below every post published in between.
  //
  // ⚠️ HERE, and not in a new pre('save'). This function already runs
  // from BOTH pre('validate') and pre('insertMany'), so one line covers
  // create-as-published, togglePublish's save() and updatePost. A second
  // hook beside the existing gates is exactly the mistake PF-95's
  // comment above describes — two hooks that can disagree.
  //
  // ⚠️ Unpublishing deliberately does NOT clear it. Re-publishing then
  // keeps the ORIGINAL publish date, which is what a reader expects from
  // a post that briefly went back to draft for an edit. Clearing it
  // would silently move the post to the top of the list on every
  // unpublish/republish cycle.
  //
  // `== null` catches null and undefined but not a real Date, so a
  // seeded or migrated post with an explicit date is never overwritten —
  // which is why seed.js's four transcribed dates survive this.
  if (doc.published && doc.publishedAt == null) {
    doc.publishedAt = new Date();
  }
}

// Auto-generate fields before validation so required slug validation passes.
//
// ── HISTORY, because the shape here is the scar tissue ──────────
// BOTH hooks run for `insertMany`. `pre('insertMany')` fires first on the
// raw POJOs (mongoose/lib/model.js:3055), then each is constructed via
// `new ThisModel(doc)` and `.$validate()`d (model.js:3085-3096 →
// document.js:2972 → document.js:2765-2769), which fires THIS hook.
//
// PF-95 found the two disagreeing: `pre('insertMany')` correctly left an
// explicitly-supplied `readingTimeMinutes` alone, and then this hook
// overwrote it one step later, because on a freshly-constructed document
// `sections` is always "modified". Measured before that fix: an explicit
// `readingTimeMinutes: 6` came back as 3. PF-95 patched it by adding a
// second condition here — skip the recompute if `readingTimeMinutes` was
// modified in the same operation.
//
// ── CHANGED IN PF-103: that condition is GONE ───────────────────
// It was a heuristic standing in for a fact nothing stored. `isModified`
// cannot distinguish "the author pinned 6" from "a client echoed back the
// 6 we computed last time" — which is why PF-97 had to strip the field
// from the admin payload rather than answer the question.
//
// `readingTimeOverride` stores the fact, so this hook no longer has to
// guess: `applyDerivedFields()` derives unconditionally, both hooks call
// it identically, and there is nothing left for them to disagree about.
// `forceSlug` stays — slugs genuinely are regenerated only on a title
// change, since an existing post's URL must not move on every save.
// ───────────────────────────────────────────────────────────────
blogSchema.pre('validate', function () {
  applyDerivedFields(this, { forceSlug: this.isModified('title') });
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
