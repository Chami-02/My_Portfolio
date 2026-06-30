const mongoose = require('mongoose');
const slugify  = require('slugify');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Blog title is required'],
      trim:      true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type:   String,
      unique: true,
      // Auto-generated from title (see pre-save hook below)
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

// Auto-generate slug from title before saving
blogSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower:  true,
      strict: true,      // Remove special characters
      trim:   true,
    });
  }

  // Auto-calculate reading time (average 200 words per minute)
  if (this.isModified('content') && this.content) {
    const wordCount = this.content.trim().split(/\s+/).length;
    this.readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  }

  next();
});

// Index for fast slug lookups
blogSchema.index({ slug: 1 });
blogSchema.index({ published: 1, createdAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);