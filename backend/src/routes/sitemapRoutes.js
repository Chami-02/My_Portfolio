const express = require('express');
const router  = express.Router();

const { publicCache } = require('../middleware/cache'); // PF-128
const { getSitemap }  = require('../controllers/sitemapController');

router.get('/', publicCache, getSitemap);

module.exports = router;
