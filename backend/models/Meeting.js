const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dateTime: { type: Date, required: true },
    notes: { type: String, default: '' },
    meetingLink: { type: String, default: '' },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    reminders: [{ type: Date }],
    reminderTime: { type: Date },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

meetingSchema.index({ participants: 1 });
meetingSchema.index({ dateTime: 1 });
meetingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Meeting', meetingSchema);
