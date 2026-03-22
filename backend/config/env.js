const logger = require('../utils/logger');

const validateEnv = () => {
  const requiredVars = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'FRONTEND_URL'];
  const missing = [];

  for (const v of requiredVars) {
    if (!process.env[v]) missing.push(v);
  }

  if (missing.length > 0) {
    logger.error(`[CRITICAL] Missing required environment variables: ${missing.join(', ')}`);
    logger.error('The application cannot boot safely. Exiting...');
    process.exit(1);
  }

  logger.info(`Environment validated. NODE_ENV is set to: ${process.env.NODE_ENV}`);
};

module.exports = { validateEnv };
