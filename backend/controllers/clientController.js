const Client = require('../models/Client');
const Project = require('../models/Project');
const Agreement = require('../models/Agreement');
const Message = require('../models/Message');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const crypto = require('crypto');

// Log Activity might be useful if needed, but not required strictly yet

// Generate token for client invite
const generateInviteToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create a new client (Admin only)
exports.createClient = async (req, res) => {
  try {
    const { name, company } = req.body;
    const email = req.body.email.toLowerCase();

    if (!name || !email || !company) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and company'
      });
    }

    const existingClient = await Client.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Client with this email already exists (Case-insensitive check)'
      });
    }

    const inviteToken = generateInviteToken();

    const client = await Client.create({
      name,
      email,
      company,
      inviteToken,
      createdBy: req.user._id,
      status: 'pending' // They are pending until they sign up on client portal
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: {
        client,
        inviteToken // Return the token so frontend can generate link
      }
    });

  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: error.message
    });
  }
};

// Get all clients (Admin only)
exports.getClients = async (req, res) => {
  try {
    const clients = await Client.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).populate('createdBy', 'name email');
    res.json({
      success: true,
      data: { clients }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
      error: error.message
    });
  }
};

// Get single client
exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    res.json({
      success: true,
      data: { client }
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message
    });
  }
};

// Update client
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      data: { client }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update client',
      error: error.message
    });
  }
};

// Soft Delete Client (marks isDeleted=true, preserves all records)
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Client archived successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive client',
      error: error.message
    });
  }
};

// Activate Client (Called from Client Portal)
exports.activateClient = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: 'Email and token are required'
      });
    }

    // Find the client by email and token
    const client = await Client.findOne({ email: email.toLowerCase() }).select('+inviteToken');
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // We only check if the token matches or bypass if they somehow already verified
    if (client.inviteToken !== token && client.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite token'
      });
    }

    client.status = 'active';
    client.lastLogin = Date.now();
    // Optional: clear the inviteToken so it can't be reused, but let's keep it just in case or just change status
    
    await client.save();

    res.json({
      success: true,
      message: 'Client activated successfully',
      data: {
        client: {
          _id: client._id,
          name: client.name,
          email: client.email,
          company: client.company,
          status: client.status
        }
      }
    });

  } catch (error) {
    console.error('Activate client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate client',
      error: error.message
    });
  }
};

// Get tasks for the Client Portal (Publicly accessible with email/token)
exports.getPortalTasks = async (req, res) => {
  try {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: 'Email and token are required'
      });
    }

    const client = await Client.findOne({ email: email.toLowerCase() }).select('+inviteToken');
    
    if (!client || client.inviteToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Please use your valid invite link.'
      });
    }

    // Fetch tasks linked to this client
    const Task = require('../models/Task');
    const tasks = await Task.find({ client: client._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        tasks,
        client: {
          _id: client._id,
          name: client.name,
          company: client.company,
          status: client.status
        }
      }
    });

  } catch (error) {
    console.error('Portal tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portal data',
      error: error.message
    });
  }
};

// Get Client Portal dashboard by email only (Supabase already verified identity)
exports.getPortalProfile = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const client = await Client.findOne({ email: email.toLowerCase() });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'No client account found for this email. Contact your project manager.'
      });
    }

    const Task = require('../models/Task');
    const tasks = await Task.find({ client: client._id }).sort({ createdAt: -1 });

    const activeTasks = tasks.filter(t => t.status !== 'completed').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    res.json({
      success: true,
      data: {
        client: { _id: client._id, name: client.name, company: client.company, status: client.status },
        tasks,
        metrics: { totalTasks: tasks.length, activeTasks, completedTasks }
      }
    });
  } catch (error) {
    console.error('Portal profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch portal data', error: error.message });
  }
};
// Project Management
exports.createProject = async (req, res) => {
  try {
    const { name, description, dueDate, progress, milestones } = req.body;
    const project = await Project.create({
      name,
      description,
      dueDate,
      progress: progress || 0,
      milestones,
      client: req.params.id,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, data: { project } });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, message: 'Failed to create project', error: err.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ client: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { projects } });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch projects', error: err.message });
  }
};

// Agreement Management
exports.createAgreement = async (req, res) => {
  try {
    const { name, fileUrl, fileType, fileSize, category, project } = req.body;
    const agreement = await Agreement.create({
      name,
      fileUrl,
      fileType: fileType || 'link',
      fileSize,
      category: category || 'Agreement',
      project,
      client: req.params.id,
      uploadedBy: req.user._id
    });
    res.status(201).json({ success: true, data: { agreement } });
  } catch (err) {
    console.error('Create agreement error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload agreement', error: err.message });
  }
};

exports.getAgreements = async (req, res) => {
  try {
    const agreements = await Agreement.find({ client: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { agreements } });
  } catch (err) {
    console.error('Get agreements error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agreements', error: err.message });
  }
};

// Update Project
exports.updateProject = async (req, res) => {
  try {
    const { milestones, ...otherData } = req.body;
    let updateData = { ...otherData };
    
    if (milestones) {
      // Find the project first to merge milestones
      const existingProject = await Project.findById(req.params.projectId);
      if (existingProject) {
        updateData.milestones = { 
          ...existingProject.milestones.toObject(), 
          ...milestones 
        };
      }
    }

    const project = await Project.findByIdAndUpdate(
      req.params.projectId, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: { project } });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, message: 'Failed to update project', error: err.message });
  }
};


// Update Agreement
exports.updateAgreement = async (req, res) => {
  try {
    const agreement = await Agreement.findByIdAndUpdate(req.params.agreementId, req.body, { new: true, runValidators: true });
    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found' });
    res.json({ success: true, data: { agreement } });
  } catch (err) {
    console.error('Update agreement error:', err);
    res.status(500).json({ success: false, message: 'Failed to update agreement', error: err.message });
  }
};


// Portal Projects
exports.getPortalProjects = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) return res.status(400).json({ success: false, message: 'Email and token are required' });

    const client = await Client.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+inviteToken');
    if (!client || client.inviteToken !== token) {
      return res.status(401).json({ success: false, message: 'Portal access denied' });
    }

    const projects = await Project.find({ client: client._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { projects } });
  } catch (err) {
    console.error('Portal projects error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch portal projects', error: err.message });
  }
};

// Portal Agreements
exports.getPortalAgreements = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) return res.status(400).json({ success: false, message: 'Email and token are required' });

    const client = await Client.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+inviteToken');
    if (!client || client.inviteToken !== token) {
      return res.status(401).json({ success: false, message: 'Portal access denied' });
    }

    const agreements = await Agreement.find({ client: client._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { agreements } });
  } catch (err) {
    console.error('Portal agreements error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch portal vault', error: err.message });
  }
};

// Chat Persistence
exports.getClientMessages = async (req, res) => {
  try {
    const messages = await Message.find({ client: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: { messages } });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: err.message });
  }
};

exports.getPortalMessages = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) return res.status(400).json({ success: false, message: 'Email and token are required' });

    const client = await Client.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+inviteToken');
    
    if (!client || client.inviteToken !== token) {
      return res.status(401).json({ success: false, message: 'Portal access denied' });
    }

    const messages = await Message.find({ client: client._id }).sort({ createdAt: 1 });
    res.json({ 
      success: true, 
      data: { 
        messages,
        clientId: client._id 
      } 
    });
  } catch (err) {
    console.error('Portal messages error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch portal messages', error: err.message });
  }
};

// Portal Meetings
exports.getPortalMeetings = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) return res.status(400).json({ success: false, message: 'Email and token are required' });

    const client = await Client.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+inviteToken');
    
    if (!client || client.inviteToken !== token) {
      return res.status(401).json({ success: false, message: 'Portal access denied' });
    }

    const meetings = await Meeting.find({ client: client._id }).sort({ startTime: 1 });
    res.json({ success: true, data: { meetings } });
  } catch (err) {
    console.error('Portal meetings error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch portal meetings', error: err.message });
  }
};

exports.requestPortalMeeting = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) return res.status(400).json({ success: false, message: 'Email and token are required' });

    const client = await Client.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+inviteToken');
    
    if (!client || client.inviteToken !== token) {
      return res.status(401).json({ success: false, message: 'Portal access denied' });
    }

    const { title, description, startTime, endTime, type, agenda } = req.body;
    
    const meeting = await Meeting.create({
      title,
      description,
      client: client._id,
      scheduledBy: client.createdBy, // Associated user handles the client
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 30 * 60000), // Default 30m
      type: type || 'online',
      agenda: agenda || [],
      status: 'pending'
    });

    const admins = await User.find({ role: { $in: ['CEO', 'CTO', 'Admin'] }, isActive: true });
    
    // Broadcast socket safely using socket.js export if we set it up
    const serverIo = req.app.get('io');
    if (serverIo) {
      admins.forEach(a => {
        serverIo.to(`user_${a._id.toString()}`).emit('NOTIFICATION', {
          title: 'Client Briefing Request',
          message: `${client.name || 'A client'} just requested a meeting. Check their profile.`
        });
      });
    }

    const adminIds = admins.map(a => a._id.toString());
    res.status(201).json({ success: true, data: { meeting }, adminIds });
  } catch (err) {
    console.error('Request portal meeting error:', err);
    res.status(500).json({ success: false, message: 'Failed to request meeting', error: err.message });
  }
};

// Admin Client Meetings
exports.getClientMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ client: req.params.id }).sort({ startTime: 1 });
    res.json({ success: true, data: { meetings } });
  } catch (err) {
    console.error('Get client meetings error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch client meetings', error: err.message });
  }
};

exports.createClientMeeting = async (req, res) => {
  try {
    const { title, description, startTime, endTime, type, meetingLink } = req.body;
    const meeting = await Meeting.create({
      title,
      description,
      client: req.params.id,
      scheduledBy: req.user._id,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 60 * 60000), // Default 1hr
      type: type || 'online',
      meetingLink,
      status: 'scheduled'
    });
    res.status(201).json({ success: true, data: { meeting } });
  } catch (err) {
    console.error('Create client meeting error:', err);
    res.status(500).json({ success: false, message: 'Failed to create client meeting', error: err.message });
  }
};

exports.approveClientMeeting = async (req, res) => {
  try {
    const { meetingLink } = req.body;
    const meeting = await Meeting.findOne({ _id: req.params.meetingId, client: req.params.id });
    
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Briefing not found' });
    }

    meeting.status = 'scheduled';
    if (meetingLink) {
      meeting.meetingLink = meetingLink;
    }
    
    await meeting.save();
    res.json({ success: true, data: { meeting } });
  } catch (err) {
    console.error('Approve client meeting error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve client meeting', error: err.message });
  }
};
