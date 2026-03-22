const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getNotifications, markAsRead, markOneAsRead } = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/read-all', markAsRead);
router.patch('/:id/read', markOneAsRead);

module.exports = router;
