const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { createSchool, createSchoolAdmin, createTeacher, createStudent } = require('../helpers');

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeToken = (userId, role, schoolId) =>
  jwt.sign(
    { id: userId, role, schoolId: schoolId || null },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

const authAs = (userId, role, schoolId) => `token=${makeToken(userId, role, schoolId)}`;

// ── Cross-Tenant Data Isolation ───────────────────────────────────────────────

describe('Cross-Tenant Isolation — School A data is invisible to School B users', () => {
  let schoolA;
  let schoolB;
  let adminA;
  let teacherAUser;
  let adminB;

  beforeEach(async () => {
    schoolA = await createSchool({ name: 'School A', slug: 'school-a' });
    schoolB = await createSchool({ name: 'School B', slug: 'school-b' });

    adminA = await createSchoolAdmin(schoolA._id, { email: 'admin-a@test.com' });
    adminB = await createSchoolAdmin(schoolB._id, { email: 'admin-b@test.com' });
    const { user: tUser } = await createTeacher(schoolA._id, { email: 'teacher-a@test.com' });
    teacherAUser = tUser;
  });

  it('School B admin GET /students returns empty list (not School A students)', async () => {
    // Create a student in School A via admin A
    const cookieA = authAs(adminA._id, 'school-admin', schoolA._id);
    await request(app)
      .post('/api/v1/admin/students')
      .set('Cookie', cookieA)
      .send({
        name: 'Alice',
        email: 'alice@schoola.test',
        password: 'Pass1234',
        enrollmentId: 'STU-A01',
        dateOfBirth: '2010-01-01',
      });

    // School B admin lists students — must be empty
    const cookieB = authAs(adminB._id, 'school-admin', schoolB._id);
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', cookieB);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.students).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('School B admin GET /teachers returns empty list (not School A teachers)', async () => {
    const cookieB = authAs(adminB._id, 'school-admin', schoolB._id);
    const res = await request(app)
      .get('/api/v1/admin/teachers')
      .set('Cookie', cookieB);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.teachers).toHaveLength(0);
  });

  it('School B admin GET /classes returns empty list (not School A classes)', async () => {
    // Create a class in School A
    const cookieA = authAs(adminA._id, 'school-admin', schoolA._id);
    await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', cookieA)
      .send({ name: 'Class 1A', grade: '1', section: 'A', academicYear: '2025-26' });

    const cookieB = authAs(adminB._id, 'school-admin', schoolB._id);
    const res = await request(app)
      .get('/api/v1/admin/classes')
      .set('Cookie', cookieB);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.classes).toHaveLength(0);
  });

  it('School A teacher cannot access School B admin routes (wrong role → 403)', async () => {
    const cookieTeacherAsAdmin = authAs(teacherAUser._id, 'teacher', schoolB._id);
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', cookieTeacherAsAdmin);

    expect(res.statusCode).toBe(403);
  });

  it('Tampered JWT with different schoolId in payload → 403 (school not found)', async () => {
    const { Types } = require('mongoose');
    const fakeSchoolId = new Types.ObjectId();
    const tamperedCookie = authAs(adminA._id, 'school-admin', fakeSchoolId);

    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', tamperedCookie);

    expect(res.statusCode).toBe(403);
  });

  it('Token with no schoolId → 403', async () => {
    const cookieNoSchool = authAs(adminA._id, 'school-admin', null);
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', cookieNoSchool);

    expect(res.statusCode).toBe(403);
  });

  it('Deactivated school → 403 on any protected endpoint', async () => {
    // Deactivate School A directly in DB
    const School = require('../../src/models/School.model');
    await School.findByIdAndUpdate(schoolA._id, { isActive: false });

    const cookieA = authAs(adminA._id, 'school-admin', schoolA._id);
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', cookieA);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/inactive/i);
  });
});

// ── Student route isolation ───────────────────────────────────────────────────

describe('Cross-Tenant Isolation — student routes', () => {
  let schoolA;
  let schoolB;
  let studentAUser;

  beforeEach(async () => {
    schoolA = await createSchool({ name: 'SA', slug: 'sa-school' });
    schoolB = await createSchool({ name: 'SB', slug: 'sb-school' });
    const Class = require('../../src/models/Class.model');
    const cls = await Class.create({ schoolId: schoolA._id, name: 'C1', grade: '1', section: 'A', academicYear: '2025' });
    const { user } = await createStudent(schoolA._id, cls._id, { email: 'stu-a@test.com' });
    studentAUser = user;
  });

  it('School A student token with School B schoolId → 403', async () => {
    const sabCookie = authAs(studentAUser._id, 'student', schoolB._id);
    const res = await request(app)
      .get('/api/v1/student/profile')
      .set('Cookie', sabCookie);

    // schoolScope will find School B (which exists), but still scoped to School B.
    // The student profile lookup will return 404 (no student in School B for this user)
    // OR it could 200 with empty if the service doesn't find a matching Student.
    // The key assertion: School A student's data is NOT returned when using School B token.
    expect([403, 404]).toContain(res.statusCode);
  });

  it('School A student using School A token sees own profile', async () => {
    const cookieA = authAs(studentAUser._id, 'student', schoolA._id);
    const res = await request(app)
      .get('/api/v1/student/profile')
      .set('Cookie', cookieA);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.student.userId._id.toString()).toBe(studentAUser._id.toString());
  });
});
