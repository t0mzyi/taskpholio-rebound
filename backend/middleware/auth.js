const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const User = require('../models/User');
const { error } = require('../utils/apiResponse');
const { hasPermission } = require('../config/roles');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

    if (!token) return error(res, 'No token provided. Please log in.', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.isDeleted === true) return error(res, 'User not found or account deactivated.', 401);

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Token expired. Please log in again.', 401);
    return error(res, 'Invalid token.', 401);
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return error(res, 'User identity or role not found in token', 403);
    }
    if (!hasPermission(req.user.role, permission)) {
      return error(res, `Forbidden: Missing required permission '${permission}'`, 403);
    }
    next();
  };
};

const requireTaskAccess = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
        .populate('creator', 'name role')
        .populate('assignedTo', 'name')
        .populate('visibleTo', 'name');

    if (!task || task.isDeleted) return error(res, 'Task not found', 404);

    const isVisible = task.visibility === 'public' || task.visibleTo.some(
      (uid) => uid.toString() === req.user._id.toString()
    );

    if (!isVisible) return error(res, 'Access denied. You do not have permission to view this task.', 403);

    req.task = task;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth, requirePermission, requireTaskAccess };
