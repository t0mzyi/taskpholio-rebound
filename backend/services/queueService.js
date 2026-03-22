const { Queue, Worker } = require('bullmq');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  // Automatically pull from standard REDIS_URI if provided instead of split args
};

if (process.env.REDIS_URI) {
  // BullMQ connection accepts URL directly or configuration.
  Object.assign(connection, { url: process.env.REDIS_URI });
}

// 1. Create Queues
let emailQueue = null;
let notificationQueue = null;

if (process.env.REDIS_URI) {
  emailQueue = new Queue('emailQueue', { connection });
  notificationQueue = new Queue('notificationQueue', { connection });

  // 2. Email Worker
  const emailWorker = new Worker(
    'emailQueue',
    async (job) => {
      logger.info(`Processing email job ${job.id} of type ${job.name}`);
      await sendEmail(job.data);
    },
    { 
      connection,
      concurrency: 5 
    }
  );

  emailWorker.on('completed', (job) => logger.info(`Email job ${job.id} completed.`));
  emailWorker.on('failed', (job, err) => logger.error(`Email job ${job.id} failed:`, err));

  // 3. Notification Worker (Delayed)
  const notificationWorker = new Worker(
    'notificationQueue',
    async (job) => {
      logger.info(`Processing notification job ${job.id} of type ${job.name}`);
    },
    { connection }
  );

  notificationWorker.on('completed', (job) => logger.info(`Notification job ${job.id} completed.`));
  notificationWorker.on('failed', (job, err) => logger.error(`Notification job ${job.id} failed:`, err));
} else {
  logger.warn('REDIS_URI not configured. BullMQ background job queues are DISABLED.');
}

module.exports = {
  emailQueue,
  notificationQueue
};
