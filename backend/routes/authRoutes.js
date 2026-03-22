const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { getPublicTeams, register, login, getMe, getAllUsers, updateUser, deleteUser, uploadAvatar } = require('../controllers/authController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes
router.get('/public-teams', getPublicTeams);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, getMe);
router.patch('/profile/avatar', requireAuth, upload.single('avatar'), uploadAvatar);

// Admin user management
router.get('/users', requireAuth, requirePermission('manage_users'), getAllUsers);
router.patch('/users/:id', requireAuth, requirePermission('manage_users'), updateUser);
router.delete('/users/:id', requireAuth, requirePermission('manage_users'), deleteUser);

module.exports = router;
