const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail', // or use host/port natively
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
} else {
  logger.warn('SMTP Credentials missing! Emails will only be mocked to the console.');
}

const sendEmail = async ({ to, subject, type, context }) => {
  let html = '';
  
  // Basic mock templating engine
  switch (type) {
    case 'FORGOT_PASSWORD':
      html = `<h1>Password Reset</h1><p>Reset your password here: ${context.link}</p>`;
      break;
    case 'TASK_ASSIGNED':
      html = `<h1>New Task: ${context.taskTitle}</h1><p>You have been assigned a new task by ${context.assignerName}.</p>`;
      break;
    case 'MEETING_INVITE':
      html = `<h1>Meeting Scheduled: ${context.meetingTitle}</h1><p>Time: ${context.date}</p><p>Link: ${context.link}</p>`;
      break;
    default:
      html = `<p>${context.message || 'No content provided.'}</p>`;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Taskpholio" <noreply@taskpholio.com>',
    to,
    subject,
    html,
  };

  try {
    if (transporter) {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } else {
      logger.info(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
      logger.info(`[MOCK EMAIL BODY] ${html}`);
      return { mock: true };
    }
  } catch (err) {
    logger.error(`Error sending email to ${to}:`, err);
    throw err;
  }
};

module.exports = { sendEmail };
