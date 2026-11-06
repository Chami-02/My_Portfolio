const router = require('express').Router();
const { publicCache } = require('../middleware/cache'); // PF-128
const { getSiteNumbers } = require('../controllers/siteNumbersController');

router.get('/', publicCache, getSiteNumbers);

module.exports = router;
