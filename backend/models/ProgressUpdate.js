const mongoose = require('mongoose');

const progressUpdateSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true },
    attachments: [
      {
        fileUrl: { type: String, required: true },
        fileType: { type: String, required: true },
      },
    ],
    progressIncrement: {
      type: Number,
      required: true,
      min: [0, 'Progress increment cannot be negative'],
      max: [100, 'Progress increment cannot exceed 100'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProgressUpdate', progressUpdateSchema);
