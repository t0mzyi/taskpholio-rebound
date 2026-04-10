const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Client = require('./models/Client');
const Message = require('./models/Message');
const logger = require('./utils/logger');

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'https://taskpholio-saas.vercel.app'
        ];
        
        // Add custom origins from env if provided
        if (process.env.ALLOWED_ORIGINS) {
          allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
        }

        const allowedList = allowedOrigins.filter(Boolean);
        if (!origin || allowedList.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          logger.warn(`🚫 Socket CORS blocked: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket authentication middleware (Supports Admin & Client)
  io.use(async (socket, next) => {
    try {
      const { token, email, type } = socket.handshake.auth;
      logger.info(`🔍 Socket Handshake Attempt: Type=${type}, Email=${email || 'N/A'}`);
      
      if (!token) {
        logger.warn('⚠️ Socket auth failed: No token provided');
        return next(new Error('Authentication error: No credentials provided'));
      }

      if (type === 'client') {
        const client = await Client.findOne({ 
          email: { $regex: new RegExp(`^${email}$`, 'i') } 
        }).select('+inviteToken');
        
        if (!client || client.inviteToken !== token) {
          logger.error(`❌ Socket Client auth failed: Email=${email}`);
          return next(new Error('Authentication error: Invalid invite credentials'));
        }
        socket.user = { _id: client._id, name: client.name, type: 'Client', company: client.company };
        return next();
      }

      // Admin / User Authentication (Match requireAuth.js logic)
      let decoded;
      let isSupabaseToken = false;

      try {
        // Try standard JWT
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        // Try Supabase JWT
        if (process.env.SUPABASE_JWT_SECRET) {
          try {
            decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
            isSupabaseToken = true;
          } catch (supaErr) {
            logger.error(`❌ Socket Supabase JWT verify failed: ${supaErr.message}`);
            return next(new Error('Authentication error: Invalid token'));
          }
        } else {
          // Dev fallback: decode without verification
          decoded = jwt.decode(token);
          if (!decoded || !decoded.sub) {
            logger.error(`❌ Socket JWT verify & decode failed: ${err.message}`);
            return next(new Error('Authentication error: Invalid token'));
          }
          isSupabaseToken = true;
          logger.warn('⚠️ Socket using unverified dev-fallback token');
        }
      }

      const User = require('./models/User');
      let user;

      if (isSupabaseToken) {
        const supaEmail = decoded.email;
        if (supaEmail) user = await User.findOne({ email: supaEmail });
        
        if (!user) {
          // Synthesize user object as per auth.js
          const role = decoded.user_metadata?.role || 'CEO';
          socket.user = {
            _id: decoded.sub,
            name: decoded.user_metadata?.full_name || decoded.email || 'Admin',
            type: 'User',
            role: role.toUpperCase()
          };
        } else {
          socket.user = { _id: user._id, name: user.name, type: 'User', role: user.role };
        }
      } else {
        user = await User.findById(decoded.id);
        if (!user) return next(new Error('Authentication error: User not found'));
        socket.user = { _id: user._id, name: user.name, type: 'User', role: user.role };
      }

      logger.info(`⭐ Socket Authenticated: ${socket.user.name} (${socket.user.type})`);
      next();
    } catch (error) {
      logger.error('❌ Socket auth critical error:', error.message);
      next(new Error(`Authentication error: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`✅ ${socket.user.type} Connected: ${socket.user.name} - SID: ${socket.id}`);

    // Standard scoping
    socket.join(`user_${socket.user._id}`);
    
    // Join Chat Thread
    socket.on('join_chat', (clientId) => {
      socket.join(`chat_${clientId}`);
      logger.info(`💬 ${socket.user.name} joined chat_${clientId}`);
    });

    // Message Hub
    socket.on('send_message', async (data) => {
      try {
        const { text, clientId, attachments } = data;
        
        const newMessage = await Message.create({
          text,
          client: clientId,
          sender: socket.user._id,
          senderType: socket.user.type,
          attachments: attachments || []
        });

        // Emit to all in the chat room (Admin + Client)
        io.to(`chat_${clientId}`).emit('new_message', newMessage);
        
        // Optional: Notify via system notification if recipient offline
        // (Implementation can be added here)
      } catch (err) {
        logger.error('Message emission failed:', err.message);
      }
    });

    // Typing Indicators
    socket.on('typing_start', (clientId) => {
      socket.to(`chat_${clientId}`).emit('user_typing', {
        name: socket.user.name,
        type: socket.user.type
      });
    });

    socket.on('typing_stop', (clientId) => {
      socket.to(`chat_${clientId}`).emit('user_stopped_typing');
    });

    socket.on('disconnect', () => {
      logger.info(`❌ ${socket.user.type} Disconnected: ${socket.user.name}`);
    });
  });

  return io;
}

module.exports = { initializeSocket };
