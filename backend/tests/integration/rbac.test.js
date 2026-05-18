/**
 * RBAC Integration Tests — 5 Roles × All Endpoint Categories
 *
 * Verifies that each role receives:
 *   - 200 (or 201) for endpoints permitted to that role
 *   - 403 for endpoints forbidden to that role
 *   - 401 for endpoints accessed without authentication
 *
 * Key assertions:
 *   - teacher cannot access /admin/*
 *   - student cannot POST attendance
 *   - parent cannot access another parent's children
 *   - super-admin bypasses schoolScope (no school needed)
 *   - school-admin cannot access platform routes
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User.model');
const ParentStudentLink = require('../../src/models/ParentStudentLink.model');
const {
  createSchool,
  createSchoolAdmin,
  createTeacher,
  createStudent,
  getAuthCookies,
} = require('../helpers');

// ── JWT helper (also used for super-admin which has no schoolId) ──────────────
const mintCookie = (userId, role, schoolId = null) => {
  const token = jwt.sign(
    { id: userId, role, schoolId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return `token=${token}`;
};

// ── Fixtures ──────────────────────────────────────────────────────────────────
describe('RBAC — Role-Based Access Control', () => {
  let school;
  let adminUser;
  let teacherUser;
  let studentUser;
  let studentDoc;
  let parentUser;
  let superAdminUser;

  let adminCookie;
  let teacherCookie;
  let studentCookie;
  let parentCookie;
  let superAdminCookie;

  beforeEach(async () => {
    school = await createSchool();

    adminUser = await createSchoolAdmin(school._id);
    const { user: tUser } = await createTeacher(school._id);
    teacherUser = tUser;
    const { user: sUser, student: sDoc } = await createStudent(school._id, null);
    studentUser = sUser;
    studentDoc = sDoc;

    // Create parent user
    parentUser = await User.create({
      name: 'Parent User',
      email: `parent-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'Password1',
      role: 'parent',
      schoolId: school._id,
      approvalStatus: 'approved',
      isActive: true,
    });

    // Link parent → student
    await ParentStudentLink.create({
      schoolId: school._id,
      parentId: parentUser._id,
      studentId: studentDoc._id,
    });

    // Create super-admin (no schoolId)
    superAdminUser = await User.create({
      name: 'Super Admin',
      email: `superadmin-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'Password1',
      role: 'super-admin',
      approvalStatus: 'approved',
      isActive: true,
    });

    adminCookie = mintCookie(adminUser._id, 'school-admin', school._id);
    teacherCookie = mintCookie(teacherUser._id, 'teacher', school._id);
    studentCookie = mintCookie(studentUser._id, 'student', school._id);
    parentCookie = mintCookie(parentUser._id, 'parent', school._id);
    superAdminCookie = mintCookie(superAdminUser._id, 'super-admin');
  });

  // ── Unauthenticated access ────────────────────────────────────────────────
  describe('Unauthenticated access — 401 for all protected routes', () => {
    it('401 — GET /admin/students without cookie', async () => {
      const res = await request(app).get('/api/v1/admin/students');
      expect(res.statusCode).toBe(401);
    });

    it('401 — GET /teacher/classes without cookie', async () => {
      const res = await request(app).get('/api/v1/teacher/classes');
      expect(res.statusCode).toBe(401);
    });

    it('401 — GET /student/profile without cookie', async () => {
      const res = await request(app).get('/api/v1/student/profile');
      expect(res.statusCode).toBe(401);
    });

    it('401 — GET /parent/children without cookie', async () => {
      const res = await request(app).get('/api/v1/parent/children');
      expect(res.statusCode).toBe(401);
    });

    it('401 — GET /platform/schools without cookie', async () => {
      const res = await request(app).get('/api/v1/platform/schools');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── School-admin RBAC ─────────────────────────────────────────────────────
  describe('school-admin — can access /admin, cannot access /platform', () => {
    it('200 — school-admin GET /admin/students', async () => {
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(200);
    });

    it('200 — school-admin GET /admin/teachers', async () => {
      const res = await request(app)
        .get('/api/v1/admin/teachers')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(200);
    });

    it('403 — school-admin cannot access /platform/schools', async () => {
      const res = await request(app)
        .get('/api/v1/platform/schools')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — school-admin cannot access /platform/analytics', async () => {
      const res = await request(app)
        .get('/api/v1/platform/analytics')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — school-admin cannot GET /teacher/classes', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/classes')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — school-admin cannot GET /student/profile', async () => {
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — school-admin cannot GET /parent/children', async () => {
      const res = await request(app)
        .get('/api/v1/parent/children')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Teacher RBAC ──────────────────────────────────────────────────────────
  describe('teacher — can access /teacher, cannot access /admin or /student', () => {
    it('200 — teacher GET /teacher/classes', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/classes')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(200);
    });

    it('403 — teacher cannot GET /admin/students', async () => {
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — teacher cannot GET /admin/teachers', async () => {
      const res = await request(app)
        .get('/api/v1/admin/teachers')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — teacher cannot GET /student/profile', async () => {
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — teacher cannot GET /platform/schools', async () => {
      const res = await request(app)
        .get('/api/v1/platform/schools')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — teacher cannot GET /parent/children', async () => {
      const res = await request(app)
        .get('/api/v1/parent/children')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Student RBAC ──────────────────────────────────────────────────────────
  describe('student — can access /student, cannot POST attendance or access /admin', () => {
    it('200 — student GET /student/profile', async () => {
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', studentCookie);
      expect(res.statusCode).toBe(200);
    });

    it('403 — student cannot POST /teacher/attendance', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', studentCookie)
        .send({});
      expect(res.statusCode).toBe(403);
    });

    it('403 — student cannot GET /admin/students', async () => {
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', studentCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — student cannot GET /teacher/classes', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/classes')
        .set('Cookie', studentCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — student cannot GET /platform/schools', async () => {
      const res = await request(app)
        .get('/api/v1/platform/schools')
        .set('Cookie', studentCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — student cannot GET /parent/children', async () => {
      const res = await request(app)
        .get('/api/v1/parent/children')
        .set('Cookie', studentCookie);
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Parent RBAC ───────────────────────────────────────────────────────────
  describe('parent — can access /parent/children, isolated from other parents', () => {
    it('200 — parent GET /parent/children', async () => {
      const res = await request(app)
        .get('/api/v1/parent/children')
        .set('Cookie', parentCookie);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.children)).toBe(true);
    });

    it('200 — parent GET /parent/children/:studentId/attendance for own child', async () => {
      const res = await request(app)
        .get(`/api/v1/parent/children/${studentDoc._id}/attendance`)
        .set('Cookie', parentCookie);
      expect(res.statusCode).toBe(200);
    });

    it('403 — parent cannot GET another child they are not linked to', async () => {
      // Create another student in the same school
      const { student: otherStudent } = await createStudent(school._id, null);

      const res = await request(app)
        .get(`/api/v1/parent/children/${otherStudent._id}/attendance`)
        .set('Cookie', parentCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — parent cannot access /admin/students', async () => {
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', parentCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — parent cannot access /teacher/classes', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/classes')
        .set('Cookie', parentCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — parent cannot access /platform/schools', async () => {
      const res = await request(app)
        .get('/api/v1/platform/schools')
        .set('Cookie', parentCookie);
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Super-admin RBAC ──────────────────────────────────────────────────────
  describe('super-admin — can access /platform, bypasses schoolScope', () => {
    it('200 — super-admin GET /platform/schools', async () => {
      const res = await request(app)
        .get('/api/v1/platform/schools')
        .set('Cookie', superAdminCookie);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.schools)).toBe(true);
    });

    it('200 — super-admin GET /platform/analytics', async () => {
      const res = await request(app)
        .get('/api/v1/platform/analytics')
        .set('Cookie', superAdminCookie);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.analytics)).toBe(true);
    });

    it('200 — super-admin GET /platform/schools/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/schools/${school._id}`)
        .set('Cookie', superAdminCookie);
      expect(res.statusCode).toBe(200);
    });

    it('200 — super-admin PATCH /platform/schools/:id/activate', async () => {
      const res = await request(app)
        .patch(`/api/v1/platform/schools/${school._id}/activate`)
        .set('Cookie', superAdminCookie);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.school.isActive).toBe(true);
    });

    it('200 — super-admin PATCH /platform/schools/:id/deactivate', async () => {
      const res = await request(app)
        .patch(`/api/v1/platform/schools/${school._id}/deactivate`)
        .set('Cookie', superAdminCookie);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.school.isActive).toBe(false);
    });

    it('403 — super-admin cannot access /admin/students (authorize blocks non-school-admin roles)', async () => {
      // Super-admin bypasses schoolScope but is blocked by authorize('school-admin')
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', superAdminCookie);
      // authorize('school-admin') rejects super-admin → 403
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Deactivated school ────────────────────────────────────────────────────
  describe('Deactivated school — 403 for all school-scoped routes', () => {
    it('403 — school-admin gets 403 after school is deactivated', async () => {
      // Deactivate the school via super-admin
      await request(app)
        .patch(`/api/v1/platform/schools/${school._id}/deactivate`)
        .set('Cookie', superAdminCookie);

      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Cookie', adminCookie);
      expect(res.statusCode).toBe(403);
    });

    it('403 — teacher gets 403 after school is deactivated', async () => {
      await request(app)
        .patch(`/api/v1/platform/schools/${school._id}/deactivate`)
        .set('Cookie', superAdminCookie);

      const res = await request(app)
        .get('/api/v1/teacher/classes')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });
  });
});
