const router   = require('express').Router();
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
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



router.get('/',      getAllPosts);
router.get('/:slug', getPostBySlug);
router.get('/admin/all',         protect, getAllPostsAdmin);
router.post('/',      blogRules, validate, protect, createPost);
router.put('/:id',               protect, updatePost);
router.patch('/:id/publish',     protect, togglePublish);
router.delete('/:id',            protect, deletePost);

module.exports = router;