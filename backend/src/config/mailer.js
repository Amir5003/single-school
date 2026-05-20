const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

if (!process.env.SMTP_HOST) {
  logger.warn('SMTP_HOST is not set — email sending is disabled. Set SMTP_* env vars to enable.');
  transporter = nodemailer.createTransport({ jsonTransport: true }); // no-op transport
} else {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

module.exports = transporter;
