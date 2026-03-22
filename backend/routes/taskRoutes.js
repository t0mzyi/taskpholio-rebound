const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission, requireTaskAccess } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getTasks, getTask, createTask, updateTask, deleteTask,
  addProgressUpdate, acknowledgeTask, addAttachment,
} = require('../controllers/taskController');

router.use(requireAuth);

router.get('/', getTasks);
router.post('/', requirePermission('create_tasks'), createTask); // Only CEO/CTO can create tasks

router.get('/:id', requireTaskAccess, getTask);
router.patch('/:id', requireTaskAccess, updateTask);
router.delete('/:id', requireTaskAccess, deleteTask);

router.post('/:id/progress', requireTaskAccess, upload.array('attachments', 5), addProgressUpdate);
router.post('/:id/acknowledge', requireTaskAccess, acknowledgeTask);
router.post('/:id/attachments', requireTaskAccess, upload.array('files', 5), addAttachment);

module.exports = router;
