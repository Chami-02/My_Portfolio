const { body } = require('express-validator');
const Blog     = require('../models/Blog');
const AppError = require('../utils/AppError');

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
  body('content')
    .trim()
    .notEmpty().withMessage('Blog content is required'),
];

// ── GET /api/blog ─────────────────────────────────────────────────────────────
// Public — returns only PUBLISHED posts
const getAllPosts = async (req, res, next) => {
  try {
    const posts = await Blog
      .find({ published: true })
      .sort({ createdAt: -1 })
      .select('-content'); // Don't return full content in list view — save bandwidth
    res.json({ status: 'success', data: posts });
  } catch (err) { next(err); }
};

// ── GET /api/blog/admin/all ───────────────────────────────────────────────────
// Protected — returns ALL posts (drafts + published) for admin panel
const getAllPostsAdmin = async (req, res, next) => {
  try {
    const posts = await Blog.find().sort({ createdAt: -1 }).select('-content');
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

    // Increment view count (fire-and-forget — don't await)
    Blog.findByIdAndUpdate(post._id, { $inc: { views: 1 } }).exec();

    res.json({ status: 'success', data: post });
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
const updatePost = async (req, res, next) => {
  try {
    const post = await Blog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!post) return next(new AppError('Blog post not found', 404));
    res.json({ status: 'success', data: post });
  } catch (err) {
    if (err.name === 'CastError') return next(new AppError('Invalid post ID', 400));
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

module.exports = {
  blogRules,
  getAllPosts,
  getAllPostsAdmin,
  getPostBySlug,
  createPost,
  updatePost,
  togglePublish,
  deletePost,
}
