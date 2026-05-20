const transporter = require('../config/mailer');
const logger = require('../utils/logger');

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@schoolms.app';

/**
 * Send a temporary password to a newly created user.
 * Non-blocking — errors are caught and logged.
 */
const sendTempPassword = async (to, name, tempPassword) => {
  const subject = 'Your School Management Account — Temporary Password';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to School Management, ${name}!</h2>
      <p>Your account has been created. Use the credentials below to sign in:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Email:</td>
          <td style="padding: 8px;">${to}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Temporary password:</td>
          <td style="padding: 8px; font-family: monospace; font-size: 1.1em;">${tempPassword}</td>
        </tr>
      </table>
      <p>You will be prompted to change your password on first login.</p>
      <p style="color: #888; font-size: 0.85em;">If you did not expect this email, please contact your school administrator.</p>
    </div>
  `;
  const text = `Welcome, ${name}! Your email: ${to}. Temporary password: ${tempPassword}. Please change it on first login.`;

  try {
    await transporter.sendMail({ from: FROM, to, subject, html, text });
  } catch (err) {
    logger.error(`sendTempPassword failed for ${to}: ${err.message}`);
  }
};

/**
 * Send a password-reset link email.
 * Non-blocking — errors are caught and logged.
 */
const sendPasswordResetLink = async (to, name, resetUrl) => {
  const subject = 'Reset Your School Management Password';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset the password for your account. Click the button below to set a new password (this link expires in 1 hour):</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Reset password
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:<br><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="color: #888; font-size: 0.85em;">If you did not request a password reset, you can ignore this email — your password will not change.</p>
    </div>
  `;
  const text = `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this email.`;

  try {
    await transporter.sendMail({ from: FROM, to, subject, html, text });
  } catch (err) {
    logger.error(`sendPasswordResetLink failed for ${to}: ${err.message}`);
  }
};

module.exports = { sendTempPassword, sendPasswordResetLink };
