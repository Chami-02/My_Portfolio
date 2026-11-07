const router    = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { publicCache } = require('../middleware/cache'); // PF-128
const { longJson } = require('../middleware/bodyParsers');
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

router.get('/',      publicCache, getAllPosts);
router.get('/:slug', publicCache, getPostBySlug);
router.get('/admin/all',         protect, getAllPostsAdmin);
// ⚠️ PF-97 — `protect` moved AHEAD of the rule array. It used to read
// `blogRules, validate, protect`, so an unauthenticated request was told
// what was wrong with its body before being told it had no business
// sending one: a 400 describing the schema instead of a 401. Auth is the
// outer gate on every other resource (projectRoutes.js, skillRoutes.js)
// and is now the outer gate here too.
router.post('/',      protect, longJson, blogRules, validate, createPost);
router.put('/:id',               protect, longJson, updatePost);
router.patch('/:id/publish',     protect, togglePublish);
router.delete('/:id',            protect, deletePost);

module.exports = router;