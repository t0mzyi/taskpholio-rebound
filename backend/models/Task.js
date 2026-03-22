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

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'private',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed'],
      default: 'Not Started',
    },
    isDeleted: { type: Boolean, default: false },
    deadline: { type: Date },
    attachments: [attachmentSchema],
    acknowledgements: [acknowledgementSchema],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    isCompleted: { type: Boolean, default: false },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  },
  { timestamps: true }
);

taskSchema.index({ visibleTo: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ creator: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ deadline: 1 });
taskSchema.index({ createdAt: -1 });

taskSchema.pre('save', function (next) {
  this.isCompleted = this.progress >= 100;
  if (this.progress > 100) this.progress = 100;
  next();
});

module.exports = mongoose.model('Task', taskSchema);
