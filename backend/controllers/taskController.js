const Task = require('../models/Task');
const User = require('../models/User');
const ProgressUpdate = require('../models/ProgressUpdate');
const Notification = require('../models/Notification');
const { success, error } = require('../utils/apiResponse');
const { emailQueue } = require('../services/queueService');
const { logAudit } = require('../utils/auditLogger');
const { emitToUsers, emitToUser } = require('../services/socketService');
const Joi = require('joi');

const taskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().allow('').default(''),
  assignedTo: Joi.array().items(Joi.string()).default([]),
  priority: Joi.string().valid('Low', 'Medium', 'High').default('Medium'),
  status: Joi.string().valid('Not Started', 'In Progress', 'Completed').default('Not Started'),
  deadline: Joi.date().iso().allow(null).default(null),
  team: Joi.string().allow('', null).default(null),
  visibility: Joi.string().valid('public', 'private').default('private'),
});

// GET /tasks - public tasks or private tasks where user is in visibleTo
const getTasks = async (req, res, next) => {
  try {
    const { status, priority, search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } };
    if (visibility) {
      filter.visibility = visibility;
    } else {
      filter.$or = [{ visibility: 'public' }, { visibleTo: req.user._id }];
    }
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate('creator', 'name avatar role')
      .populate('assignedTo', 'name avatar role')
      .populate('acknowledgements.user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return success(res, { 
      tasks, 
      pagination: { total, page, totalPages: Math.ceil(total / limit), limit } 
    });
  } catch (err) {
    next(err);
  }
};

// GET /tasks/:id
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('creator', 'name avatar role')
      .populate('assignedTo', 'name avatar role')
      .populate('visibleTo', 'name avatar role')
      .populate('acknowledgements.user', 'name avatar');

    if (!task || task.isDeleted === true) {
      return error(res, 'Task not found', 404);
    }

    const updates = await ProgressUpdate.find({ task: task._id })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    return success(res, { task, progressUpdates: updates });
  } catch (err) {
    next(err);
  }
};

// POST /tasks — CEO/CTO only
const createTask = async (req, res, next) => {
  try {
    const { error: validationError, value } = taskSchema.validate(req.body);
    if (validationError) return error(res, validationError.details[0].message, 400);

    const assignedTo = value.assignedTo || [];
    // Always store just creator and assigned users in visibleTo
    const visibleTo = [...new Set([req.user._id.toString(), ...assignedTo])];

    const task = await Task.create({
      ...value,
      creator: req.user._id,
      assignedTo,
      visibleTo,
    });

    // Send notifications to assignees
    const notifPromises = assignedTo
      .filter((uid) => uid !== req.user._id.toString())
      .map((uid) =>
        Notification.create({
          user: uid,
          type: 'TASK_ASSIGNED',
          message: `You have been assigned a new task: "${task.title}"`,
          relatedTask: task._id,
        })
      );
    await Promise.all(notifPromises);

    const populated = await task.populate([
      { path: 'creator', select: 'name avatar role' },
      { path: 'assignedTo', select: 'name avatar role' },
    ]);

    // Audit Log
    await logAudit('CREATE', 'Task', task._id, req.user._id, { newState: task.toObject() });

    // Email Queue for assignees
    for (const assigneeId of assignedTo) {
      if (assigneeId.toString() !== req.user._id.toString()) {
        const assignee = await User.findById(assigneeId).select('email name');
        if (assignee && assignee.email && emailQueue) {
          await emailQueue.add('taskAssignmentEmail', {
            to: assignee.email,
            subject: `New Task Assigned: ${task.title}`,
            type: 'TASK_ASSIGNED',
            context: {
              taskTitle: task.title,
              assignerName: req.user.name,
              taskDescription: task.description,
              taskLink: `${process.env.FRONTEND_URL}/tasks/${task._id}`
            }
          });
        }
      }
    }

    // Emit live task creation event
    emitToUsers(visibleTo, 'NEW_TASK', populated);

    return success(res, { task: populated }, 'Task created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// PATCH /tasks/:id
const updateTask = async (req, res, next) => {
  try {
    const allowedUpdates = ['title', 'description', 'priority', 'status', 'deadline', 'team', 'visibility'];
    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const task = req.task; // From middleware
    const oldState = task.toObject();

    // If reassigning, update visibleTo dynamically to maintain private access
    if (req.body.assignedTo) {
      const assignedTo = req.body.assignedTo;
      updates.assignedTo = assignedTo;
      updates.visibleTo = [...new Set([task.creator.toString(), ...assignedTo])];
    }

    // Handle visibility update if provided
    if (req.body.visibility && req.body.visibility !== task.visibility) {
      updates.visibility = req.body.visibility;
      // If visibility changes to private, ensure visibleTo is updated
      if (updates.visibility === 'private' && !req.body.visibleTo) {
        updates.visibleTo = [...new Set([task.creator.toString(), ...(updates.assignedTo || task.assignedTo).map(id => id.toString())])];
      }
    }
    // If visibleTo is explicitly provided, use it
    if (req.body.visibleTo) {
      updates.visibleTo = req.body.visibleTo;
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('creator', 'name avatar role')
      .populate('assignedTo', 'name avatar role');

    if (!updatedTask) return error(res, 'Task not found', 404);

    // Audit Log
    await logAudit('UPDATE', 'Task', updatedTask._id, req.user._id, { 
      oldState, 
      newState: updatedTask.toObject(),
      details: 'Task fields updated'
    });

    // Emit live task update
    emitToUsers(updatedTask.visibleTo, 'TASK_UPDATED', updatedTask);

    return success(res, { task: updatedTask }, 'Task updated successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /tasks/:id
const deleteTask = async (req, res, next) => {
  try {
    if (req.task.creator.toString() !== req.user._id.toString()) {
      return error(res, 'Only the task creator can delete this task.', 403);
    }
    await Task.findByIdAndDelete(req.params.id);
    await ProgressUpdate.deleteMany({ task: req.params.id });

    // Broadcast deletion
    emitToUsers(req.task.visibleTo, 'TASK_DELETED', req.params.id);

    return success(res, {}, 'Task deleted successfully');
  } catch (err) {
    next(err);
  }
};

// POST /tasks/:id/progress
const addProgressUpdate = async (req, res, next) => {
  try {
    const { description, progressIncrement } = req.body;

    if (!description) return error(res, 'Description is required.', 400);
    const increment = Number(progressIncrement);
    if (isNaN(increment) || increment < 0) return error(res, 'Progress increment must be a non-negative number.', 400);

    const task = req.task;
    const newProgress = Math.min(100, task.progress + increment);

    const attachments = (req.files || []).map((file) => ({
      fileUrl: file.path,
      fileType: file.mimetype,
    }));

    const update = await ProgressUpdate.create({
      task: task._id,
      user: req.user._id,
      description,
      progressIncrement: increment,
      attachments,
    });

    // Update task progress + status
    const statusUpdate = newProgress >= 100 ? 'Completed' : newProgress > 0 ? 'In Progress' : task.status;
    await Task.findByIdAndUpdate(task._id, { progress: newProgress, status: statusUpdate });

    // Notify task creator
    if (task.creator.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: task.creator,
        type: 'PROGRESS_UPDATE',
        message: `${req.user.name} added a progress update on task "${task.title}"`,
        relatedTask: task._id,
      });
    }

    const populated = await update.populate('user', 'name avatar');
    
    // Broadcast progress update
    emitToUsers(task.visibleTo, 'PROGRESS_UPDATE', { task: task._id, update: populated, newProgress });

    return success(res, { progressUpdate: populated, newProgress }, 'Progress update added', 201);
  } catch (err) {
    next(err);
  }
};

// POST /tasks/:id/acknowledge
const acknowledgeTask = async (req, res, next) => {
  try {
    const { status } = req.body; // 'seen' or 'accepted'
    if (!['seen', 'accepted'].includes(status)) {
      return error(res, 'Status must be "seen" or "accepted".', 400);
    }

    const task = req.task;
    // Check if user already acknowledged with this or higher status
    const existing = task.acknowledgements.find(
      (a) => a.user.toString() === req.user._id.toString()
    );

    if (existing) {
      // Upgrade from 'seen' to 'accepted' is allowed, but not downgrade
      if (existing.status === 'accepted' && status === 'seen') {
        return error(res, 'Already accepted.', 400);
      }
      existing.status = status;
      existing.at = new Date();
    } else {
      task.acknowledgements.push({
        user: req.user._id,
        status,
        at: new Date(),
      });
    }

    await task.save();

    const populated = await task.populate('acknowledgements.user', 'name avatar');
    return success(res, { acknowledgements: populated.acknowledgements }, 'Task acknowledged');
  } catch (err) {
    next(err);
  }
};

// POST /tasks/:id/attachments
const addAttachment = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return error(res, 'No files uploaded.', 400);

    const attachments = req.files.map((file) => ({
      fileUrl: file.path,
      fileType: file.mimetype,
      uploadedBy: req.user._id,
    }));

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { attachments: { $each: attachments } } },
      { new: true }
    );

    return success(res, { attachments: task.attachments }, 'Attachments uploaded');
  } catch (err) {
    next(err);
  }
};

module.exports = { getTasks, getTask, createTask, updateTask, deleteTask, addProgressUpdate, acknowledgeTask, addAttachment };
