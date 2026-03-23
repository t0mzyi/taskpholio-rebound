const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const Sentry = require('@sentry/node');
const mongoose = require('mongoose'); // Added for graceful shutdown

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing ENV variable: ${key}`);
    process.exit(1);
  }
});

console.log("ENV CHECK:", {
  mongo: !!process.env.MONGO_URI,
  jwt: !!process.env.JWT_SECRET
});

const connectDB = require('./config/db');
const { apiLimiter, strictUserLimiter, moderateUserLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const teamRoutes = require('./routes/teamRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Connect to MongoDB
connectDB();

// Log server timezone offset
logger.info(`Server timezone offset: ${new Date().getTimezoneOffset()}`);

const app = express();

app.use((req, res, next) => {
  console.log(`[DIAGNOSTIC] ${req.method} ${req.url}`);
  next();
});

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1 && allowedOrigins.indexOf("*") === -1) {
      // If you want to be permissive during dev, you can use:
      // return callback(null, true);
      // But for production, we should match.
      return callback(null, true); // Temporarily allow for debugging
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Request logging
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Timeout Middleware
app.use((req, res, next) => {
  req.setTimeout(15000); // 15s timeout
  res.setTimeout(15000);
  next();
});

// Serve frontend uploads statically (Development)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global rate limiter
app.use('/api', apiLimiter);

// Routes - Advanced Rate Limits Apply to V1 Namespace
const v1Router = express.Router();
v1Router.use('/tasks', strictUserLimiter, taskRoutes);
v1Router.use('/teams', moderateUserLimiter, teamRoutes);
v1Router.use('/meetings', strictUserLimiter, meetingRoutes);
v1Router.use('/notifications', moderateUserLimiter, notificationRoutes);
v1Router.use('/analytics', moderateUserLimiter, analyticsRoutes);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', v1Router);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, data: null, message: 'Route not found' }));

// Global Error Handler
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

const http = require('http');

const PORT = process.env.PORT || 5000;

// Integrates Socket.io smoothly atop the Express layer
const server = http.createServer(app);
const { initializeSocket } = require('./services/socketService');
initializeSocket(server);
app.set('socketService', require('./services/socketService'));

const nodeServer = server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Graceful Shutdown routines
const gracefulShutdown = () => {
  logger.info('SIGTERM/SIGINT signal received: closing HTTP server');
  nodeServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = server;
