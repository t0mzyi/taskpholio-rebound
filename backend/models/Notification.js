const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['TASK_ASSIGNED', 'PROGRESS_UPDATE', 'DEADLINE_ALERT', 'MEETING_SCHEDULED', 'MEETING_UPDATED', 'GENERAL'],
      default: 'GENERAL',
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    relatedMeeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.post('save', async function (doc) {
  try {
    const { emitToUser } = require('../services/socketService');
    const populatedObj = await this.populate('relatedTask relatedMeeting');
    emitToUser(doc.user.toString(), 'NEW_NOTIFICATION', populatedObj);
  } catch (err) {
    console.error('Socket notification emit error:', err);
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
