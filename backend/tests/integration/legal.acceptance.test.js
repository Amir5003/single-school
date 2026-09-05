const request = require('supertest');
const app = require('../../src/app');
const School = require('../../src/models/School.model');
const User = require('../../src/models/User.model');
const { TERMS_VERSION, PRIVACY_VERSION } = require('../../src/constants/legalVersions');
const {
  createSchool,
  createSchoolAdmin,
  createStudent,
  getAuthCookies,
} = require('../helpers');

// Mock nodemailer so the credential email never reaches a real SMTP server.
jest.mock('../../src/config/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const register = (data) =>
  request(app).post('/api/v1/onboarding/register').send(data);

const validPayload = (id, overrides = {}) => ({
  name: 'Acceptance Academy',
  slug: `accept-${id}`,
  adminEmail: `admin-${id}@accept.test`,
  adminPassword: 'Password1!',
  acceptedTerms: true,
  ...overrides,
});

// ── The acceptance gate ───────────────────────────────────────────────────────

describe('Terms acceptance is enforced server-side', () => {
  it('422 — registration without acceptedTerms is rejected', async () => {
    const { acceptedTerms, ...noAcceptance } = validPayload(`no-${Date.now()}`);
    const res = await register(noAcceptance);
    expect(res.statusCode).toBe(422);
  });

  it('422 — acceptedTerms: false is rejected', async () => {
    const res = await register(validPayload(`false-${Date.now()}`, { acceptedTerms: false }));
    expect(res.statusCode).toBe(422);
  });

  // A disabled submit button is not enforcement, and neither is a loose
  // truthiness check: "on" is what an unconfigured HTML checkbox posts.
  it.each([['string true', 'true'], ['number one', 1], ['checkbox on', 'on'], ['null', null]])(
    '422 — %s is not accepted as consent',
    async (_label, value) => {
      const res = await register(
        validPayload(`loose-${Date.now()}-${Math.random()}`, { acceptedTerms: value })
      );
      expect(res.statusCode).toBe(422);
    }
  );

  it('201 — acceptedTerms: true registers the school', async () => {
    const res = await register(validPayload(`ok-${Date.now()}`));
    expect(res.statusCode).toBe(201);
  });
});

// ── The acceptance record ─────────────────────────────────────────────────────

describe('The acceptance record', () => {
  it('is written with version, timestamp, accepting user and IP', async () => {
    const id = `rec-${Date.now()}`;
    const res = await register(validPayload(id));
    expect(res.statusCode).toBe(201);

    const school = await School.findById(res.body.data.school._id).lean();
    expect(school.legal.termsVersion).toBe(TERMS_VERSION);
    expect(school.legal.privacyVersion).toBe(PRIVACY_VERSION);
    expect(school.legal.termsAcceptedAt).toBeInstanceOf(Date);
    expect(school.legal.termsAcceptedIp).toEqual(expect.any(String));

    // termsAcceptedBy must point at the admin created in the same transaction —
    // this is what answers "who bound the school" in a dispute.
    expect(String(school.legal.termsAcceptedBy)).toBe(String(res.body.data.user._id));
  });

  it('stamps the server-side version, ignoring any version the client sends', async () => {
    const id = `forge-${Date.now()}`;
    const res = await register(
      validPayload(id, { termsVersion: '99.0', legal: { termsVersion: '99.0' } })
    );
    expect(res.statusCode).toBe(201);

    const school = await School.findById(res.body.data.school._id).lean();
    expect(school.legal.termsVersion).toBe(TERMS_VERSION);
    expect(school.legal.termsVersion).not.toBe('99.0');
  });

  it('is never absent — no school exists without one', async () => {
    await register(validPayload(`inv-${Date.now()}`));
    const orphans = await School.countDocuments({
      $or: [{ 'legal.termsAcceptedAt': null }, { 'legal.termsAcceptedAt': { $exists: false } }],
    });
    expect(orphans).toBe(0);
  });

  it('is not exposed in the registration response', async () => {
    const res = await register(validPayload(`hide-${Date.now()}`));
    expect(res.body.data.school.legal).toBeUndefined();
  });
});

// ── Notice acknowledgement on first login ─────────────────────────────────────

describe('First-login notice acknowledgement', () => {
  it('records noticeAckedAt in the same write that clears mustChangePassword', async () => {
    const school = await createSchool();
    const { user: studentUser } = await createStudent(school._id, null, {
      studentFields: { dateOfBirth: '2010-01-01' },
    });
    const cookies = getAuthCookies(studentUser);

    await User.findByIdAndUpdate(studentUser._id, { mustChangePassword: true });

    const before = await User.findById(studentUser._id).lean();
    expect(before.noticeAckedAt).toBeNull();

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Cookie', cookies)
      .send({ currentPassword: 'Password1', newPassword: 'NewSecure@99' });
    expect(res.status).toBe(200);

    // Both facts describe one event and must move together. A user who changed
    // their password but is recorded as never having seen the notice is
    // precisely the state we would be asked to explain.
    const after = await User.findById(studentUser._id).lean();
    expect(after.mustChangePassword).toBe(false);
    expect(after.noticeAckedAt).toBeInstanceOf(Date);
  });
});

// ── Administrator acknowledgement ─────────────────────────────────────────────

describe('POST /api/v1/admin/legal/ack', () => {
  it('records the acknowledgement for a school-admin', async () => {
    const school = await createSchool();
    const admin = await createSchoolAdmin(school._id);

    const res = await request(app)
      .post('/api/v1/admin/legal/ack')
      .set('Cookie', getAuthCookies(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.adminDataAckAt).toEqual(expect.any(String));

    const stored = await User.findById(admin._id).lean();
    expect(stored.adminDataAckAt).toBeInstanceOf(Date);
  });

  it('is idempotent — a repeat call keeps the ORIGINAL timestamp', async () => {
    const school = await createSchool();
    const admin = await createSchoolAdmin(school._id);
    const cookies = getAuthCookies(admin);

    const first = await request(app).post('/api/v1/admin/legal/ack').set('Cookie', cookies);
    const second = await request(app).post('/api/v1/admin/legal/ack').set('Cookie', cookies);

    expect(second.status).toBe(200);
    // The first acknowledgement is the evidentially meaningful one; re-stamping
    // it on every visit would destroy the only fact worth recording.
    expect(second.body.data.adminDataAckAt).toBe(first.body.data.adminDataAckAt);
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await request(app).post('/api/v1/admin/legal/ack');
    expect(res.status).toBe(401);
  });

  it('403 — a student cannot record an administrator acknowledgement', async () => {
    const school = await createSchool();
    const { user: studentUser } = await createStudent(school._id, null, {
      studentFields: { dateOfBirth: '2010-01-01' },
    });

    const res = await request(app)
      .post('/api/v1/admin/legal/ack')
      .set('Cookie', getAuthCookies(studentUser));
    expect(res.status).toBe(403);
  });
});
