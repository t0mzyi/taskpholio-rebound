const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Agreement name is required'],
    trim: true
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  fileType: {
    type: String, // 'pdf', 'image', 'doc', 'link'
    default: 'link'
  },
  category: {
    type: String,
    enum: ['Agreement', 'Invoice', 'Document', 'Other'],
    default: 'Agreement'
  },
  fileSize: {
    type: String
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'signed', 'expired'],
    default: 'draft'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Agreement', agreementSchema);
