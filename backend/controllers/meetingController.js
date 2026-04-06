const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const { emitToUser, emitToUsers } = require('../services/socketService');

// Create Meeting
exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      attendees,
      teams,
      startTime,
      endTime,
      meetingLink,
      location,
      type,
      agenda
    } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Tactical Failure: Missing critical briefing parameters'
      });
    }

    const meeting = await Meeting.create({
      title,
      description,
      scheduledBy: req.user._id,
      attendees: (attendees || []).map(userId => ({ user: userId, status: 'pending' })),
      teams: teams || [],
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      meetingLink,
      location,
      type: type || 'online',
      agenda: agenda || [],
      status: 'scheduled'
    });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('scheduledBy', 'name email avatar')
      .populate('attendees.user', 'name email avatar')
      .populate('teams', 'name color');

    // Create notifications for attendees
    if (attendees && attendees.length > 0) {
      for (const aId of attendees) {
        if (aId.toString() === req.user._id.toString()) continue;
        await Notification.create({
          recipient: aId,
          sender: req.user._id,
          type: 'MEETING_SCHEDULED',
          title: 'Briefing Scheduled',
          message: `Mission objective briefing scheduled: ${title}`,
          relatedMeeting: meeting._id
        });
        emitToUser(aId.toString(), 'MEETING_ALERT', populatedMeeting);
      }
    }

    res.status(201).json({
      success: true,
      data: populatedMeeting
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Meetings
exports.getMeetings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, upcoming, page = 1, limit = 20 } = req.query;

    let query = {
      $or: [
        { scheduledBy: userId },
        { 'attendees.user': userId },
        { teams: req.user.team }
      ]
    };

    if (status) query.status = status;
    if (upcoming === 'true') {
      query.startTime = { $gte: new Date() };
    }

    const skip = (page - 1) * limit;

    const meetings = await Meeting.find(query)
      .populate('scheduledBy', 'name email avatar')
      .populate('attendees.user', 'name email avatar role')
      .populate('teams', 'name color')
      .populate('client', 'name email company')
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Meeting.countDocuments(query);

    res.json({
      success: true,
      data: meetings,
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

// Update Meeting
exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Briefing not found' });

    // Only scheduler or Admin can update
    const isAdmin = req.user.role === 'CEO' || req.user.role === 'CTO';
    if (!isAdmin && meeting.scheduledBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access Denied: Briefing locked' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        meeting[key] = updates[key];
      }
    });

    await meeting.save();

    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('scheduledBy', 'name email avatar')
      .populate('attendees.user', 'name email avatar')
      .populate('teams', 'name color');

    // Notify attendees
    meeting.attendees.forEach(async (attendee) => {
      if (attendee.user.toString() === req.user._id.toString()) return;
      await Notification.create({
        recipient: attendee.user,
        sender: req.user._id,
        type: 'MEETING_UPDATED',
        title: 'Briefing Updated',
        message: `${meeting.title} parameters have shifted`,
        relatedMeeting: meeting._id
      });
    });

    res.json({
      success: true,
      data: updatedMeeting,
      message: 'Briefing updated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Attendance
exports.updateAttendance = async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'declined'
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Briefing not found' });

    const attendee = meeting.attendees.find(a => a.user.toString() === req.user._id.toString());
    if (!attendee) return res.status(404).json({ success: false, message: 'You are not assigned to this briefing' });

    attendee.status = status;
    await meeting.save();

    res.json({
      success: true,
      message: `Status recorded: ${status.toUpperCase()}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel Meeting
exports.cancelMeeting = async (req, res) => {
  try {
    await Meeting.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ success: true, message: 'Briefing scrubbed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
