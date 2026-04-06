const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { emitToUser, emitToUsers } = require('../services/socketService');

// Create Task
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      team,
      priority,
      dueDate,
      estimatedHours,
      tags,
      subtasks,
      attachments,
      client
    } = req.body;

    // Validate
    if (!title || !description || !assignedTo || !team) {
      return res.status(400).json({
        success: false,
        message: 'Tactical Failure: Missing required intelligence fields'
      });
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      team,
      priority: priority || 'medium',
      dueDate,
      estimatedHours,
      tags: tags || [],
      subtasks: subtasks || [],
      attachments: attachments || [],
      createdBy: req.user._id,
      status: 'pending',
      progress: 0,
      watchers: [req.user._id, assignedTo],
      activity: [{
        action: 'created',
        user: req.user._id,
        details: 'Initial mission briefing deployed',
        timestamp: new Date()
      }]
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar')
      .populate('team', 'name color');

    // Notify assignee
    await Notification.create({
      recipient: assignedTo,
      sender: req.user._id,
      type: 'TASK_ASSIGNED',
      title: 'New Mission Assigned',
      message: `You have been assigned a new briefing: ${title}`,
      relatedTask: task._id
    });

    // Log tactical activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'TASK_CREATED',
      description: `Target acquired: ${title}`,
      relatedModel: 'Task',
      relatedId: task._id
    });

    // Emit real-time intelligence
    emitToUser(assignedTo.toString(), 'NEW_TASK', populatedTask);
    
    res.status(201).json({
      success: true,
      data: { task: populatedTask },
      message: 'Mission deployed successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, team, assignedTo, search, sortBy, page = 1, limit = 20 } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = { isArchived: false };
    if (req.query.client) query.client = req.query.client;

    // Role-based filtering
    if (userRole === 'CEO' || userRole === 'CTO') {
      if (team) query.team = team;
      if (assignedTo) query.assignedTo = assignedTo;
    } else {
      query.assignedTo = userId;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$text = { $search: search };
    }

    let sort = { createdAt: -1 };
    if (sortBy === 'dueDate') sort = { dueDate: 1 };
    if (sortBy === 'priority') sort = { priority: -1 };
    if (sortBy === 'progress') sort = { progress: -1 };

    const skip = (page - 1) * limit;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar')
      .populate('team', 'name color')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: { tasks },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Task
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Objective not found' });

    const isAdmin = req.user.role === 'CEO' || req.user.role === 'CTO';
    const isAssigned = task.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ success: false, message: 'Access Denied: Priority override required' });
    }

    const updates = req.body;
    const oldStatus = task.status;

    // Field-level privilege enforcement
    const adminOnlyFields = ['assignedTo', 'team', 'priority', 'dueDate', 'estimatedHours', 'title', 'description', 'tags', 'createdBy'];
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (!isAdmin && adminOnlyFields.includes(key)) {
          console.warn(`[SECURITY] Standard operative ${req.user._id} attempted unauthorized override of ${key}`);
          return; // Skip unauthorized field updates
        }
        task[key] = updates[key];
      }
    });

    if (updates.status && updates.status !== oldStatus) {
      task.activity.push({
        action: 'status_changed',
        user: req.user._id,
        details: `Status shifted from ${oldStatus} to ${updates.status}`,
        timestamp: new Date()
      });

      if (updates.status === 'completed') {
        task.completedAt = new Date();
        task.progress = 100;
      }

      if (!isAdmin && task.createdBy.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: task.createdBy,
          sender: req.user._id,
          type: 'TASK_UPDATED',
          title: 'Mission Status Updated',
          message: `${task.title} has reached ${updates.status} phase`,
          relatedTask: task._id
        });
        emitToUser(task.createdBy.toString(), 'NOTIFICATION', { title: 'Intelligence Update', message: `${task.title}: ${updates.status}` });
      }
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar')
      .populate('team', 'name color');

    // Notify watchers via socket
    task.watchers.forEach(watcherId => {
      emitToUser(watcherId.toString(), 'TASK_UPDATED', { taskId: task._id, updates: updatedTask });
    });

    res.json({
      success: true,
      data: { task: updatedTask },
      message: 'Intelligence updated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Comment
exports.addComment = async (req, res) => {
  try {
    const { text, mentions } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Intelligence sink not found' });

    task.comments.push({
      user: req.user._id,
      text,
      mentions: mentions || [],
      createdAt: new Date()
    });

    task.activity.push({
      action: 'commented',
      user: req.user._id,
      details: 'Tactical comms added',
      timestamp: new Date()
    });

    await task.save();

    const updatedTask = await Task.findById(task._id).populate('comments.user', 'name avatar');

    if (mentions && mentions.length > 0) {
      mentions.forEach(async (mId) => {
        await Notification.create({
          recipient: mId,
          sender: req.user._id,
          type: 'TASK_MENTION',
          title: 'Direct Mention',
          message: `${req.user.name} tagged you in mission comms`,
          relatedTask: task._id
        });
      });
    }

    task.watchers.forEach(wId => {
      emitToUser(wId.toString(), 'TASK_COMMENT', { taskId: task._id, comment: task.comments[task.comments.length - 1] });
    });

    res.json({
      success: true,
      data: task.comments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Subtask Management
exports.addSubtask = async (req, res) => {
  try {
    const { title } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Objective not found' });

    task.subtasks.push({ title, completed: false });
    await task.save();

    res.json({ success: true, data: task.subtasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Objective not found' });

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ success: false, message: 'Sub-objective not found' });

    subtask.completed = !subtask.completed;
    
    // Auto-calculate progress
    const completedCount = task.subtasks.filter(s => s.completed).length;
    task.progress = Math.round((completedCount / task.subtasks.length) * 100);

    await task.save();
    res.json({ success: true, data: { subtasks: task.subtasks, progress: task.progress } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Archive Task
exports.archiveTask = async (req, res) => {
  try {
    await Task.findByIdAndUpdate(req.params.id, { isArchived: true });
    res.json({ success: true, message: 'Mission archived and redacted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Task — alias for archiveTask (soft delete for SaaS)
exports.deleteTask = exports.archiveTask;

exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar')
      .populate('team', 'name color description')
      .populate('comments.user', 'name avatar')
      .populate('watchers', 'name email avatar');

    if (!task) return res.status(404).json({ success: false, message: 'Objective not found' });

    res.json({ success: true, data: { task } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
