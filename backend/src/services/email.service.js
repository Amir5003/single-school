const transporter = require('../config/mailer');
const logger = require('../utils/logger');

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@schoolms.app';

const APP_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Send a temporary password to a newly created user.
 * Non-blocking — errors are caught and logged.
 *
 * This email is the End User's FIRST contact with the platform: their account
 * was created by a school administrator, not by them. It therefore carries the
 * privacy notice — who created the account, what is held, and where to read
 * more. See specs/011-legal-terms-privacy (FR-007).
 *
 * @param {string} to
 * @param {string} name
 * @param {string} tempPassword
 * @param {string} [schoolName]  Named in the notice; omitted falls back to
 *                               generic wording rather than printing "undefined".
 */
const sendTempPassword = async (to, name, tempPassword, schoolName) => {
  const privacyUrl = `${APP_URL()}/privacy`;
  const creator = schoolName || 'Your school';
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
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #4b5563; font-size: 0.9em; line-height: 1.6;">
        <strong>About your data.</strong> ${creator} created this account for you and
        decides what is recorded in it — your contact details, class, attendance,
        marks and fee records. We store that information on the school's behalf and
        use it for nothing else: there is no advertising and no tracking in this
        product, and your data is never sold.
        To see, correct or remove anything held about you, contact your school.
        Full privacy notice: <a href="${privacyUrl}">${privacyUrl}</a>
      </p>
      <p style="color: #888; font-size: 0.85em;">If you were not expecting this email, please contact your school directly before signing in.</p>
    </div>
  `;
  const text = [
    `Welcome, ${name}! Your email: ${to}. Temporary password: ${tempPassword}.`,
    'Please change it on first login.',
    '',
    `About your data: ${creator} created this account for you and decides what is`,
    'recorded in it. We store it on the school\'s behalf and use it for nothing else —',
    'no advertising, no tracking, never sold. To see, correct or remove anything held',
    'about you, contact your school.',
    `Full privacy notice: ${privacyUrl}`,
    '',
    'If you were not expecting this email, contact your school directly before signing in.',
  ].join('\n');

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
