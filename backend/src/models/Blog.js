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
      for (const para   of section.body)    wordCount += countWords(para);
      for (const bullet of section.bullets) wordCount += countWords(bullet);
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
blogSchema.pre('validate', function () {
  applyDerivedFields(this, {
    forceSlug:        this.isModified('title'),
    forceReadingTime: this.isModified('content') || this.isModified('sections'),
  });
});

// insertMany does not run save middleware, so handle bulk seed/import paths too.
blogSchema.pre('insertMany', function (docs) {
  const docsArray = Array.isArray(docs) ? docs : [docs];
  docsArray.forEach((doc) => applyDerivedFields(doc));
});

// Index for fast slug lookups
blogSchema.index({ slug: 1 }, { unique: true });
blogSchema.index({ published: 1, createdAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
