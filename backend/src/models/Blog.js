const mongoose = require('mongoose');
const slugify  = require('slugify');
const { makeSectionSchema } = require('./sectionSchema');

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
// Reading time now counts words across all sections. (Its fallback to the
// old `content` string went with that field in PF-137.)
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
  }

  return wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 1;
}
// ──────────────────────────────────────────────────────────────

// ── NEW IN PF-115 — a DRAFT needs only a title ──────────────────
// Owner, 2026-10-03: a new post can be SAVED AS A DRAFT with nothing but a
// title, and publishing it later demands everything. Every content rule
// below therefore asks "is this post published?" first.
//
// ⚠️ `=== true`, not `!== false` as Project.js uses: Blog's `published`
// defaults to FALSE and has done since Phase 1, so every stored post
// carries the field and "absent" never means "published" here.
//
// ⚠️ These conditions read `this`, so they hold only on the DOCUMENT path
// (create / load → set → save()). `updatePost` and `togglePublish` both
// use it. Under findByIdAndUpdate's update validators `this` would be the
// Query, `published` would read undefined, and every rule would wave a
// published post through — PF-113 recorded the same trap for Project.js.
function isPublished() {
  return this.published === true;
}

// ── PF-59 · moved to models/sectionSchema.js in PF-144 ────────────
// One section of a blog post — the shape Project's page sections share.
// A section's rules ask its POST, and a post is published only when
// `published === true` (see isPublished above).
const sectionSchema = makeSectionSchema((post) => post.published === true);
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
      required:  [isPublished, 'Excerpt is required'],   // PF-115: not for a draft
      trim:      true,
      maxlength: [300, 'Excerpt cannot exceed 300 characters'],
    },
    // ⚠️ `content` WAS HERE AND WAS DELETED IN PF-137 — Phase 1's single
    // Markdown string, replaced by `sections` in PF-59 and kept only as a
    // rollback net. Migration 011 unsets it from every row. Do NOT re-add
    // it as a fallback body: two sources of truth for a post's text is
    // what caused PF-97.
    // ── NEW IN PF-59 ──────────────────────────────────────────
    sections: {
      type:    [sectionSchema],
      default: [],
      // ── NEW IN PF-115 — "a published post needs A body" ─────────
      // Until PF-115 this rule lived ONLY in blogRules, which was enough
      // while no post could exist without a body. Drafts change that, and
      // `togglePublish` (load → flip → save()) never passes through
      // blogRules — so a list-row PUBLISH would have put an empty draft on
      // the public site with a 200. Here, every path that saves a post
      // enforces it, exactly as blogRules' copy does.
      validate: {
        validator(sections) {
          if (this.published !== true) return true;
          return Array.isArray(sections) && sections.length > 0;
        },
        message: 'A post needs a body — add at least one section',
      },
    },
    // ──────────────────────────────────────────────────────────
    // ⚠️ `coverImage` WAS HERE AND WAS DELETED IN PF-111. It was a bare
    // String from an abandoned feature attempt — added, never pursued,
    // null on every post in production, and with zero consumers in
    // either package. It is the reason this API surface read as broken.
    // Migration 007 unsets it. Do NOT re-add it to give the blog teaser
    // a per-post image: the featured card's backdrop is a deliberate
    // fixed photograph per theme (locked decision, 2026-09-07).
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
    // PF-153 — addresses a live post used to have. A title change moves the slug,
    // and these keep shared links working (blogController `getPostBySlug`).
    oldSlugs: {
      type:    [String],
      default: undefined,
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
  } else if (doc.sections && doc.sections.length > 0) {
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
blogSchema.index({ oldSlugs: 1 }, { sparse: true });

// ⚠️ PF-96: was `{ published: 1, createdAt: -1 }`, which backed the old
// `.sort({ createdAt: -1 })`. That sort is gone. This index now serves
// the `$match` stage only — the `$sort` runs on a COMPUTED field
// (`$ifNull: [publishedAt, createdAt]`) and no index can back it.
// `publishedAt` is kept in the key so the index still covers the common
// "published posts by publish date" access pattern if the fallback is
// ever dropped in favour of a backfill. See utils/blogQuery.js.
blogSchema.index({ published: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
