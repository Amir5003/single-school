const request = require('supertest');
const app = require('../../src/app');
const { createSchool, createSchoolAdmin, createStudent, createTeacher, getAuthCookies } = require('../helpers');
const PasswordResetToken = require('../../src/models/PasswordResetToken.model');
const User = require('../../src/models/User.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Mock nodemailer to avoid real SMTP calls in tests
jest.mock('../../src/config/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
}));

describe('Password Reset Flow', () => {
  let school, adminUser, adminCookies, studentUser, studentCookies;

  beforeEach(async () => {
    school = await createSchool();
    adminUser = await createSchoolAdmin(school._id);
    adminCookies = getAuthCookies(adminUser);
    const s = await createStudent(school._id, null, { studentFields: { dateOfBirth: '2010-01-01' } });
    studentUser = s.user;
    studentCookies = getAuthCookies(studentUser);
  });

  // ── Forgot password ──────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/forgot-password', () => {
    it('200 — valid email creates a PasswordResetToken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: studentUser.email });
      expect(res.status).toBe(200);

      const token = await PasswordResetToken.findOne({ userId: studentUser._id });
      expect(token).toBeTruthy();
      expect(token.used).toBe(false);
    });

    it('200 — unknown email also returns 200 (no enumeration)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' });
      expect(res.status).toBe(200);
    });

    it('422 — invalid email format returns 422', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
    });
  });

  // ── Reset password ───────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/reset-password', () => {
    let rawToken;

    beforeEach(async () => {
      rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await PasswordResetToken.create({
        userId: studentUser._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
      });
    });

    it('200 — valid token resets password and marks token used', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPass@123' });
      expect(res.status).toBe(200);

      const tokenDoc = await PasswordResetToken.findOne({ userId: studentUser._id });
      expect(tokenDoc.used).toBe(true);

      const updated = await User.findById(studentUser._id).select('+password');
      const isMatch = await bcrypt.compare('NewPass@123', updated.password);
      expect(isMatch).toBe(true);
    });

    it('400 — expired token returns 400', async () => {
      await PasswordResetToken.updateMany({ userId: studentUser._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPass@123' });
      expect(res.status).toBe(400);
    });

    it('400 — already-used token returns 400', async () => {
      await PasswordResetToken.updateMany({ userId: studentUser._id }, { $set: { used: true } });
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPass@123' });
      expect(res.status).toBe(400);
    });

    it('422 — short new password returns 422', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'short' });
      expect(res.status).toBe(422);
    });
  });

  // ── Change password ──────────────────────────────────────────────────────────
  describe('PUT /api/v1/auth/change-password', () => {
    it('200 — correct current password changes password and clears mustChangePassword', async () => {
      await User.findByIdAndUpdate(studentUser._id, { mustChangePassword: true });

      const res = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Cookie', studentCookies)
        .send({ currentPassword: 'Password1', newPassword: 'NewSecure@99' });
      expect(res.status).toBe(200);

      const updated = await User.findById(studentUser._id);
      expect(updated.mustChangePassword).toBe(false);
    });

    it('401 — wrong current password returns 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Cookie', studentCookies)
        .send({ currentPassword: 'WrongPassword', newPassword: 'NewSecure@99' });
      expect(res.status).toBe(401);
    });

    it('401 — unauthenticated request returns 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/change-password')
        .send({ currentPassword: 'Password1', newPassword: 'NewSecure@99' });
      expect(res.status).toBe(401);
    });
  });
});
