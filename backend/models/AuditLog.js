const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { 
    type: String, 
    enum: ['CREATE', 'UPDATE', 'DELETE'], 
    required: true 
  },
  resourceType: { 
    type: String, 
    required: true // e.g., 'Task', 'Meeting', 'User'
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changes: {
    oldState: { type: mongoose.Schema.Types.Mixed },
    newState: { type: mongoose.Schema.Types.Mixed },
    details: { type: String }
  }
}, { timestamps: true });

auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
