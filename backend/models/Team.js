const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  color: {
    type: String,
    default: '#3B82F6'
  },
  icon: String,
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  stats: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    activeTasks: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
