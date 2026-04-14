const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initializeSocket } = require('./socket');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render, Vercel, CloudFlare)
const server = http.createServer(app);

// Initialize Tactical Socket layer
const io = initializeSocket(server);
app.set('io', io);

// Security layer
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Cross-Origin Resource Sharing
app.use(cors({
  origin: function (origin, callback) {
    const allowedList = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://clients.labsrebound.com',
      'https://taskpholio-saas.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedList.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL Injection protection
app.use(mongoSanitize());

// Request logging
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting - Selective protection
app.use('/api/v1/health', (req, res, next) => next()); // Skip health checks
app.use('/api', apiLimiter);

// Health check protocol
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'Operational',
    timestamp: new Date().toISOString()
  });
});

// Tactical Routes
const { authLimiter } = require('./middleware/rateLimiter');
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/clients', require('./routes/clientRoutes'));
app.use('/api/v1/tasks', require('./routes/taskRoutes'));
app.use('/api/v1/teams', require('./routes/teamRoutes'));
app.use('/api/v1/meetings', require('./routes/meetingRoutes'));
app.use('/api/v1/notifications', require('./routes/notificationRoutes'));
app.use('/api/v1/analytics', require('./routes/analyticsRoutes'));
app.use('/api/v1/upload', require('./routes/uploadRoutes'));

// Error handling protocols
app.use(errorHandler);

// Strategic 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Strategic route not found'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║   🚀 TASKPHOLIO COMMAND CENTER        ║
  ║                                       ║
  ║   Port: ${PORT}                       ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}      ║
  ║   Intelligence: Connected             ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
  `);
});

// Handle unhandled strategic rejections
process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Strategic Rejection:', err);
  server.close(() => process.exit(1));
});

// Graceful decommissioning
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM received, decommissioning gracefully');
  server.close(() => {
    logger.info('✅ Operational shutdown complete');
  });
});

module.exports = server;
