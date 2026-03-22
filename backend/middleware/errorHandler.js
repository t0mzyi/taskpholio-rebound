const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.stack} | ${req.method} ${req.originalUrl}`);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, data: null, message: messages.join(', ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, data: null, message: `${field} already exists.` });
  }

  // Multer file errors
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, data: null, message: err.message });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    data: null,
    message: err.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
