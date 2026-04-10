const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  }],
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  meetingLink: String,
  location: String,
  type: {
    type: String,
    enum: ['online', 'offline'],
    default: 'online'
  },
  agenda: [String],
  notes: String,
  attachments: [{
    fileName: String,
    fileUrl: String,
    publicId: String
  }],
  reminder: {
    enabled: { type: Boolean, default: true },
    minutes: { type: Number, default: 15 } // minutes before
  },
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    endDate: Date
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
