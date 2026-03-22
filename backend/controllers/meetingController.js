const Meeting = require('../models/Meeting');
const Team = require('../models/Team');
const User = require('../models/User');
const Notification = require('../models/Notification'); // Kept as it's not explicitly removed and used later
const { success, error } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');
const { emailQueue } = require('../services/queueService');
const { emitToUsers } = require('../services/socketService');

const getMeetings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true }, participants: req.user._id };
    const total = await Meeting.countDocuments(filter);

    const meetings = await Meeting.find(filter)
      .populate('createdBy', 'name avatar role')
      .populate('participants', 'name avatar role')
      .sort({ dateTime: 1 })
      .skip(skip)
      .limit(limit);

    return success(res, { 
      meetings, 
      pagination: { total, page, totalPages: Math.ceil(total / limit), limit } 
    });
  } catch (err) {
    next(err);
  }
};

const createMeeting = async (req, res, next) => {
  try {
    const { title, description, participants, dateTime, notes, meetingLink, reminders, reminderTime, status } = req.body;
    if (!title || !dateTime) return error(res, 'Title and date/time are required.', 400);

    const allParticipants = [...new Set([req.user._id.toString(), ...(participants || [])])];

    const meeting = await Meeting.create({
      title,
      description: description || '',
      createdBy: req.user._id,
      participants: allParticipants,
      dateTime,
      notes,
      meetingLink,
      reminders,
      reminderTime,
      status: status || 'scheduled',
      isDeleted: false, // Added for soft delete
    });

    // Notify participants
    const notifPromises = allParticipants
      .filter((uid) => uid !== req.user._id.toString())
      .map((uid) =>
        Notification.create({
          user: uid,
          type: 'MEETING_SCHEDULED',
          message: `You have been invited to a meeting: "${title}"`,
          relatedMeeting: meeting._id,
        })
      );
    await Promise.all(notifPromises);

    const populated = await meeting.populate([
      { path: 'createdBy', select: 'name avatar role' },
      { path: 'participants', select: 'name avatar role email' }, // Added email
    ]);

    await logAudit('CREATE', 'Meeting', meeting._id, req.user._id, { newState: meeting.toObject() });

    // Send emails via Queue
    for (const participant of populated.participants) {
      if (participant._id.toString() !== req.user._id.toString() && participant.email && emailQueue) {
        await emailQueue.add('meetingInviteEmail', {
          to: participant.email,
          subject: `Meeting Scheduled: ${meeting.title}`,
          type: 'MEETING_INVITE',
          context: {
            meetingTitle: meeting.title,
            date: new Date(meeting.dateTime).toLocaleString(),
            link: meeting.meetingLink
          }
        });
      }
    }

    // Live meeting broadcast
    emitToUsers(allParticipants, 'NEW_MEETING', populated);

    return success(res, { meeting: populated }, 'Meeting scheduled successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, isDeleted: { $ne: true } }); // Check for not deleted
    if (!meeting) return error(res, 'Meeting not found.', 404);
    if (meeting.createdBy.toString() !== req.user._id.toString()) {
      return error(res, 'Only the meeting creator can update it.', 403);
    }

    const oldState = meeting.toObject(); // For audit logging

    const updated = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('createdBy', 'name avatar role')
      .populate('participants', 'name avatar role');

    await logAudit('UPDATE', 'Meeting', updated._id, req.user._id, { oldState, newState: updated.toObject() });

    // Send MEETING_UPDATED notifications to all participants
    const notifPromises = (updated.participants || [])
      .filter((p) => p._id.toString() !== req.user._id.toString())
      .map((p) =>
        Notification.create({
          user: p._id,
          type: 'MEETING_UPDATED',
          message: `Meeting "${updated.title}" has been updated`,
          relatedMeeting: updated._id,
        })
      );
    await Promise.all(notifPromises);

    // Live update broadcast
    emitToUsers(updated.participants.map(p => p._id.toString()), 'MEETING_UPDATED', updated);

    return success(res, { meeting: updated }, 'Meeting updated successfully');
  } catch (err) {
    next(err);
  }
};

const deleteMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true }, createdBy: req.user._id }, // Changed to createdBy
      { isDeleted: true },
      { new: true }
    );
    if (!meeting) return error(res, 'Meeting not found or you are not authorized to delete it.', 404); // Updated error message

    await logAudit('DELETE', 'Meeting', meeting._id, req.user._id, { details: 'Soft deleted meeting' });

    // Live delete broadcast
    return success(res, {}, 'Meeting deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { getMeetings, createMeeting, updateMeeting, deleteMeeting };
