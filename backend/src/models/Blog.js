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

function calculateReadingTimeMinutes(content) {
  if (!content || !content.trim()) {
    return 1;
  }

  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

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
      required: [true, 'Blog content is required'],
      // Stored as Markdown — frontend renders it to HTML
    },
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

  if ((forceReadingTime || doc.readingTimeMinutes == null) && doc.content) {
    doc.readingTimeMinutes = calculateReadingTimeMinutes(doc.content);
  }
}

// Auto-generate fields before validation so required slug validation passes.
blogSchema.pre('validate', function () {
  applyDerivedFields(this, {
    forceSlug:        this.isModified('title'),
    forceReadingTime: this.isModified('content'),
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
