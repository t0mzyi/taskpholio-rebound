const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['planning', 'in-progress', 'review', 'completed'],
    default: 'planning'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  dueDate: {
    type: Date
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  milestones: {
    started: { status: { type: Boolean, default: false }, date: Date },
    discovery: { status: { type: Boolean, default: false }, date: Date },
    designing: { status: { type: Boolean, default: false }, date: Date, FigmaLink: String },
    development: { status: { type: Boolean, default: false }, date: Date },
    testing: { status: { type: Boolean, default: false }, date: Date },
    finalLaunch: { status: { type: Boolean, default: false }, date: Date, productLink: String }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
