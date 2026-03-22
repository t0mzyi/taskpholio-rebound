const rateLimit = require('express-rate-limit');
const { error } = require('../utils/apiResponse');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  validate: { default: false },
  handler: (req, res) => {
    error(res, 'Too many requests, please try again later.', 429);
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, // Stricter limit: 5 attempts per 15 minutes
  validate: { default: false },
  handler: (req, res) => {
    error(res, 'Too many authentication attempts, please try again later.', 429);
  }
});

// Advanced dynamic limiter per JWT user ID (Protects spamming API even if IP rotates)
const createDynamicUserLimiter = (maxRequestsPerMinute) => {
  return rateLimit({
    windowMs: 60 * 1000,
    max: maxRequestsPerMinute,
    validate: { default: false },
    keyGenerator: (req) => {
      // Use UserID if auth middleware passed, otherwise fallback to IP
      return req.user ? req.user._id.toString() : (req.ip || 'unknown_ip');
    },
    handler: (req, res) => {
      error(res, `Rate limit exceeded. Maximum ${maxRequestsPerMinute} requests per minute allowed.`, 429);
    }
  });
};

const strictUserLimiter = createDynamicUserLimiter(30); // E.g., for task creations
const moderateUserLimiter = createDynamicUserLimiter(60); // Generic reads

module.exports = {
  apiLimiter,
  authLimiter,
  strictUserLimiter,
  moderateUserLimiter
};
