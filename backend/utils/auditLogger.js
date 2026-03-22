const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Creates an Audit Log entry.
 * @param {string} action 'CREATE' | 'UPDATE' | 'DELETE'
 * @param {string} resourceType 'Task' | 'Meeting' | 'User'
 * @param {ObjectId|string} resourceId 
 * @param {ObjectId|string} performedBy UserID taking the action
 * @param {object} changes { oldState, newState, details }
 */
const logAudit = async (action, resourceType, resourceId, performedBy, changes = {}) => {
  try {
    await AuditLog.create({
      action,
      resourceType,
      resourceId,
      performedBy,
      changes
    });
    logger.debug(`[AUDIT] ${action} on ${resourceType} ${resourceId} by ${performedBy}`);
  } catch (err) {
    logger.error(`Failed to create audit log for ${resourceType} ${resourceId}:`, err);
  }
};

module.exports = { logAudit };
