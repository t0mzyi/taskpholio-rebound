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

    let decoded;
    let isSupabaseToken = false;

    // Try own JWT first
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (ownJwtErr) {
      // Try Supabase JWT secret if configured
      if (process.env.SUPABASE_JWT_SECRET) {
        try {
          decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
          isSupabaseToken = true;
        } catch {
          return error(res, 'Invalid token.', 401);
        }
      } else {
        // Dev fallback: decode without verification
        // WARNING: only acceptable in development — add SUPABASE_JWT_SECRET in production
        decoded = jwt.decode(token);
        if (!decoded || !decoded.sub) return error(res, 'Invalid token.', 401);
        isSupabaseToken = true;
      }
    }

    let user;
    if (isSupabaseToken) {
      // Supabase tokens use 'sub' for user UUID and carry email/role in metadata
      const email = decoded.email;
      if (email) {
        user = await User.findOne({ email }).select('-password');
      }
      if (!user) {
        // Synthesize a user object from the Supabase token claims so the
        // request can proceed without a matching MongoDB User row.
        const role = decoded.user_metadata?.role || 'CEO';
        req.user = {
          _id: decoded.sub,
          email: decoded.email || '',
          name: decoded.user_metadata?.full_name || decoded.email || 'Admin',
          role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() === 'Ceo' ? 'CEO'
              : role.toUpperCase() === 'CTO' ? 'CTO' : 'CEO',
          isDeleted: false,
          isAdmin: () => true,
        };
        return next();
      }
    } else {
      user = await User.findById(decoded.id).select('-password');
    }

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
        .populate('assignedTo', 'name')
        .populate('createdBy', 'name role');

    if (!task || task.isArchived) return error(res, 'Task not found', 404);

    const userId = req.user._id.toString();
    const isAdmin = req.user.role === 'CEO' || req.user.role === 'CTO';
    const isAssigned = task.assignedTo && task.assignedTo._id.toString() === userId;
    const isCreator = task.createdBy && task.createdBy._id.toString() === userId;
    const isWatcher = task.watchers && task.watchers.some((wid) => wid.toString() === userId);

    if (!isAdmin && !isAssigned && !isCreator && !isWatcher) {
      return error(res, 'Access denied. You do not have permission to view this task.', 403);
    }

    req.task = task;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth, requirePermission, requireTaskAccess };
