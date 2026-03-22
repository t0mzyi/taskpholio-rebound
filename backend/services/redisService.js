const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisUri = process.env.REDIS_URI;

// We need a lazy initialization in case REDIS_URI is not set locally right away, 
// to prevent crashing developers machines if they just pull the repo.
let redisClient = null;
let redisSub = null; // Used for socket.io pub/sub

if (redisUri) {
  redisClient = new Redis(redisUri, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  redisSub = redisClient.duplicate();

  redisClient.on('connect', () => {
    logger.info('Redis client connected successfully.');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });
} else {
  logger.warn('REDIS_URI not provided. Redis caching and Socket.io horizontal scaling will be DISABLED.');
}

module.exports = {
  redisClient,
  redisSub,
};
