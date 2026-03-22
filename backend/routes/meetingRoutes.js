const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { getMeetings, createMeeting, updateMeeting, deleteMeeting } = require('../controllers/meetingController');

router.use(requireAuth);

router.get('/', getMeetings);
router.post('/', requirePermission('schedule_meetings'), createMeeting);
router.patch('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);

module.exports = router;
