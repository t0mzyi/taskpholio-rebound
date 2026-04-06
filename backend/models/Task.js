const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const acknowledgementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['seen', 'accepted'], required: true },
  at: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxLength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxLength: [5000, 'Description too long']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must be assigned'],
    index: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'review', 'completed', 'blocked'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  dueDate: {
    type: Date,
    index: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },
  startDate: Date,
  completedAt: Date,
  estimatedHours: Number,
  actualHours: Number,
  
  // Attachments
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number,
    publicId: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Comments
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Subtasks
  subtasks: [{
    title: String,
    completed: { type: Boolean, default: false },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Tags
  tags: [String],
  
  // Watchers (users following this task)
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Activity Log
  activity: [{
    action: String, // 'created', 'updated', 'commented', 'status_changed'
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    details: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  isArchived: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Indexes for performance
taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ team: 1, status: 1 });
taskSchema.index({ createdBy: 1, createdAt: -1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ title: 'text', description: 'text' }); // Text search

// Update team stats when task changes
taskSchema.post('save', async function() {
  const Team = mongoose.model('Team');
  const Task = mongoose.model('Task');
  
  const stats = await Task.aggregate([
    { $match: { team: this.team } },
    { $group: {
      _id: null,
      totalTasks: { $sum: 1 },
      completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      activeTasks: { $sum: { $cond: [{ $ne: ['$status', 'completed'] }, 1, 0] } }
    }}
  ]);
  
  if (stats.length > 0) {
    await Team.findByIdAndUpdate(this.team, { stats: stats[0] });
  }
});

module.exports = mongoose.model('Task', taskSchema);
