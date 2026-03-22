const User = require('../models/User');
const Team = require('../models/Team');
const { success, error } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');
const { emailQueue } = require('../services/queueService');
const Joi = require('joi');
const jwt = require('jsonwebtoken');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('CEO', 'CTO', 'Member').default('Member'),
  team: Joi.string().allow(null, '').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const bcrypt = require("bcryptjs");

const register = async (req, res) => {
  try {
    console.log("REGISTER HIT");
    console.log("BODY:", req.body);
    const { name, email, password, role, team } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "Member",
      team: team || null
    });

    console.log("USER CREATED:", user);

    return res.status(201).json({
      success: true,
      user
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: error.message
    });
  }
};

const login = async (req, res, next) => {
  try {
    const { error: joiError, value } = loginSchema.validate(req.body);
    if (joiError) return error(res, joiError.details[0].message, 400);

    const user = await User.findOne({ email: value.email, isDeleted: { $ne: true } }) // Handle missing flags
      .select('+password')
      .populate('team', 'name');
    if (!user || !(await user.comparePassword(value.password))) {
      return error(res, 'Invalid email or password.', 401);
    }

    const token = generateToken(user._id);
    const userObj = user.toJSON();
    return success(res, { user: userObj, token }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('team', 'name');
    return success(res, { user });
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, team } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } }; // Ensure it checks existing accounts missing the key
    if (role) filter.role = role;
    if (team) filter.team = team;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password') // Kept select('-password') as it's standard for user lists
      .populate('team', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return success(res, { 
      users, 
      pagination: { total, page, totalPages: Math.ceil(total / limit), limit } 
    });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const allowed = ['name', 'role', 'email', 'team'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.role && updates.role !== 'Member') {
      updates.team = null; // Clear team if changed to CEO/CTO
    }

    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) return error(res, 'User not found.', 404); // Added user.isDeleted check

    const oldState = user.toObject(); // Capture old state for audit log

    const oldTeam = user.team?.toString() || null;
    let newTeam = updates.team !== undefined ? updates.team : oldTeam;
    
    // Convert empty string/null cases
    if (!newTeam) newTeam = null;

    // Apply updates
    Object.assign(user, updates);
    if (newTeam === null) user.team = undefined; // Set to undefined to clear the field in Mongoose
    await user.save();
    
    // Sync Team documents if team changed
    if (oldTeam !== newTeam) {
      if (oldTeam) await Team.findByIdAndUpdate(oldTeam, { $pull: { members: user._id } });
      if (newTeam) await Team.findByIdAndUpdate(newTeam, { $addToSet: { members: user._id } });
    }

    const populated = await User.findById(user._id).select('-password').populate('team', 'name');
    
    await logAudit('UPDATE', 'User', user._id, req.user._id, { oldState, newState: populated.toObject() }); // Log audit

    return success(res, { user: populated }, 'User updated');
  } catch (err) {
    next(err);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'No file provided.', 400);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.path },
      { new: true, runValidators: true }
    ).select('-password');

    return success(res, { user }, 'Avatar uploaded successfully');
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) return error(res, 'User not found.', 404); // Check for existing and not already deleted

    const oldState = user.toObject(); // Capture old state for audit log

    user.isDeleted = true; // Soft delete
    user.deletedAt = new Date(); // Record deletion timestamp
    await user.save();
    
    // The instruction snippet removed team sync, so following that.
    // If team sync is desired for soft delete, it should be re-added here.
    // if (user.team) {
    //   await Team.findByIdAndUpdate(user.team, { $pull: { members: user._id } });
    // }

    await logAudit('DELETE', 'User', user._id, req.user._id, { oldState, newState: user.toObject() }); // Log audit

    return success(res, {}, 'User deleted successfully'); // Changed message to reflect soft delete
  } catch (err) {
    next(err);
  }
};

const getPublicTeams = async (req, res, next) => {
  try {
    const teams = await Team.find().select('_id name');
    return success(res, { teams });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, getAllUsers, updateUser, deleteUser, getPublicTeams, uploadAvatar };
