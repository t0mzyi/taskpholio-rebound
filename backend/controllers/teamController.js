const Team = require('../models/Team');
const User = require('../models/User');
const { success, error } = require('../utils/apiResponse');

const getTeams = async (req, res, next) => {
  try {
    const teams = await Team.find()
      .populate('manager', 'name avatar role email')
      .populate('members', 'name avatar role email');
    return success(res, { teams });
  } catch (err) {
    next(err);
  }
};

const getTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('manager', 'name avatar role email')
      .populate('members', 'name avatar role email');
    if (!team) return error(res, 'Team not found.', 404);
    return success(res, { team });
  } catch (err) {
    next(err);
  }
};

const createTeam = async (req, res, next) => {
  try {
    const { name, description, managerId, memberIds } = req.body;
    if (!name || !managerId) return error(res, 'Name and manager are required.', 400);

    const team = await Team.create({
      name,
      description,
      manager: managerId,
      members: memberIds || [],
    });

    await User.updateMany({ _id: { $in: memberIds || [] } }, { team: team._id });

    const populated = await team.populate([
      { path: 'manager', select: 'name avatar role email' },
      { path: 'members', select: 'name avatar role email' },
    ]);
    return success(res, { team: populated }, 'Team created', 201);
  } catch (err) {
    next(err);
  }
};

const updateTeam = async (req, res, next) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('manager', 'name avatar role email')
      .populate('members', 'name avatar role email');
    if (!team) return error(res, 'Team not found.', 404);

    // Sync User models with new team state
    if (req.body.members) {
      const memberIds = req.body.members;
      // Clear team from anyone previously in this team
      await User.updateMany({ team: team._id }, { $unset: { team: '' } });
      // Add team to current members
      await User.updateMany({ _id: { $in: memberIds } }, { team: team._id });
    }

    return success(res, { team }, 'Team updated');
  } catch (err) {
    next(err);
  }
};

const deleteTeam = async (req, res, next) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return error(res, 'Team not found.', 404);
    // Clear team field from members
    await User.updateMany({ team: req.params.id }, { $unset: { team: '' } });
    return success(res, {}, 'Team deleted');
  } catch (err) {
    next(err);
  }
};

const addMembers = async (req, res, next) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !memberIds.length) return error(res, 'memberIds required.', 400);

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: { $each: memberIds } } },
      { new: true }
    )
      .populate('manager', 'name avatar role email')
      .populate('members', 'name avatar role email');
    if (!team) return error(res, 'Team not found.', 404);

    await User.updateMany({ _id: { $in: memberIds } }, { team: team._id });
    return success(res, { team }, 'Members added');
  } catch (err) {
    next(err);
  }
};

const removeMembers = async (req, res, next) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !memberIds.length) return error(res, 'memberIds required.', 400);

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { $pullAll: { members: memberIds } },
      { new: true }
    )
      .populate('manager', 'name avatar role email')
      .populate('members', 'name avatar role email');
    if (!team) return error(res, 'Team not found.', 404);

    await User.updateMany({ _id: { $in: memberIds } }, { $unset: { team: '' } });
    return success(res, { team }, 'Members removed');
  } catch (err) {
    next(err);
  }
};

const getHierarchy = async (req, res, next) => {
  try {
    const ceo = await User.find({ role: 'CEO' }).select('name avatar role email');
    const ctos = await User.find({ role: 'CTO' }).select('name avatar role email');
    const managers = await User.find({ role: 'Manager' }).select('name avatar role email');
    const members = await User.find({ role: 'Member' }).select('name avatar role email');
    const teams = await Team.find()
      .populate('manager', 'name avatar role email')
      .populate('members', 'name avatar role email');

    return success(res, { hierarchy: { ceo, ctos, managers, members, teams } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTeams, getTeam, createTeam, updateTeam, deleteTeam, addMembers, removeMembers, getHierarchy };
