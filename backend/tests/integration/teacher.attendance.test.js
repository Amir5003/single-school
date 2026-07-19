const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser, createSchool, createSchoolAdmin, setKnownPassword } = require('../helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
};

let testSchool;

const TEACHER_DATA = {
  name: 'Mr Ali',
  email: 'ali@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-001',
};

const TEACHER2_DATA = {
  name: 'Ms Sara',
  email: 'sara@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-002',
};

const CLASS_DATA = {
  name: 'Class 5A',
  grade: '5',
  section: 'A',
  academicYear: '2024-2025',
};

const STUDENT_BASE = (n) => ({
  name: `Student ${n}`,
  email: `student${n}@school.test`,
  password: 'Student@1234',
  enrollmentId: `STU-00${n}`,
  dateOfBirth: '2012-01-01',
});

// ── Date helpers ──────────────────────────────────────────────────────────────

const toDateStr = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

const today = () => toDateStr(new Date());

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
};

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const registerUser = (data) =>
  request(app).post('/api/v1/auth/register').send(data);

const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { res, cookie: res.headers['set-cookie'] };
};

const getAdminCookie = async () => {
  testSchool = await createSchool();
  await createSchoolAdmin(testSchool._id, { email: ADMIN.email, password: ADMIN.password, name: ADMIN.name });
  const { cookie } = await loginUser(ADMIN.email, ADMIN.password);
  return cookie;
};

const getTeacherCookie = async (email, password) => {
  // API-created teachers get a random emailed temp password — set a known one
  await setKnownPassword(email, password);
  const { cookie } = await loginUser(email, password);
  return cookie;
};

const createTeacher = (adminCookie, data) =>
  request(app)
    .post('/api/v1/admin/teachers')
    .set('Cookie', adminCookie)
    .send(data);

const createClass = (adminCookie) =>
  request(app)
    .post('/api/v1/admin/classes')
    .set('Cookie', adminCookie)
    .send(CLASS_DATA);

const createStudent = (adminCookie, data) =>
  request(app)
    .post('/api/v1/admin/students')
    .set('Cookie', adminCookie)
    .send(data);

const assignTeacher = (adminCookie, teacherId, classId, subject) =>
  request(app)
    .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
    .set('Cookie', adminCookie)
    .send({ classId, subject });

const assignStudents = (adminCookie, classId, studentIds) =>
  request(app)
    .post(`/api/v1/admin/classes/${classId}/assign-students`)
    .set('Cookie', adminCookie)
    .send({ studentIds });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Teacher Attendance', () => {
  let adminCookie;
  let teacherCookie;
  let teacherId;
  let classId;
  let studentIds;

  beforeEach(async () => {
    // Create admin
    adminCookie = await getAdminCookie();

    // Create teacher
    const tRes = await createTeacher(adminCookie, TEACHER_DATA);
    teacherId = tRes.body.data.teacher._id;

    // Create class
    const cRes = await createClass(adminCookie);
    classId = cRes.body.data.class._id;

    // Assign teacher to class
    await assignTeacher(adminCookie, teacherId, classId, 'Mathematics');

    // Create 3 students
    const s1 = await createStudent(adminCookie, STUDENT_BASE(1));
    const s2 = await createStudent(adminCookie, STUDENT_BASE(2));
    const s3 = await createStudent(adminCookie, STUDENT_BASE(3));
    studentIds = [
      s1.body.data.student._id,
      s2.body.data.student._id,
      s3.body.data.student._id,
    ];

    // Assign students to class
    await assignStudents(adminCookie, classId, studentIds);

    // Teacher login
    teacherCookie = await getTeacherCookie(TEACHER_DATA.email, TEACHER_DATA.password);
  });

  // ── POST /api/v1/teacher/attendance ────────────────────────────────────────

  describe('POST /api/v1/teacher/attendance — mark', () => {
    it('200 — bulk marks are saved and persisted', async () => {
      const records = [
        { studentId: studentIds[0], status: 'Present' },
        { studentId: studentIds[1], status: 'Absent' },
        { studentId: studentIds[2], status: 'Leave' },
      ];

      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({ classId, date: today(), records });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.saved).toBeGreaterThan(0);
    });

    it('stores Present / Absent / Leave values correctly', async () => {
      const records = [
        { studentId: studentIds[0], status: 'Present' },
        { studentId: studentIds[1], status: 'Absent' },
        { studentId: studentIds[2], status: 'Leave' },
      ];

      await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({ classId, date: today(), records });

      // Fetch and verify
      const fetchRes = await request(app)
        .get('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .query({ classId, date: today() });

      expect(fetchRes.statusCode).toBe(200);
      const saved = fetchRes.body.data.records;
      expect(saved).toHaveLength(3);

      const statuses = saved.map((r) => r.status);
      expect(statuses).toContain('Present');
      expect(statuses).toContain('Absent');
      expect(statuses).toContain('Leave');
    });

    it('upserts on duplicate date — updates rather than rejecting', async () => {
      const records = [{ studentId: studentIds[0], status: 'Absent' }];

      await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({ classId, date: today(), records });

      // Re-mark same student with different status
      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({
          classId,
          date: today(),
          records: [{ studentId: studentIds[0], status: 'Present' }],
        });

      expect(res.statusCode).toBe(200);

      const fetchRes = await request(app)
        .get('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .query({ classId, date: today() });

      const record = fetchRes.body.data.records.find(
        (r) => r.studentId._id === studentIds[0] || r.studentId?._id === studentIds[0]
      );
      expect(record.status).toBe('Present');
    });

    it('400 — future date is rejected', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({
          classId,
          date: tomorrow(),
          records: [{ studentId: studentIds[0], status: 'Present' }],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('verifies markedBy is set to the teacher', async () => {
      const records = [{ studentId: studentIds[0], status: 'Present' }];

      await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({ classId, date: today(), records });

      const fetchRes = await request(app)
        .get('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .query({ classId, date: today() });

      const record = fetchRes.body.data.records[0];
      expect(record.markedBy).toBeDefined();
      expect(record.markedBy.toString()).toBe(teacherId);
    });

    it('403 — teacher not assigned to class is rejected', async () => {
      // Create a second teacher NOT assigned to this class
      await createTeacher(adminCookie, TEACHER2_DATA);
      const teacher2Cookie = await getTeacherCookie(TEACHER2_DATA.email, TEACHER2_DATA.password);

      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacher2Cookie)
        .send({
          classId,
          date: today(),
          records: [{ studentId: studentIds[0], status: 'Present' }],
        });

      expect(res.statusCode).toBe(403);
    });

    it('401 — unauthenticated request is rejected', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .send({
          classId,
          date: today(),
          records: [{ studentId: studentIds[0], status: 'Present' }],
        });

      expect(res.statusCode).toBe(401);
    });

    it('403 — admin token cannot access teacher routes', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', adminCookie)
        .send({
          classId,
          date: today(),
          records: [{ studentId: studentIds[0], status: 'Present' }],
        });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── GET /api/v1/teacher/attendance ─────────────────────────────────────────

  describe('GET /api/v1/teacher/attendance — fetch', () => {
    it('200 — returns records for class + date', async () => {
      const records = [
        { studentId: studentIds[0], status: 'Present' },
        { studentId: studentIds[1], status: 'Absent' },
      ];

      await request(app)
        .post('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .send({ classId, date: today(), records });

      const res = await request(app)
        .get('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .query({ classId, date: today() });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.records).toHaveLength(2);
    });

    it('200 — returns empty array for a date with no records', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/attendance')
        .set('Cookie', teacherCookie)
        .query({ classId, date: yesterday() });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.records).toHaveLength(0);
    });

    it('403 — teacher not assigned to class cannot view records', async () => {
      await createTeacher(adminCookie, TEACHER2_DATA);
      const teacher2Cookie = await getTeacherCookie(TEACHER2_DATA.email, TEACHER2_DATA.password);

      const res = await request(app)
        .get('/api/v1/teacher/attendance')
        .set('Cookie', teacher2Cookie)
        .query({ classId, date: today() });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── GET /api/v1/teacher/classes ────────────────────────────────────────────

  describe('GET /api/v1/teacher/classes', () => {
    it('200 — returns assigned classes with student count', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/classes')
        .set('Cookie', teacherCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.classes).toHaveLength(1);
      expect(res.body.data.classes[0].classId.grade).toBe('5');
      expect(res.body.data.classes[0].studentCount).toBe(3);
    });
  });

  // ── GET /api/v1/teacher/classes/:classId/students ──────────────────────────

  describe('GET /api/v1/teacher/classes/:classId/students', () => {
    it('200 — returns list of students in the class', async () => {
      const res = await request(app)
        .get(`/api/v1/teacher/classes/${classId}/students`)
        .set('Cookie', teacherCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.students).toHaveLength(3);
    });
  });
});
