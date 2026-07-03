const router   = require('express').Router();
const validate = require('../middleware/validate');
const {
  blogRules,
  getAllPosts,
  getAllPostsAdmin,
  getPostBySlug,
  createPost,
  updatePost,
  togglePublish,
  deletePost,
} = require('../controllers/blogController');

// const { protect } = require('../middleware/auth'); // Uncomment in PF-35

// ── Public routes ────────────────────────────────────────────────────────────
router.get('/',       getAllPosts);       // List published posts
router.get('/:slug',  getPostBySlug);    // Single post by slug

// ── Protected routes (admin only) ───────────────────────────────────────────
router.get('/admin/all',            /* protect, */ getAllPostsAdmin);
router.post('/',      blogRules, validate, /* protect, */ createPost);
router.put('/:id',                  /* protect, */ updatePost);
router.patch('/:id/publish',        /* protect, */ togglePublish);
router.delete('/:id',               /* protect, */ deletePost);

module.exports = router;