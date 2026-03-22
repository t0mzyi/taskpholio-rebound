const Task = require('../models/Task');
const User = require('../models/User');
const Team = require('../models/Team');
const { success, error } = require('../utils/apiResponse');
const { redisClient } = require('../services/redisService');

const getAdvancedAnalytics = async (req, res, next) => {
  try {
    const cacheKey = `analytics:${req.user._id}`;
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return success(res, JSON.parse(cached), 'Analytics retrieved from cache');
      }
    }

    const now = new Date();
    
    // 1. Overdue tracking (Tasks assigned to me or created by me that crossed deadline and not completed)
    const overdueFilter = {
      $or: [{ creator: req.user._id }, { assignedTo: req.user._id }],
      isCompleted: false,
      deadline: { $lt: now, $ne: null },
      isDeleted: { $ne: true }
    };
    const overdueTasks = await Task.countDocuments(overdueFilter);

    // 2. Completion Trends (Last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completionTrends = await Task.aggregate([
      {
        $match: {
          $or: [{ visibility: 'public' }, { visibleTo: req.user._id }],
          status: 'Completed',
          updatedAt: { $gte: thirtyDaysAgo },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          completedTasks: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Team performance metrics (For CEO/CTO only to see overall, Members see their own team)
    let teamMetrics = [];
    if (['CEO', 'CTO'].includes(req.user.role)) {
      teamMetrics = await Task.aggregate([
        { $match: { team: { $ne: null }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: "$team",
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
            },
            avgProgress: { $avg: "$progress" }
          }
        },
        {
          $lookup: {
            from: "teams",
            localField: "_id",
            foreignField: "_id",
            as: "teamData"
          }
        },
        { $unwind: "$teamData" },
        {
          $project: {
            teamName: "$teamData.name",
            totalTasks: 1,
            completedTasks: 1,
            avgProgress: 1,
            completionRate: {
              $multiply: [{ $divide: ["$completedTasks", "$totalTasks"] }, 100]
            }
          }
        }
      ]);
    } else if (req.user.team) {
      // Member sees their own team
      const teamId = req.user.team._id || req.user.team;
      const metrics = await Task.aggregate([
        { $match: { team: teamId, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: "$team",
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
            },
            avgProgress: { $avg: "$progress" }
          }
        }
      ]);
      const teamObj = await Team.findById(teamId).select('name');
      if (metrics.length > 0) {
        teamMetrics = [{
          teamName: teamObj.name,
          totalTasks: metrics[0].totalTasks,
          completedTasks: metrics[0].completedTasks,
          avgProgress: metrics[0].avgProgress,
          completionRate: (metrics[0].completedTasks / metrics[0].totalTasks) * 100
        }];
      }
    }

    const payload = { overdueTasks, completionTrends, teamMetrics };

    if (redisClient) {
      await redisClient.setex(cacheKey, 300, JSON.stringify(payload));
    }

    return success(res, payload);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAdvancedAnalytics };
