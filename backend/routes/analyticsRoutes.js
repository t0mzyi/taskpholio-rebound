const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getAdvancedAnalytics } = require('../controllers/analyticsController');

router.use(requireAuth);
router.get('/', getAdvancedAnalytics);

module.exports = router;
