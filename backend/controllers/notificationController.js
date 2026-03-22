const Notification = require('../models/Notification');
const { success } = require('../utils/apiResponse');

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate('relatedTask', 'title')
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    return success(res, { notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    return success(res, {}, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};

const markOneAsRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    return success(res, { notification: notif });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markAsRead, markOneAsRead };
