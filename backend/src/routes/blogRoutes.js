const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const MongoStore = require('../middleware/mongoRateLimitStore'); // PF-141
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { publicCache } = require('../middleware/cache'); // PF-128
const {
  blogRules,
  getAllPosts,
  getAllPostsAdmin,
  getPostBySlug,
  createPost,
  updatePost,
  togglePublish,
  deletePost,
  incrementViews,
} = require('../controllers/blogController');

// A public counter is trivially abusable — a shell loop could
// add 10,000 views in a minute. 30/minute blocks a script while
// leaving room for a whole office or campus behind one NAT'd IP.
const viewLimiter = rateLimit({
  store:    new MongoStore('view'),
  windowMs: 60 * 1000,        // 1 minute
  max:      30,               // 30 views per IP per window
  message:  { status: 'error', message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders:   false,
});

router.get('/',      publicCache, getAllPosts);
router.get('/:slug', publicCache, getPostBySlug);
router.get('/admin/all',         protect, getAllPostsAdmin);
router.patch('/:slug/view',      viewLimiter, incrementViews);
// ⚠️ PF-97 — `protect` moved AHEAD of the rule array. It used to read
// `blogRules, validate, protect`, so an unauthenticated request was told
// what was wrong with its body before being told it had no business
// sending one: a 400 describing the schema instead of a 401. Auth is the
// outer gate on every other resource (projectRoutes.js, skillRoutes.js)
// and is now the outer gate here too.
router.post('/',      protect, blogRules, validate, createPost);
router.put('/:id',               protect, updatePost);
router.patch('/:id/publish',     protect, togglePublish);
router.delete('/:id',            protect, deletePost);

module.exports = router;